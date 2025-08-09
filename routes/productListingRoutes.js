const express = require('express');
const router = express.Router();
const listingCtl = require('../controllers/ProductListingController');
const { requireAuth } = require('../middleware/auth');
const withAudit = require('../utils/withAudit');

/**
 * @swagger
 * tags:
 *   name: Product Listings
 *   description: Farmer product listings and management
 */

/**
 * @swagger
 * /product-listings:
 *   get:
 *     summary: List all product listings (or only yours if ?farmer=me)
 *     tags: [Product Listings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category ID
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *         description: Minimum price
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         description: Maximum price
 *       - in: query
 *         name: farmer
 *         schema:
 *           type: string
 *         description: Use "me" for own listings or a specific farmer ID
 *     responses:
 *       200:
 *         description: Paginated product listings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 total:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ProductListing'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', requireAuth, listingCtl.listProductListings);

/**
 * @swagger
 * /product-listings/{id}:
 *   get:
 *     summary: Get a single product listing
 *     tags: [Product Listings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ProductListing ID
 *     responses:
 *       200:
 *         description: Product listing
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductListing'
 *       404:
 *         description: Not found
 */
router.get('/:id', listingCtl.getProductListing);

/**
 * @swagger
 * /product-listings:
 *   post:
 *     summary: Create a new product listing
 *     tags: [Product Listings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productItem
 *               - price
 *               - quantity
 *             properties:
 *               productItem:
 *                 type: string
 *                 description: ProductItem ID
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               quantity:
 *                 type: integer
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *               deliveryOptions:
 *                 type: object
 *                 properties:
 *                   pickup:
 *                     type: boolean
 *                   thirdParty:
 *                     type: boolean
 *     responses:
 *       201:
 *         description: Created listing
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductListing'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post(
  '/',
  requireAuth,
  withAudit('ProductListing', 'CREATE', listingCtl.createProductListing)
);

/**
 * @swagger
 * /product-listings/{id}:
 *   patch:
 *     summary: Update your product listing
 *     tags: [Product Listings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ProductListing ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               productItem:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               quantity:
 *                 type: integer
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *               deliveryOptions:
 *                 type: object
 *                 properties:
 *                   pickup:
 *                     type: boolean
 *                   thirdParty:
 *                     type: boolean
 *     responses:
 *       200:
 *         description: Updated listing
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductListing'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Not found or unauthorized
 */
router.patch(
  '/:id',
  requireAuth,
  withAudit('ProductListing', 'UPDATE', listingCtl.updateProductListing)
);

/**
 * @swagger
 * /product-listings/{id}:
 *   delete:
 *     summary: Delete your product listing
 *     tags: [Product Listings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ProductListing ID
 *     responses:
 *       204:
 *         description: Deleted
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Not found or unauthorized
 */
router.delete(
  '/:id',
  requireAuth,
  withAudit('ProductListing', 'DELETE', listingCtl.deleteProductListing)
);

module.exports = router;
