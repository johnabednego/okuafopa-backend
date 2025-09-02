const Order = require('../models/Order');
const ProductListing = require('../models/ProductListing');
const notificationService = require('../services/emailService');
const withAudit = require('../utils/withAudit');

/**
 * Utility → derive status of a SubOrder from its items
 */
function deriveSubOrderStatus(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return 'pending'; // or your desired default
  }

  const statuses = items.map(it => it.itemStatus);

  if (statuses.every(s => s === 'delivered')) return 'delivered';
  if (statuses.every(s => s === 'cancelled')) return 'cancelled';

  if (statuses.includes('in_transit') || statuses.includes('ready') || statuses.includes('accepted')) {
    return 'in_progress';
  }

  if (statuses.includes('delivered') && statuses.some(s => s !== 'delivered')) {
    return 'partially_delivered';
  }

  if (statuses.every(s => s === 'pending')) return 'pending';

  return 'in_progress';
}


/**
 * Utility → derive global Order status from subOrders
 */
function deriveOrderStatus(subOrders) {
  if (!Array.isArray(subOrders) || subOrders.length === 0) {
    return 'pending'; // or whatever your default should be
  }

  const statuses = subOrders.map(so => so.status);

  if (statuses.every(s => s === 'delivered')) return 'delivered';
  if (statuses.every(s => s === 'cancelled')) return 'cancelled';
  if (statuses.includes('delivered') && statuses.some(s => s !== 'delivered')) {
    return 'partially_delivered';
  }
  if (statuses.every(s => s === 'pending')) return 'pending';

  return 'in_progress';
}

/**
 * CREATE → audit CREATE
 * POST /api/orders
 */
exports.createOrder = withAudit('Order', 'CREATE', async (req, res, next) => {
  try {
    const { subOrders } = req.body;
    let grandTotal = 0;

    // validate & compute
    for (let so of subOrders) {
      let subtotal = 0;

      for (let it of so.items) {
        // Populate productItem to access productName
        const prod = await ProductListing.findById(it.product)
          .populate("productItem", "productName")
          .lean();

        if (!prod) {
          return res.status(400).json({ message: `Product ${it.product} not found` });
        }

        if (it.qty > prod.quantity) {
          return res.status(400).json({
            message: `Only ${prod.quantity} ${prod?.productItem?.productName || "items"} available, but you requested ${it.qty}.`,
            available: prod.quantity,
            requested: it.qty,
            product: prod?.productItem?.productName || "Unknown product"
          });
        }

        subtotal += prod.price * it.qty;
        it.priceAtOrder = prod.price;

        // decrement stock
        await ProductListing.findByIdAndUpdate(prod._id, {
          $inc: { quantity: -it.qty }
        });
      }

      so.subtotal = subtotal;
      so.status = deriveSubOrderStatus(so.items);
      grandTotal += subtotal;
    }

    const data = {
      buyer: req.user.sub,
      subOrders,
      grandTotal,
      lastUpdatedBy: req.user.sub
    };

    // derive global status from subOrders
    data.status = deriveOrderStatus(subOrders);

    const order = await Order.create(data);

    // ✅ When fetching order, also populate productItem for productName
    const orderItem = await Order.findById(order?._id)
      .populate({
        path: "subOrders.items.product",
        populate: {
          path: "productItem",
          select: "productName"
        },
        select: "price images"
      })
      .populate("buyer", "firstName lastName email");

    res.locals.created = order;
    res.locals.auditUser = req.user.sub;

    await notificationService.sendOrderNotification('created', orderItem, req.user);

    res.status(201).json(orderItem); // ✅ return populated order
  } catch (err) {
    next(err);
  }
});


/**
 * GET /api/orders
 */
exports.listOrders = async (req, res, next) => {
  try {
    const filter = {};
    if (!req.user.isAdmin) filter.buyer = req.user.sub;

    const orders = await Order.find(filter)
      .populate('buyer', 'firstName lastName email')
      .populate('subOrders.items.product', 'title images')
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
      .populate('subOrders.items.product', 'title images price')
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

exports.updateOrderStatus = withAudit('Order', 'UPDATE', async (req, res, next) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const { status } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    order.status = status;
    order.lastUpdatedBy = req.user.sub;

    await order.save();

    res.locals.updated = order;
    res.locals.auditUser = req.user.sub;

    const orderItem = await Order.findById(order?._id)
      .populate({
        path: "subOrders.items.product",
        select: "title price images"
      })
      .populate("buyer", "firstName lastName email");

    await notificationService.sendOrderNotification('statusChanged', orderItem, order.buyer);

    res.json(order);
  } catch (err) {
    next(err);
  }
});


/**
 * PATCH → update status of subOrder or item
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

    // permissions: farmer of this subOrder or admin
    if (
      !req.user.isAdmin &&
      subOrder.farmer.toString() !== req.user.sub
    ) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    item.itemStatus = itemStatus;
    subOrder.status = deriveSubOrderStatus(subOrder.items);
    order.status = deriveOrderStatus(order.subOrders);
    order.lastUpdatedBy = req.user.sub;

    await order.save();

    res.locals.updated = order;
    res.locals.auditUser = req.user.sub;

    const orderItem = await Order.findById(order?._id)
      .populate({
        path: "subOrders.items.product",
        select: "title price images"
      })
      .populate("buyer", "firstName lastName email");

    await notificationService.sendOrderNotification('statusChanged', orderItem, order.buyer);

    res.json(order);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE → audit DELETE
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
