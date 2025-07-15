const Order = require('../models/Order');
const Product = require('../models/Product');
const notificationService = require('../services/emailService');
const withAudit = require('../utils/withAudit');

/**
 * CREATE → audit CREATE
 * POST /api/orders
 */
exports.createOrder = withAudit('Order', 'CREATE', async (req, res, next) => {
  try {
    const { items, deliveryMethod, pickupInfo, thirdPartyInfo } = req.body;
    // calculate subtotal & validate products
    let subtotal = 0;
    for (let it of items) {
      const prod = await Product.findById(it.product).lean();
      if (!prod) return res.status(400).json({ message: `Product ${it.product} not found` });
      if (it.qty > prod.quantity) {
        return res.status(400).json({ message: `Insufficient stock for ${prod.title}` });
      }
      subtotal += prod.price * it.qty;
      // reduce stock
      await Product.findByIdAndUpdate(prod._id, { $inc: { quantity: -it.qty } });
      it.priceAtOrder = prod.price;
    }

    const data = {
      buyer: req.user.sub,
      items,
      subtotal,
      deliveryMethod,
      pickupInfo: deliveryMethod === 'pickup' ? pickupInfo : undefined,
      thirdPartyInfo: deliveryMethod === 'thirdParty' ? thirdPartyInfo : undefined,
      lastUpdatedBy: req.user.sub
    };

    const order = await Order.create(data);

    res.locals.created   = order;
    res.locals.auditUser = req.user.sub;

    // Notify buyer & farmer(s)
    await notificationService.sendOrderNotification('created', order, req.user);

    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/orders
 * List orders (buyer sees own, admin can see all)
 */
exports.listOrders = async (req, res, next) => {
  try {
    const filter = {};
    if (!req.user.isAdmin) filter.buyer = req.user.sub;

    const orders = await Order.find(filter)
      .populate('buyer', 'firstName lastName email')
      .populate('items.product', 'title images')
      .sort('-createdAt')
      .lean();

    res.json(orders);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/orders/:id
 */
exports.getOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('buyer', 'firstName lastName email')
      .populate('items.product', 'title images price')
      .lean();
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (!req.user.isAdmin && order.buyer._id.toString() !== req.user.sub) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    res.json(order);
  } catch (err) {
    next(err);
  }
};

/**
 * UPDATE STATUS → audit UPDATE
 * PATCH /api/orders/:id/status
 */
exports.updateOrderStatus = withAudit('Order', 'UPDATE', async (req, res, next) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // permission: only farmer of those products or admin
    if (!req.user.isAdmin) {
      // check that current user is farmer for at least one item
      const isFarmer = order.items.some(it => it.product.farmer.toString() === req.user.sub);
      if (!isFarmer) return res.status(403).json({ message: 'Forbidden' });
    }

    order.status = status;
    order.lastUpdatedBy = req.user.sub;
    await order.save();

    res.locals.updated   = order;
    res.locals.auditUser = req.user.sub;

    // Notify buyer
    await notificationService.sendOrderNotification('statusChanged', order, order.buyer);

    res.json(order);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE → audit DELETE
 * DELETE /api/orders/:id
 * (Only admin can delete)
 */
exports.deleteOrder = withAudit('Order', 'DELETE', async (req, res, next) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    res.locals.auditUser = req.user.sub;

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
