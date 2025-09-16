const mongoose = require('mongoose');
const Joi = require('joi');

const Order = require('../models/Order');
const ProductListing = require('../models/ProductListing');
const User = require('../models/User');
const notificationService = require('../services/emailService');
const withAudit = require('../utils/withAudit');
const socketService = require('../services/socket'); // socket helper

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

/* ===== allowed item statuses (server-side) ===== */
const ALLOWED_ITEM_STATUSES = ['pending', 'accepted', 'rejected', 'ready', 'in_transit', 'delivered', 'cancelled'];

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

/* ===== Socket emit helpers ===== */
async function safeEmitToBuyerAndFarmers(populated) {
  try {
    const io = socketService.getIo();
    if (!io) return;
    if (populated?.buyer?._id) {
      io.to(`buyer:${String(populated.buyer._id)}`).emit('order:created', populated);
    }
    if (Array.isArray(populated.subOrders)) {
      for (const so of populated.subOrders) {
        const farmerId = so.farmer && (typeof so.farmer === 'object' ? so.farmer._id : so.farmer);
        if (farmerId) {
          io.to(`farmer:${String(farmerId)}`).emit('suborder:created', { orderId: populated._id, subOrder: so });
        }
      }
    }
  } catch (e) {
    console.error('Emit after order created failed', e);
  }
}

async function safeEmitOrderUpdate(populated, subOrder = null) {
  try {
    const io = socketService.getIo();
    if (!io) return;
    if (populated?.buyer?._id) {
      io.to(`buyer:${String(populated.buyer._id)}`).emit('order:update', populated);
    }
    // if subOrder param provided, emit targeted update to farmer
    if (subOrder) {
      const farmerId = subOrder.farmer && (typeof subOrder.farmer === 'object' ? subOrder.farmer._id : subOrder.farmer);
      if (farmerId) {
        io.to(`farmer:${String(farmerId)}`).emit('suborder:update', { orderId: populated._id, subOrderId: subOrder._id, subOrder });
      }
    } else if (Array.isArray(populated.subOrders)) {
      // otherwise, notify all farmers included
      for (const so of populated.subOrders) {
        const farmerId = so.farmer && (typeof so.farmer === 'object' ? so.farmer._id : so.farmer);
        if (farmerId) {
          io.to(`farmer:${String(farmerId)}`).emit('suborder:update', { orderId: populated._id, subOrderId: so._id, subOrder: so });
        }
      }
    }
  } catch (e) {
    console.error('Emit order update failed', e);
  }
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

    // Notify buyer (best-effort)
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

    // Emit socket events (best-effort, non-blocking)
    try {
      await safeEmitToBuyerAndFarmers(populated);
    } catch (e) {
      console.error('Socket emit failed after createOrder', e);
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

    const userId = req.user.sub;
    const isAdmin = !!req.user.isAdmin;
    const isFarmer = req.user.role === 'farmer';

    if (isAdmin) {
      // no filter
    } else if (isFarmer) {
      // IMPORTANT: use `new mongoose.Types.ObjectId(...)` (not calling ObjectId as function)
      filter['subOrders.farmer'] = new mongoose.Types.ObjectId(userId);
    } else {
      filter.buyer = new mongoose.Types.ObjectId(userId);
    }

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

    const userId = req.user.sub;
    const isAdmin = !!req.user.isAdmin;
    const isFarmer = req.user.role === 'farmer';

    if (!isAdmin) {
      if (isFarmer) {
        const has = Array.isArray(order.subOrders) && order.subOrders.some(so => {
          const f = so.farmer;
          if (!f) return false;
          return (typeof f === 'object' ? String(f._id) === String(userId) : String(f) === String(userId));
        });
        if (!has) return res.status(403).json({ message: 'Forbidden' });
      } else {
        if (String(order.buyer._id) !== String(userId)) {
          return res.status(403).json({ message: 'Forbidden' });
        }
      }
    }

    res.json(order);
  } catch (err) {
    next(err);
  }
};

/* ===== NEW: Get only subOrders for current farmer (lightweight) =====
   GET /orders/farmer/subOrders
   - returns orders but each order.subOrders array contains only subOrders for the farmer
   - we populate product listings (images, price, productItem) client-side after aggregation
*/
exports.getFarmerSubOrders = async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const objId = new mongoose.Types.ObjectId(userId);

    // first get aggregated docs with only the farmer's subOrders (no product details yet)
    const docs = await Order.aggregate([
      { $match: { 'subOrders.farmer': objId } },
      {
        $project: {
          _id: 1,
          createdAt: 1,
          updatedAt: 1,
          buyer: 1,
          subOrders: {
            $filter: {
              input: '$subOrders',
              as: 'so',
              cond: { $eq: ['$$so.farmer', objId] }
            }
          },
          grandTotal: 1,
          status: 1
        }
      },
      { $sort: { createdAt: -1 } }
    ]);

    // collect unique product ids from all items (strings)
    const productIdSet = new Set();
    for (const doc of docs) {
      if (!Array.isArray(doc.subOrders)) continue;
      for (const so of doc.subOrders) {
        if (!Array.isArray(so.items)) continue;
        for (const it of so.items) {
          if (!it || !it.product) continue;
          // product might already be ObjectId or string; normalize to string
          productIdSet.add(String(it.product));
        }
      }
    }
    const productIds = Array.from(productIdSet);

    // fetch product listings in one query and populate productItem
    let productsById = {};
    if (productIds.length) {
      const products = await ProductListing.find({ _id: { $in: productIds } })
        .select('price images productItem title quantity')
        .populate({ path: 'productItem', select: 'productName' })
        .lean();

      productsById = products.reduce((acc, p) => { acc[String(p._id)] = p; return acc; }, {});
    }

    // replace item.product id with full product doc when available
    const shaped = docs.map(d => {
      const copy = { ...d };
      copy.subOrders = (copy.subOrders || []).map(so => {
        const soCopy = { ...so };
        soCopy.items = (soCopy.items || []).map(it => {
          const itCopy = { ...it };
          const pid = String(itCopy.product);
          itCopy.product = productsById[pid] || itCopy.product;
          return itCopy;
        });
        return soCopy;
      });
      return copy;
    });

    // Optionally populate buyer info: lightweight mapping
    const buyerIds = [...new Set(shaped.map(d => d.buyer).filter(Boolean).map(String))];
    const buyers = buyerIds.length ? await User.find({ _id: { $in: buyerIds } }).select('firstName lastName email phoneNumber').lean() : [];
    const buyerById = buyers.reduce((acc, b) => { acc[String(b._id)] = b; return acc; }, {});

    const final = shaped.map(d => ({ ...d, buyer: buyerById[String(d.buyer)] || d.buyer }));
    res.json(final);
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

    // notify buyer & farmers
    try { await notificationService.sendOrderNotification('statusChanged', populated, populated.buyer || req.user); } catch (e) { console.error('Notify buyer failed', e); }
    try { await safeEmitOrderUpdate(populated); } catch (e) { console.error('Socket emit failed in updateOrderStatus', e); }

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

    if (!ALLOWED_ITEM_STATUSES.includes(itemStatus)) {
      return res.status(400).json({ message: 'Invalid itemStatus' });
    }

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const subOrder = order.subOrders.id(subOrderId);
    if (!subOrder) return res.status(404).json({ message: 'SubOrder not found' });

    const item = subOrder.items.id(itemId);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    // permissions: farmer of this subOrder or admin
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

    // notify buyer (best-effort)
    try { await notificationService.sendOrderNotification('statusChanged', populated, populated.buyer || req.user); } catch (e) { console.error('Notify buyer failed', e); }

    // emit socket update for this subOrder/item change
    try { await safeEmitOrderUpdate(populated, subOrder); } catch (e) { console.error('Socket emit failed in updateOrderItemStatus', e); }

    res.json(populated);
  } catch (err) {
    next(err);
  }
});

/* ===== Update subOrder-level status (farmer or admin) =====
   PATCH /api/orders/:orderId/subOrders/:subOrderId/status
   body: { status: 'accepted'|'rejected'|'ready'|'in_transit'|'delivered'|..., setItemsTo?: 'accepted'|'ready'|... }
*/
exports.updateSubOrderStatus = withAudit('Order', 'UPDATE', async (req, res, next) => {
  try {
    const { orderId, subOrderId } = req.params;
    const { status, setItemsTo } = req.body;

    if (!status) return res.status(400).json({ message: 'Missing status in body' });
    if (setItemsTo && !ALLOWED_ITEM_STATUSES.includes(setItemsTo)) {
      return res.status(400).json({ message: 'Invalid setItemsTo value' });
    }

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const subOrder = order.subOrders.id(subOrderId);
    if (!subOrder) return res.status(404).json({ message: 'SubOrder not found' });

    // permissions: farmer of this subOrder or admin
    if (!req.user.isAdmin && String(subOrder.farmer) !== String(req.user.sub)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // update subOrder.status
    subOrder.status = status;

    // optionally set every item status
    if (setItemsTo && Array.isArray(subOrder.items)) {
      subOrder.items.forEach(it => {
        it.itemStatus = setItemsTo;
      });
    }

    // recalc derived order status
    order.status = deriveOrderStatus(order.subOrders);
    order.lastUpdatedBy = req.user.sub;

    await order.save();

    const populated = await findAndPopulateOrder(order._id);
    res.locals.updated = populated;
    res.locals.auditUser = req.user.sub;

    // notify buyer and emit socket update
    try { await notificationService.sendOrderNotification('statusChanged', populated, populated.buyer || req.user); } catch (e) { console.error('Notify buyer failed', e); }
    try { await safeEmitOrderUpdate(populated, subOrder); } catch (e) { console.error('Emit failed in updateSubOrderStatus', e); }

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
