const ProductCategory = require('../models/ProductCategory');
const withAudit = require('../utils/withAudit');

/**
 * CREATE → audit CREATE
 * POST /api/product-categories
 */
exports.createProductCategory = withAudit('ProductCategory', 'CREATE', async (req, res, next) => {
  try {
    const { categoryName } = req.body;

    const exists = await ProductCategory.findOne({ categoryName: categoryName.trim() });
    if (exists) {
      return res.status(400).json({ message: 'Category already exists' });
    }

    let category = await ProductCategory.create({
      categoryName: categoryName.trim(),
      createdBy: req.user.sub,
      lastUpdatedBy: req.user.sub
    });

    category = await category.populate([
      { path: 'createdBy', select: 'firstName lastName email' },
      { path: 'lastUpdatedBy', select: 'firstName lastName email' }
    ]);

    // Audit locals
    res.locals.created = category;
    res.locals.auditUser = req.user.sub;

    res.status(201).json(category);
  } catch (err) {
    next(err);
  }
});

/**
 * GET ALL
 * GET /api/product-categories
 */
exports.getAllProductCategories = async (req, res, next) => {
  try {
    const categories = await ProductCategory.find()
      .populate('createdBy', 'firstName lastName email')
      .populate('lastUpdatedBy', 'firstName lastName email')
      .lean();

    res.json(categories);
  } catch (err) {
    next(err);
  }
};

/**
 * GET ONE
 * GET /api/product-categories/:id
 */
exports.getProductCategoryById = async (req, res, next) => {
  try {
    const category = await ProductCategory.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email')
      .populate('lastUpdatedBy', 'firstName lastName email')
      .lean();

    if (!category) {
      return res.status(404).json({ message: 'ProductCategory not found' });
    }

    res.json(category);
  } catch (err) {
    next(err);
  }
};

/**
 * UPDATE → audit UPDATE
 * PATCH /api/product-categories/:id
 */
exports.updateProductCategory = withAudit('ProductCategory', 'UPDATE', async (req, res, next) => {
  try {
    const { categoryName } = req.body;

    const category = await ProductCategory.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'ProductCategory not found' });
    }

    if (categoryName) {
      const exists = await ProductCategory.findOne({ categoryName: categoryName.trim(), _id: { $ne: req.params.id } });
      if (exists) {
        return res.status(400).json({ message: 'Category name already exists' });
      }
      category.categoryName = categoryName.trim();
    }

    category.lastUpdatedBy = req.user.sub;
    await category.save();

    const populated = await category.populate([
      { path: 'createdBy', select: 'firstName lastName email' },
      { path: 'lastUpdatedBy', select: 'firstName lastName email' }
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
 * DELETE /api/product-categories/:id
 */
exports.deleteProductCategory = withAudit('ProductCategory', 'DELETE', async (req, res, next) => {
  try {
    const category = await ProductCategory.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email')
      .populate('lastUpdatedBy', 'firstName lastName email');

    if (!category) {
      return res.status(404).json({ message: 'ProductCategory not found' });
    }

    await category.deleteOne();

    // Audit locals
    res.locals.auditUser = req.user.sub;

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
