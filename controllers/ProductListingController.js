const ProductListing = require('../models/ProductListing');
const ProductItem = require('../models/ProductItem');
const notificationService = require('../services/emailService');
const withAudit = require('../utils/withAudit');

/**
 * CREATE → audit CREATE
 * POST /api/product-listings
 */
exports.createProductListing = withAudit('ProductListing', 'CREATE', async (req, res, next) => {
  try {
    const { productItem, price, quantity } = req.body;

    // Validation: ensure productItem exists
    const item = await ProductItem.findById(productItem).populate('category');
    if (!item) {
      return res.status(400).json({ message: 'Invalid productItem ID' });
    }

    // Validation: basic price/quantity
    if (price <= 0 || quantity < 0) {
      return res.status(400).json({ message: 'Price must be > 0 and quantity >= 0' });
    }

    const data = {
      ...req.body,
      farmer: req.user.sub,
      lastUpdatedBy: req.user.sub
    };

    let prod = await ProductListing.create(data);
    prod = await prod.populate([
      { path: 'productItem', populate: { path: 'category', select: 'categoryName' }, select: 'productName' },
      { path: 'farmer', select: 'firstName lastName email' }
    ]);

    // Audit
    res.locals.created = prod;
    res.locals.auditUser = req.user.sub;

    // Notify the farmer
    await notificationService.sendProductListingNotification(
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
 * GET /api/product-listings/:id
 */
exports.getProductListing = async (req, res, next) => {
  try {
    const prod = await ProductListing.findById(req.params.id)
      .populate({
        path: 'productItem',
        populate: { path: 'category', select: 'categoryName' },
        select: 'productName'
      })
      .populate('farmer', 'firstName lastName email')
      .lean();

    if (!prod) {
      return res.status(404).json({ message: 'ProductListing not found' });
    }
    res.json(prod);
  } catch (err) {
    next(err);
  }
};

/**
 * UPDATE → audit UPDATE
 * PATCH /api/product-listings/:id
 */
exports.updateProductListing = withAudit('ProductListing', 'UPDATE', async (req, res, next) => {
  try {
    const { productItem, price, quantity } = req.body;

    // Optional: validate new productItem
    if (productItem) {
      const item = await ProductItem.findById(productItem);
      if (!item) {
        return res.status(400).json({ message: 'Invalid productItem ID' });
      }
    }

    if (price !== undefined && price <= 0) {
      return res.status(400).json({ message: 'Price must be > 0' });
    }

    if (quantity !== undefined && quantity < 0) {
      return res.status(400).json({ message: 'Quantity must be >= 0' });
    }

    const updates = { ...req.body, lastUpdatedBy: req.user.sub };

    let prod = await ProductListing.findOneAndUpdate(
      { _id: req.params.id, farmer: req.user.sub },
      { $set: updates },
      { new: true, runValidators: true }
    ).populate([
      { path: 'productItem', populate: { path: 'category', select: 'categoryName' }, select: 'productName' },
      { path: 'farmer', select: 'firstName lastName email' }
    ]);

    if (!prod) {
      return res.status(404).json({ message: 'ProductListing not found or unauthorized' });
    }

    // Audit
    res.locals.updated = prod;
    res.locals.auditUser = req.user.sub;

    await notificationService.sendProductListingNotification(
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
 * DELETE /api/product-listings/:id
 */
exports.deleteProductListing = withAudit('ProductListing', 'DELETE', async (req, res, next) => {
  try {
    const prod = await ProductListing.findOneAndDelete({
      _id: req.params.id,
      farmer: req.user.sub
    }).populate([
      { path: 'productItem', populate: { path: 'category', select: 'categoryName' }, select: 'productName' },
      { path: 'farmer', select: 'firstName lastName email' }
    ]);

    if (!prod) {
      return res.status(404).json({ message: 'ProductListing not found or unauthorized' });
    }

    await notificationService.sendProductListingNotification(
      'deleted',
      prod,
      { email: req.user.email, firstName: req.user.firstName, lastName: req.user.lastName }
    );

    // Audit
    res.locals.auditUser = req.user.sub;

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

/**
 * LIST /api/product-listings
 */
exports.listProductListings = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, category, minPrice, maxPrice, farmer } = req.query;
    const filter = {};

    // Farmer filter
    if (farmer === 'me') {
      filter.farmer = req.user.sub;
    } else if (farmer) {
      filter.farmer = farmer;
    } else {
      filter.isActive = true; // public view
    }

    // Category filter (via productItem → category)
    if (category) {
      const itemsInCategory = await ProductItem.find({ category }).select('_id');
      filter.productItem = { $in: itemsInCategory.map(i => i._id) };
    }

    // Price filters
    if (minPrice) filter.price = { ...filter.price, $gte: Number(minPrice) };
    if (maxPrice) filter.price = { ...filter.price, $lte: Number(maxPrice) };

    const [items, total] = await Promise.all([
      ProductListing.find(filter)
        .sort('-createdAt')
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .populate([
          { path: 'productItem', populate: { path: 'category', select: 'categoryName' }, select: 'productName' },
          { path: 'farmer', select: 'firstName lastName email' }
        ])
        .lean(),
      ProductListing.countDocuments(filter)
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
