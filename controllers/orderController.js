// controllers/orderController.js
const mongoose = require('mongoose');
const Joi = require('joi');

const Order = require('../models/Order');
const ProductListing = require('../models/ProductListing');
const User = require('../models/User');
const notificationService = require('../services/emailService');
const withAudit = require('../utils/withAudit');

/* ===== Validation (Joi) ===== */
const orderSchema = Joi.object({
  billing: Joi.object({
    name: Joi.string().trim().required(),
    email: Joi.string().email().required(),
    phone: Joi.string().trim().required(),
    address: Joi.string().trim().required(),
    city: Joi.string().trim().allow('').optional(),
    country: Joi.string().trim().allow('').optional()
  }).required(),
  subOrders: Joi.array().min(1).items(
    Joi.object({
      farmer: Joi.string().hex().length(24).required(),
      deliveryMethod: Joi.string().valid('pickup', 'thirdParty').required(),
      pickupInfo: Joi.object({
        timeSlot: Joi.date().optional(),
        location: Joi.object({
          type: Joi.string().valid('Point'),
          coordinates: Joi.array().items(Joi.number()).length(2)
        }).optional()
      }).optional(),
      thirdPartyInfo: Joi.object({
        partnerOrderId: Joi.string().optional(),
        eta: Joi.date().optional(),
        cost: Joi.number().min(0).optional()
      }).optional(),
      items: Joi.array().min(1).items(
        Joi.object({
          product: Joi.string().hex().length(24).required(),
          qty: Joi.number().integer().min(1).required()
        })
      ).required()
    })
  ).required()
});

/* ===== Helpers: status derivation ===== */
function deriveSubOrderStatus(items) {
  if (!Array.isArray(items) || items.length === 0) return 'pending';
  const statuses = items.map(it => it.itemStatus || 'pending');

  if (statuses.every(s => s === 'delivered')) return 'delivered';
  if (statuses.every(s => s === 'cancelled')) return 'cancelled';
  if (statuses.includes('in_transit') || statuses.includes('ready') || statuses.includes('accepted')) return 'in_progress';
  if (statuses.includes('delivered') && statuses.some(s => s !== 'delivered')) return 'partially_delivered';
  if (statuses.every(s => s === 'pending')) return 'pending';
  return 'in_progress';
}

function deriveOrderStatus(subOrders) {
  if (!Array.isArray(subOrders) || subOrders.length === 0) return 'pending';
  const statuses = subOrders.map(so => so.status || 'pending');

  if (statuses.every(s => s === 'delivered')) return 'delivered';
  if (statuses.every(s => s === 'cancelled')) return 'cancelled';
  if (statuses.includes('delivered') && statuses.some(s => s !== 'delivered')) return 'partially_delivered';
  if (statuses.every(s => s === 'pending')) return 'pending';
  return 'in_progress';
}

/* ===== Utility: fully populate order ===== */
async function findAndPopulateOrder(orderId) {
  return Order.findById(orderId)
    .populate('buyer', 'firstName lastName email phoneNumber')
    .populate({ path: 'subOrders.farmer', select: 'firstName lastName email phoneNumber' })
    .populate({
      path: 'subOrders.items.product',
      model: 'ProductListing',
      select: 'price images productItem title quantity',
      populate: { path: 'productItem', model: 'ProductItem', select: 'productName' }
    })
    .lean();
}

/* ===== CREATE order (transaction + per-farmer notifications) ===== */
exports.createOrder = withAudit('Order', 'CREATE', async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const { error, value } = orderSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: 'Validation failed', details: error.details.map(d => d.message) });
    }
    const { billing, subOrders } = value;

    session.startTransaction();

    let grandTotal = 0;

    // Reserve & decrement stock per item (atomic)
    for (const so of subOrders) {
      if (!Array.isArray(so.items) || so.items.length === 0) {
        await session.abortTransaction();
        return res.status(400).json({ message: 'Each subOrder must have at least one item' });
      }

      let subtotal = 0;
      for (const it of so.items) {
        const qty = Number(it.qty);

        // load product item (with productItem reference) inside session
        const prod = await ProductListing.findById(it.product).populate('productItem', 'productName').session(session).lean();
        if (!prod) {
          await session.abortTransaction();
          return res.status(400).json({ message: `Product ${it.product} not found` });
        }

        const prodLabel = prod.productItem?.productName || prod.title || `Product ${prod._id}`;
        const available = Number(prod.quantity || 0);

        if (qty > available) {
          await session.abortTransaction();
          return res.status(400).json({
            message: `Only ${available} "${prodLabel}" available, you requested ${qty}.`,
            product: prodLabel,
            available,
            requested: qty
          });
        }

        const unitPrice = Number(prod.price || 0);
        subtotal += unitPrice * qty;
        it.priceAtOrder = unitPrice;
        it.itemStatus = it.itemStatus || 'pending';

        // decrement stock atomically (guard)
        const updated = await ProductListing.findOneAndUpdate(
          { _id: prod._id, quantity: { $gte: qty } },
          { $inc: { quantity: -qty } },
          { session, new: true }
        );

        if (!updated) {
          await session.abortTransaction();
          return res.status(409).json({ message: `Failed to reserve ${qty} of ${prodLabel}. Stock changed — try again.` });
        }
      }

      so.subtotal = subtotal;
      so.status = deriveSubOrderStatus(so.items);
      grandTotal += subtotal;
    }

    const orderData = {
      buyer: req.user.sub,
      billing,
      subOrders,
      grandTotal,
      lastUpdatedBy: req.user.sub,
      status: deriveOrderStatus(subOrders)
    };

    const created = await Order.create([orderData], { session });
    const orderDoc = created[0];

    await session.commitTransaction();
    session.endSession();

    const populated = await findAndPopulateOrder(orderDoc._id);

    // Notify buyer
    try {
      await notificationService.sendOrderNotification('created', populated, populated.buyer || req.user);
    } catch (e) {
      console.error('Buyer notification failed', e);
    }

    // Notify each farmer (per-subOrder payload)
    try {
      if (Array.isArray(populated.subOrders)) {
        for (const so of populated.subOrders) {
          const farmerInfo = (so.farmer && typeof so.farmer === 'object') ? so.farmer : (so.farmer && await User.findById(so.farmer).select('firstName lastName email phoneNumber').lean());
          const farmerView = {
            _id: populated._id,
            buyer: populated.buyer,
            subOrders: [so],
            grandTotal: so.subtotal,
            status: so.status,
            createdAt: populated.createdAt,
            updatedAt: populated.updatedAt
          };
          if (farmerInfo && farmerInfo.email) {
            await notificationService.sendOrderNotification('created', farmerView, farmerInfo);
          } else {
            console.warn('No farmer contact info — skipping email for farmer id', so.farmer);
          }
        }
      }
    } catch (e) {
      console.error('Per-farmer notifications failed', e);
    }

    res.locals.created = populated;
    res.locals.auditUser = req.user.sub;
    return res.status(201).json(populated);
  } catch (err) {
    try { if (session.inTransaction()) await session.abortTransaction(); } catch (e) { console.error('Abort failed', e); }
    session.endSession();
    next(err);
  }
});

/* ===== LIST orders (fully populated) ===== */
exports.listOrders = async (req, res, next) => {
  try {
    const filter = {};
    if (!req.user.isAdmin) filter.buyer = req.user.sub;

    const orders = await Order.find(filter)
      .populate('buyer', 'firstName lastName email phoneNumber')
      .populate({ path: 'subOrders.farmer', select: 'firstName lastName email phoneNumber' })
      .populate({
        path: 'subOrders.items.product',
        model: 'ProductListing',
        select: 'price images productItem title quantity',
        populate: { path: 'productItem', model: 'ProductItem', select: 'productName' }
      })
      .sort('-createdAt')
      .lean();

    res.json(orders);
  } catch (err) {
    next(err);
  }
};

/* ===== GET order by id (fully populated) ===== */
exports.getOrder = async (req, res, next) => {
  try {
    const order = await findAndPopulateOrder(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (!req.user.isAdmin && String(order.buyer._id) !== String(req.user.sub)) return res.status(403).json({ message: 'Forbidden' });
    res.json(order);
  } catch (err) {
    next(err);
  }
};

/* ===== Admin: update global order status (returns populated) ===== */
exports.updateOrderStatus = withAudit('Order', 'UPDATE', async (req, res, next) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json({ message: 'Forbidden' });
    const { status } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    order.status = status;
    order.lastUpdatedBy = req.user.sub;
    await order.save();

    const populated = await findAndPopulateOrder(order._id);
    res.locals.updated = populated;
    res.locals.auditUser = req.user.sub;

    try { await notificationService.sendOrderNotification('statusChanged', populated, populated.buyer || req.user); } catch (e) { console.error('Notify buyer failed', e); }

    res.json(populated);
  } catch (err) {
    next(err);
  }
});

/* ===== Update item status for a subOrder (farmer or admin) =====
   PATCH /api/orders/:orderId/subOrders/:subOrderId/items/:itemId/status
*/
exports.updateOrderItemStatus = withAudit('Order', 'UPDATE', async (req, res, next) => {
  try {
    const { orderId, subOrderId, itemId } = req.params;
    const { itemStatus } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const subOrder = order.subOrders.id(subOrderId);
    if (!subOrder) return res.status(404).json({ message: 'SubOrder not found' });

    const item = subOrder.items.id(itemId);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    if (!req.user.isAdmin && String(subOrder.farmer) !== String(req.user.sub)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    item.itemStatus = itemStatus;
    subOrder.status = deriveSubOrderStatus(subOrder.items);
    order.status = deriveOrderStatus(order.subOrders);
    order.lastUpdatedBy = req.user.sub;

    await order.save();

    const populated = await findAndPopulateOrder(order._id);
    res.locals.updated = populated;
    res.locals.auditUser = req.user.sub;

    try { await notificationService.sendOrderNotification('statusChanged', populated, populated.buyer || req.user); } catch (e) { console.error('Notify buyer failed', e); }

    res.json(populated);
  } catch (err) {
    next(err);
  }
});

/* ===== DELETE order (admin only) ===== */
exports.deleteOrder = withAudit('Order', 'DELETE', async (req, res, next) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json({ message: 'Forbidden' });
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.locals.auditUser = req.user.sub;
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
