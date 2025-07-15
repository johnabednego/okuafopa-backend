const Feedback = require('../models/Feedback');
const Order    = require('../models/Order');
const User     = require('../models/User');
const withAudit = require('../utils/withAudit');
const notificationService = require('../services/emailService');

/**
 * CREATE → audit CREATE
 * POST /api/feedbacks
 * Body: { order, rating, comment }
 */
exports.createFeedback = withAudit('Feedback', 'CREATE', async (req, res, next) => {
  try {
    const { order: orderId, rating, comment } = req.body;
    const userId = req.user.sub;

    // 1) Ensure order exists and belongs to this buyer
    const order = await Order.findById(orderId).lean();
    if (!order) return res.status(400).json({ message: 'Order not found' });
    if (order.buyer.toString() !== userId) {
      return res.status(403).json({ message: 'Can only feedback your own orders' });
    }

    // 2) Prevent duplicate feedback
    if (await Feedback.exists({ order: orderId })) {
      return res.status(400).json({ message: 'Feedback already submitted for this order' });
    }

    // 3) Create feedback
    const fb = await Feedback.create({
      order:         orderId,
      author:        userId,
      rating,
      comment,
      lastUpdatedBy: userId
    });

    // 4) Audit metadata
    res.locals.created   = fb;
    res.locals.auditUser = userId;

    // 5) Notify the farmer
    const farmer = await User.findById(order.farmer).select('email firstName lastName');
    if (farmer) {
      await notificationService.sendFeedbackCreatedNotification(fb, farmer);
    }

    return res.status(201).json(fb);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/feedbacks
 * Query: ?order={orderId}
 * List feedbacks, optionally filtered by order
 */
exports.listFeedbacks = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.order) filter.order = req.query.order;

    const fbs = await Feedback.find(filter)
      .populate('author', 'firstName lastName')
      .sort('-createdAt')
      .lean();

    res.json(fbs);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/feedbacks/:id
 */
exports.getFeedback = async (req, res, next) => {
  try {
    const fb = await Feedback.findById(req.params.id)
      .populate('author', 'firstName lastName')
      .lean();
    if (!fb) return res.status(404).json({ message: 'Feedback not found' });
    res.json(fb);
  } catch (err) {
    next(err);
  }
};

/**
 * UPDATE → audit UPDATE
 * PATCH /api/feedbacks/:id
 * Buyers update rating/comment; farmers/admin respond.
 */
exports.updateFeedback = withAudit('Feedback', 'UPDATE', async (req, res, next) => {
  try {
    const fb = await Feedback.findById(req.params.id);
    if (!fb) return res.status(404).json({ message: 'Feedback not found' });

    const userId = req.user.sub;
    const isAuthor = fb.author.toString() === userId;
    const isAdmin  = req.user.isAdmin;
    // Optionally check if farmer:
    const order = await Order.findById(fb.order).select('farmer').lean();
    const isFarmer = order && order.farmer.toString() === userId;

    let didRespond = false;

    // Buyers can update their own rating/comment
    if (isAuthor) {
      if (req.body.rating !== undefined) fb.rating = req.body.rating;
      if (req.body.comment !== undefined) fb.comment = req.body.comment;
    }
    // Farmers or admins can add a response
    if ((isFarmer || isAdmin) && req.body.responseText) {
      fb.response = {
        text: req.body.responseText,
        respondedBy: userId,
        respondedAt: new Date()
      };
      didRespond = true;
    }

    fb.lastUpdatedBy = userId;
    const updated = await fb.save();

    // Audit metadata
    res.locals.updated   = updated;
    res.locals.auditUser = userId;

    // Send notification if farmer responded
    if (didRespond) {
      const buyer = await User.findById(fb.author).select('email firstName lastName');
      if (buyer) {
        await notificationService.sendFeedbackResponseNotification(updated, buyer);
      }
    }

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE → audit DELETE
 * DELETE /api/feedbacks/:id
 * Only author or admin
 */
exports.deleteFeedback = withAudit('Feedback', 'DELETE', async (req, res, next) => {
  try {
    const fb = await Feedback.findById(req.params.id);
    if (!fb) return res.status(404).json({ message: 'Feedback not found' });

    const userId = req.user.sub;
    const isAuthor = fb.author.toString() === userId;
    const isAdmin  = req.user.isAdmin;
    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized to delete this feedback' });
    }

    await fb.remove();
    res.locals.auditUser = userId;
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
