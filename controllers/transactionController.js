const Transaction = require('../models/Transaction');
const Order       = require('../models/Order');
const withAudit   = require('../utils/withAudit');

exports.createTransaction = withAudit('Transaction', 'CREATE', async (req, res, next) => {
  try {
    const { orderId, details } = req.body;

    // Dynamically import nanoid
    const { customAlphabet } = await import('nanoid');
    const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 10);

    // rest of your logic...
    const order = await Order.findById(orderId).lean();
    if (!order) return res.status(400).json({ message: 'Order not found' });
    if (await Transaction.exists({ order: orderId })) {
      return res.status(400).json({ message: 'Invoice already exists' });
    }

    const amount = req.body.amount != null
      ? Number(req.body.amount)
      : order.items.reduce((sum, it) => sum + it.qty * it.priceAtOrder, 0);

    const invoiceNumber = `INV-${nanoid()}`;

    const txn = await Transaction.create({
      order:        orderId,
      invoiceNumber,
      amount,
      details,
      lastUpdatedBy: req.user.sub
    });

    res.locals.created   = txn;
    res.locals.auditUser = req.user.sub;

    return res.status(201).json(txn);
  } catch (err) {
    next(err);
  }
});


/**
 * GET /api/transactions
 * List all invoices (admin only)
 */
exports.listTransactions = async (req, res, next) => {
  try {
    const txns = await Transaction.find()
      .populate('order', 'status buyer')
      .lean();
    res.json(txns);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/transactions/:id
 */
exports.getTransaction = async (req, res, next) => {
  try {
    const txn = await Transaction.findById(req.params.id)
      .populate({
        path: 'order',
        select: 'status buyer items',
        populate: { path: 'items.product', select: 'title price' }
      })
      .lean();
    if (!txn) return res.status(404).json({ message: 'Transaction not found' });
    res.json(txn);
  } catch (err) {
    next(err);
  }
};

/**
 * UPDATE → audit UPDATE
 * PATCH /api/transactions/:id
 */
exports.updateTransaction = withAudit('Transaction', 'UPDATE', async (req, res, next) => {
  try {
    const updates = {};
    if (req.body.amount != null) updates.amount = Number(req.body.amount);
    if (req.body.details !== undefined) updates.details = req.body.details;
    updates.lastUpdatedBy = req.user.sub;

    const txn = await Transaction.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!txn) return res.status(404).json({ message: 'Transaction not found' });

    res.locals.updated   = txn;
    res.locals.auditUser = req.user.sub;

    res.json(txn);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE → audit DELETE
 * DELETE /api/transactions/:id
 * (admin only)
 */
exports.deleteTransaction = withAudit('Transaction', 'DELETE', async (req, res, next) => {
  try {
    const txn = await Transaction.findByIdAndDelete(req.params.id);
    if (!txn) return res.status(404).json({ message: 'Transaction not found' });

    res.locals.auditUser = req.user.sub;

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
