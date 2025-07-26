const Product = require('../models/Product');
const notificationService = require('../services/emailService');
const withAudit = require('../utils/withAudit');

/**
 * CREATE → audit CREATE
 * POST /api/products
 */
exports.createProduct = withAudit('Product', 'CREATE', async (req, res, next) => {
  try {
    const data = {
      ...req.body,
      farmer: req.user.sub,
      lastUpdatedBy: req.user.sub
    };

    const prod = await Product.create(data);

    // Let withAudit know what was created
    res.locals.created   = prod;
    res.locals.auditUser = req.user.sub;

    // Notify the farmer
    await notificationService.sendProductNotification(
      'created',
      prod,
      { email: req.user.email, firstName: req.user.firstName, lastName: req.user.lastName }
    );

    res.status(201).json(prod);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/products/:id
 * (no audit on reads)
 */
exports.getProduct = async (req, res, next) => {
  try {
    const prod = await Product.findById(req.params.id)
      .populate('farmer', 'firstName lastName email')
      .lean();
    if (!prod) return res.status(404).json({ message: 'Product not found' });
    res.json(prod);
  } catch (err) {
    next(err);
  }
};

/**
 * UPDATE → audit UPDATE
 * PATCH /api/products/:id
 */
exports.updateProduct = withAudit('Product', 'UPDATE', async (req, res, next) => {
  try {
    const updates = { ...req.body, lastUpdatedBy: req.user.sub };

    // Capture before-state is done by withAudit
    const prod = await Product.findOneAndUpdate(
      { _id: req.params.id, farmer: req.user.sub },
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!prod) return res.status(404).json({ message: 'Product not found or unauthorized' });

    // Let withAudit know what was updated
    res.locals.updated   = prod;
    res.locals.auditUser = req.user.sub;

    // Notify the farmer
    await notificationService.sendProductNotification(
      'updated',
      prod,
      { email: req.user.email, firstName: req.user.firstName, lastName: req.user.lastName }
    );

    res.json(prod);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE → audit DELETE
 * DELETE /api/products/:id
 */
exports.deleteProduct = withAudit('Product', 'DELETE', async (req, res, next) => {
  try {
    // withAudit has already fetched `before` into res.locals.before
    const prod = await Product.findOneAndDelete({
      _id: req.params.id,
      farmer: req.user.sub
    });
    if (!prod) return res.status(404).json({ message: 'Product not found or unauthorized' });

    // Optionally notify the farmer
    await notificationService.sendProductNotification(
      'deleted',
      prod,
      { email: req.user.email, firstName: req.user.firstName, lastName: req.user.lastName }
    );

    // Let withAudit know who did it
    res.locals.auditUser = req.user.sub;

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

/**
 * LIST /api/products
 * (no audit on reads)
 */
exports.listProducts = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, category, minPrice, maxPrice, farmer } = req.query;
    const filter = {};
    // Handle farmer query
    if (farmer === 'me') {
      filter.farmer = req.user.sub;  // from JWT
    } else if (farmer) {
      filter.farmer = farmer;  // specific user ID
    } else {
      filter.isActive = true;  // buyers see only active listings
    }

    // Filters
    if (category) filter.category = category;
    if (minPrice) filter.price = { ...filter.price, $gte: Number(minPrice) };
    if (maxPrice) filter.price = { ...filter.price, $lte: Number(maxPrice) };

    const [items, total] = await Promise.all([
      Product.find(filter)
        .sort('-createdAt')
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
      Product.countDocuments(filter)
    ]);

    res.json({
      page: Number(page),
      limit: Number(limit),
      total,
      data: items
    });
  } catch (err) {
    next(err);
  }
};
