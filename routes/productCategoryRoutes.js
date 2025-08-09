const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const controller = require('../controllers/productCategoryController');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: ProductCategories
 *   description: Manage product categories
 */

/**
 * @swagger
 * /product-categories:
 *   get:
 *     summary: Get all product categories
 *     tags: [ProductCategories]
 *     responses:
 *       200:
 *         description: List of product categories
 *   post:
 *     summary: Create a new product category
 *     tags: [ProductCategories]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [categoryName]
 *             properties:
 *               categoryName:
 *                 type: string
 *                 example: Vegetables
 *     responses:
 *       201:
 *         description: Product category created
 */
router.route('/')
  .get(controller.getAllProductCategories)
  .post(requireAuth, requireAdmin, controller.createProductCategory);

/**
 * @swagger
 * /product-categories/{id}:
 *   get:
 *     summary: Get a product category by ID
 *     tags: [ProductCategories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The category ID
 *     responses:
 *       200:
 *         description: Product category details
 *   patch:
 *     summary: Update a product category
 *     tags: [ProductCategories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               categoryName:
 *                 type: string
 *                 example: Fruits
 *     responses:
 *       200:
 *         description: Updated product category
 *   delete:
 *     summary: Delete a product category
 *     tags: [ProductCategories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Product category deleted
 */
router.route('/:id')
  .get(controller.getProductCategoryById)
  .patch(requireAuth, requireAdmin, controller.updateProductCategory)
  .delete(requireAuth, requireAdmin, controller.deleteProductCategory);

module.exports = router;
