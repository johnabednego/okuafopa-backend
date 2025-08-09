const ProductItem = require('../models/ProductItem');
const ProductCategory = require('../models/ProductCategory');
const withAudit = require('../utils/withAudit');

/**
 * CREATE → audit CREATE
 * POST /api/product-items
 */
exports.createProductItem = withAudit('ProductItem', 'CREATE', async (req, res, next) => {
  try {
    const { productName, category } = req.body;

    // Validate category
    const categoryExists = await ProductCategory.findById(category);
    if (!categoryExists) {
      return res.status(404).json({ message: 'Category not found' });
    }

    let productItem = await ProductItem.create({
      productName,
      category,
      createdBy: req.user.sub,
      lastUpdatedBy: req.user.sub
    });

    productItem = await productItem.populate([
      { path: 'category', select: 'categoryName' },
      { path: 'createdBy', select: 'firstName lastName email' }
    ]);

    // Audit locals
    res.locals.created = productItem;
    res.locals.auditUser = req.user.sub;

    res.status(201).json(productItem);
  } catch (err) {
    next(err);
  }
});

/**
 * GET ALL
 * GET /api/product-items
 */
exports.getAllProductItems = async (req, res, next) => {
  try {
    const { category } = req.query;
    const filter = category ? { category } : {};

    const items = await ProductItem.find(filter)
      .populate('category', 'categoryName')
      .populate('createdBy', 'firstName lastName email')
      .lean();

    res.json(items);
  } catch (err) {
    next(err);
  }
};

/**
 * GET ONE
 * GET /api/product-items/:id
 */
exports.getProductItemById = async (req, res, next) => {
  try {
    const item = await ProductItem.findById(req.params.id)
      .populate('category', 'categoryName')
      .populate('createdBy', 'firstName lastName email')
      .lean();

    if (!item) {
      return res.status(404).json({ message: 'ProductItem not found' });
    }

    res.json(item);
  } catch (err) {
    next(err);
  }
};

/**
 * UPDATE → audit UPDATE
 * PATCH /api/product-items/:id
 */
exports.updateProductItem = withAudit('ProductItem', 'UPDATE', async (req, res, next) => {
  try {
    const { productName, category } = req.body;

    const productItem = await ProductItem.findById(req.params.id);
    if (!productItem) {
      return res.status(404).json({ message: 'ProductItem not found' });
    }

    // Validate category if provided
    if (category) {
      const categoryExists = await ProductCategory.findById(category);
      if (!categoryExists) {
        return res.status(404).json({ message: 'Category not found' });
      }
      productItem.category = category;
    }

    if (productName) {
      productItem.productName = productName;
    }

    productItem.lastUpdatedBy = req.user.sub;
    await productItem.save();

    const populated = await productItem.populate([
      { path: 'category', select: 'categoryName' },
      { path: 'createdBy', select: 'firstName lastName email' }
    ]);

    // Audit locals
    res.locals.updated = populated;
    res.locals.auditUser = req.user.sub;

    res.json(populated);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE → audit DELETE
 * DELETE /api/product-items/:id
 */
exports.deleteProductItem = withAudit('ProductItem', 'DELETE', async (req, res, next) => {
  try {
    const productItem = await ProductItem.findById(req.params.id)
      .populate('category', 'categoryName')
      .populate('createdBy', 'firstName lastName email');

    if (!productItem) {
      return res.status(404).json({ message: 'ProductItem not found' });
    }

    await productItem.deleteOne();

    // Audit locals
    res.locals.auditUser = req.user.sub;

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
