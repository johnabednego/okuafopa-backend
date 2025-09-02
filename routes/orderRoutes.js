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
 * components:
 *   schemas:
 *     OrderItem:
 *       type: object
 *       required:
 *         - product
 *         - qty
 *         - deliveryMethod
 *       properties:
 *         product:
 *           type: string
 *           description: Product ID
 *         farmer:
 *           type: string
 *           description: Farmer (seller) ID
 *         qty:
 *           type: integer
 *         priceAtOrder:
 *           type: number
 *         deliveryMethod:
 *           type: string
 *           enum: [pickup, thirdParty]
 *         pickupInfo:
 *           type: object
 *           properties:
 *             timeSlot:
 *               type: string
 *               format: date-time
 *             location:
 *               type: object
 *               properties:
 *                 type:
 *                   type: string
 *                   enum: [Point]
 *                 coordinates:
 *                   type: array
 *                   items:
 *                     type: number
 *                   description: [lng, lat]
 *         thirdPartyInfo:
 *           type: object
 *           properties:
 *             partnerOrderId:
 *               type: string
 *             eta:
 *               type: string
 *               format: date-time
 *             cost:
 *               type: number
 *         itemStatus:
 *           type: string
 *           enum: [pending, accepted, rejected, ready, in_transit, delivered, cancelled]
 *           default: pending
 *
 *     Order:
 *       type: object
 *       required:
 *         - buyer
 *         - items
 *         - subtotal
 *       properties:
 *         buyer:
 *           type: string
 *           description: Buyer user ID
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/OrderItem'
 *         subtotal:
 *           type: number
 *         status:
 *           type: string
 *           enum: [pending, in_progress, partially_delivered, delivered, cancelled]
 *           default: pending
 *         lastUpdatedBy:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
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
router.get('/', requireAuth, orderCtl.listOrders);

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
router.get('/:id', requireAuth, orderCtl.getOrder);

/**
 * @swagger
 * /orders:
 *   post:
 *     summary: Create a new order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: Order payload including items
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - items
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/OrderItem'
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
router.post('/', requireAuth, orderCtl.createOrder);

/**
 * @swagger
 * /orders/{id}/status:
 *   patch:
 *     summary: Update global order status (admin only; derived automatically otherwise)
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
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, in_progress, partially_delivered, delivered, cancelled]
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
router.patch('/:id/status', requireAuth, orderCtl.updateOrderStatus);

/**
 * @swagger
 * /orders/{orderId}/items/{itemId}/status:
 *   patch:
 *     summary: Update status of a specific order item (farmer or admin)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *         description: Parent Order ID
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *         description: Order Item ID
 *     requestBody:
 *       description: New status for the item
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - itemStatus
 *             properties:
 *               itemStatus:
 *                 type: string
 *                 enum: [pending, accepted, rejected, ready, in_transit, delivered, cancelled]
 *     responses:
 *       200:
 *         description: Updated order with modified item status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Forbidden – not the assigned farmer or admin
 *       404:
 *         description: Order or item not found
 */
router.patch(
  '/:orderId/subOrders/:subOrderId/items/:itemId/status',
  requireAuth,
  orderCtl.updateOrderItemStatus
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
router.delete('/:id', requireAuth, requireAdmin, orderCtl.deleteOrder);

module.exports = router;
