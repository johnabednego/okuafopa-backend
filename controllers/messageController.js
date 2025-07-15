// controllers/messageController.js
const Message = require('../models/Message');
const Order   = require('../models/Order');
const User    = require('../models/User');
const withAudit = require('../utils/withAudit');
const notificationService = require('../services/emailService');

/**
 * CREATE → audit CREATE
 * POST /api/messages
 * Body: { order, text }
 */
exports.createMessage = withAudit('Message', 'CREATE', async (req, res, next) => {
  try {
    const { order: orderId, text } = req.body;
    const senderId = req.user.sub;

    // 1) Create the message
    const msg = await Message.create({
      order:       orderId,
      text,
      sender:      senderId,
      lastUpdatedBy: senderId
    });

    // 2) Let withAudit know what was created
    res.locals.created   = msg;
    res.locals.auditUser = senderId;

    // 3) Identify the other participant(s)
    const order = await Order.findById(orderId).select('buyer farmer').lean();
    if (order) {
      // collect unique recipient IDs, excluding the sender
      const recipientIds = new Set([ order.buyer.toString(), order.farmer.toString() ]);
      recipientIds.delete(senderId);

      // fetch each recipient’s email/name
      const recipients = await User.find({
        _id: { $in: Array.from(recipientIds) }
      }).select('email firstName lastName').lean();

      // 4) Send notification to each
      await Promise.all(recipients.map(r =>
        notificationService.sendMessageNotification(msg, r)
      ));
    }

    // 5) Return the newly created message
    res.status(201).json(msg);
  } catch (err) {
    next(err);
  }
});


/**
 * GET /api/messages
 * Query: ?order={orderId}
 * List all messages for an order
 */
exports.listMessages = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.order) filter.order = req.query.order;

    const msgs = await Message.find(filter)
      .populate('sender', 'firstName lastName email')
      .sort('createdAt')
      .lean();

    res.json(msgs);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/messages/:id
 */
exports.getMessage = async (req, res, next) => {
  try {
    const msg = await Message.findById(req.params.id)
      .populate('sender', 'firstName lastName email')
      .lean();
    if (!msg) return res.status(404).json({ message: 'Message not found' });
    res.json(msg);
  } catch (err) {
    next(err);
  }
};

/**
 * UPDATE → audit UPDATE
 * PATCH /api/messages/:id
 * Body: { text }
 */
exports.updateMessage = withAudit('Message', 'UPDATE', async (req, res, next) => {
  try {
    const updates = {};
    if (req.body.text !== undefined) updates.text = req.body.text;
    updates.lastUpdatedBy = req.user.sub;

    const msg = await Message.findOneAndUpdate(
      { _id: req.params.id, sender: req.user.sub },
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!msg) return res.status(404).json({ message: 'Message not found or unauthorized' });

    res.locals.updated   = msg;
    res.locals.auditUser = req.user.sub;

    res.json(msg);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE → audit DELETE
 * DELETE /api/messages/:id
 */
exports.deleteMessage = withAudit('Message', 'DELETE', async (req, res, next) => {
  try {
    const msg = await Message.findOneAndDelete({
      _id: req.params.id,
      sender: req.user.sub
    });
    if (!msg) return res.status(404).json({ message: 'Message not found or unauthorized' });

    res.locals.auditUser = req.user.sub;

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
