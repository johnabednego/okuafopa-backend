// const express = require('express');
// const router = express.Router();
// const productCtl = require('../controllers/productController');
// const { requireAuth } = require('../middleware/auth');
// const withAudit = require('../utils/withAudit');

// /**
//  * @swagger
//  * tags:
//  *   name: Products
//  *   description: Product listings and management
//  */

// /**
//  * @swagger
//  * /products:
//  *   get:
//  *     summary: List all products (or only yours if ?farmer=me)
//  *     tags: [Products]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: query
//  *         name: page
//  *         schema:
//  *           type: integer
//  *           default: 1
//  *         description: Page number
//  *       - in: query
//  *         name: limit
//  *         schema:
//  *           type: integer
//  *           default: 20
//  *         description: Items per page
//  *       - in: query
//  *         name: category
//  *         schema:
//  *           type: string
//  *         description: Filter by category
//  *       - in: query
//  *         name: minPrice
//  *         schema:
//  *           type: number
//  *         description: Minimum price
//  *       - in: query
//  *         name: maxPrice
//  *         schema:
//  *           type: number
//  *         description: Maximum price
//  *       - in: query
//  *         name: farmer
//  *         schema:
//  *           type: string
//  *         description: Use "me" to list your own products, or a specific farmer ID
//  *     responses:
//  *       200:
//  *         description: A paginated list of products
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 page:
//  *                   type: integer
//  *                 limit:
//  *                   type: integer
//  *                 total:
//  *                   type: integer
//  *                 data:
//  *                   type: array
//  *                   items:
//  *                     $ref: '#/components/schemas/Product'
//  *       401:
//  *         $ref: '#/components/responses/Unauthorized'
//  */
// router.get('/', requireAuth, productCtl.listProducts);

// /**
//  * @swagger
//  * /products/{id}:
//  *   get:
//  *     summary: Get a product by ID
//  *     tags: [Products]
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema:
//  *           type: string
//  *         description: Product ID
//  *     responses:
//  *       200:
//  *         description: Product data
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Product'
//  *       404:
//  *         description: Product not found
//  */
// router.get('/:id', productCtl.getProduct);

// /**
//  * @swagger
//  * /products:
//  *   post:
//  *     summary: Create a new product listing
//  *     tags: [Products]
//  *     security:
//  *       - bearerAuth: []
//  *     requestBody:
//  *       description: Product data
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             required:
//  *               - title
//  *               - price
//  *               - quantity
//  *             properties:
//  *               title:
//  *                 type: string
//  *               description:
//  *                 type: string
//  *               price:
//  *                 type: number
//  *               quantity:
//  *                 type: integer
//  *               images:
//  *                 type: array
//  *                 items:
//  *                   type: string
//  *                 description: URLs of images
//  *               category:
//  *                 type: string
//  *               deliveryOptions:
//  *                 type: object
//  *                 properties:
//  *                   pickup:
//  *                     type: boolean
//  *                   thirdParty:
//  *                     type: boolean
//  *     responses:
//  *       201:
//  *         description: Created product
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Product'
//  *       401:
//  *         $ref: '#/components/responses/Unauthorized'
//  */
// router.post(
//   '/',
//   requireAuth,
//   withAudit('Product', 'CREATE', productCtl.createProduct)
// );

// /**
//  * @swagger
//  * /products/{id}:
//  *   patch:
//  *     summary: Update a product (owner only)
//  *     tags: [Products]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema:
//  *           type: string
//  *         description: Product ID
//  *     requestBody:
//  *       description: Fields to update
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             properties:
//  *               title:
//  *                 type: string
//  *               description:
//  *                 type: string
//  *               price:
//  *                 type: number
//  *               quantity:
//  *                 type: integer
//  *               images:
//  *                 type: array
//  *                 items:
//  *                   type: string
//  *               category:
//  *                 type: string
//  *               deliveryOptions:
//  *                 type: object
//  *                 properties:
//  *                   pickup:
//  *                     type: boolean
//  *                   thirdParty:
//  *                     type: boolean
//  *     responses:
//  *       200:
//  *         description: Updated product
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Product'
//  *       401:
//  *         $ref: '#/components/responses/Unauthorized'
//  *       404:
//  *         description: Product not found or unauthorized
//  */
// router.patch(
//   '/:id',
//   requireAuth,
//   withAudit('Product', 'UPDATE', productCtl.updateProduct)
// );

// /**
//  * @swagger
//  * /products/{id}:
//  *   delete:
//  *     summary: Delete a product (owner only)
//  *     tags: [Products]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema:
//  *           type: string
//  *         description: Product ID
//  *     responses:
//  *       204:
//  *         description: Product deleted
//  *       401:
//  *         $ref: '#/components/responses/Unauthorized'
//  *       404:
//  *         description: Product not found or unauthorized
//  */
// router.delete(
//   '/:id',
//   requireAuth,
//   withAudit('Product', 'DELETE', productCtl.deleteProduct)
// );

// module.exports = router;
