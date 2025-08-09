const express = require('express');
const router = express.Router();
const productItemController = require('../controllers/productItemController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: ProductItems
 *   description: Manage product items linked to categories
 */

/**
 * @swagger
 * /product-items:
 *   get:
 *     summary: Get all product items
 *     tags: [ProductItems]
 *     responses:
 *       200:
 *         description: List of all product items
 */
router.get('/', requireAuth, productItemController.getAllProductItems);

/**
 * @swagger
 * /product-items/{id}:
 *   get:
 *     summary: Get a product item by ID
 *     tags: [ProductItems]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ProductItem ID
 *     responses:
 *       200:
 *         description: Product item data
 *       404:
 *         description: Product item not found
 */
router.get('/:id', requireAuth, productItemController.getProductItemById);

/**
 * @swagger
 * /product-items:
 *   post:
 *     summary: Create a new product item
 *     tags: [ProductItems]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productName
 *               - category
 *             properties:
 *               productName:
 *                 type: string
 *               category:
 *                 type: string
 *     responses:
 *       201:
 *         description: Product item created successfully
 *       400:
 *         description: Validation error
 */
router.post('/', requireAuth, requireAdmin, productItemController.createProductItem);

/**
 * @swagger
 * /product-items/{id}:
 *   put:
 *     summary: Update a product item
 *     tags: [ProductItems]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               productName:
 *                 type: string
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Product item updated successfully
 *       404:
 *         description: Product item not found
 */
router.put('/:id', requireAuth, requireAdmin, productItemController.updateProductItem);

/**
 * @swagger
 * /product-items/{id}:
 *   delete:
 *     summary: Delete a product item
 *     tags: [ProductItems]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Product item deleted successfully
 *       404:
 *         description: Product item not found
 */
router.delete('/:id', requireAuth, requireAdmin, productItemController.deleteProductItem);

module.exports = router;
