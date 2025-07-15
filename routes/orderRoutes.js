// routes/orderRoutes.js

const express = require('express');
const router = express.Router();
const orderCtl = require('../controllers/orderController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Orders
 *   description: Order processing and management
 */

/**
 * @swagger
 * /orders:
 *   get:
 *     summary: List orders (buyer sees own; admin sees all)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of orders
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Order'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get(
  '/',
  requireAuth,
  orderCtl.listOrders
);

/**
 * @swagger
 * /orders/{id}:
 *   get:
 *     summary: Get an order by ID
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID
 *     responses:
 *       200:
 *         description: Order data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Forbidden – not the buyer or admin
 *       404:
 *         description: Order not found
 */
router.get(
  '/:id',
  requireAuth,
  orderCtl.getOrder
);

/**
 * @swagger
 * /orders:
 *   post:
 *     summary: Create a new order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: Order payload including items and delivery info
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - items
 *               - deliveryMethod
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - product
 *                     - qty
 *                   properties:
 *                     product:
 *                       type: string
 *                       description: Product ID
 *                     qty:
 *                       type: integer
 *                       description: Quantity to order
 *               deliveryMethod:
 *                 type: string
 *                 enum: [pickup, thirdParty]
 *               pickupInfo:
 *                 type: object
 *                 properties:
 *                   timeSlot:
 *                     type: string
 *                     format: date-time
 *                   location:
 *                     type: object
 *                     properties:
 *                       type:
 *                         type: string
 *                         enum: [Point]
 *                       coordinates:
 *                         type: array
 *                         items:
 *                           type: number
 *                         description: [lng, lat]
 *               thirdPartyInfo:
 *                 type: object
 *                 properties:
 *                   partnerOrderId:
 *                     type: string
 *                   eta:
 *                     type: string
 *                     format: date-time
 *                   cost:
 *                     type: number
 *     responses:
 *       201:
 *         description: Created order
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       400:
 *         description: Invalid items or insufficient stock
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post(
  '/',
  requireAuth,
  orderCtl.createOrder    // already wrapped withAudit inside controller
);

/**
 * @swagger
 * /orders/{id}/status:
 *   patch:
 *     summary: Update order status (farmer or admin)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID
 *     requestBody:
 *       description: New status for the order
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, accepted, rejected, ready, in_transit, delivered, cancelled]
 *     responses:
 *       200:
 *         description: Updated order
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Forbidden – not authorized to update
 *       404:
 *         description: Order not found
 */
router.patch(
  '/:id/status',
  requireAuth,
  orderCtl.updateOrderStatus  // withAudit inside controller
);

/**
 * @swagger
 * /orders/{id}:
 *   delete:
 *     summary: Delete an order (admin only)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID
 *     responses:
 *       204:
 *         description: Order deleted
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Forbidden – admin only
 *       404:
 *         description: Order not found
 */
router.delete(
  '/:id',
  requireAuth,
  requireAdmin,
  orderCtl.deleteOrder       // withAudit inside controller
);

module.exports = router;
