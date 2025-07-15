const express = require('express');
const router = express.Router();
const messageCtl = require('../controllers/messageController');
const { requireAuth } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Messages
 *   description: In-app chat between buyers and farmers
 */

/**
 * @swagger
 * /messages:
 *   get:
 *     summary: List messages, optionally filtered by order
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *         description: Order ID to filter messages
 *     responses:
 *       200:
 *         description: Array of chat messages
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Message'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get(
  '/',
  requireAuth,
  messageCtl.listMessages
);

/**
 * @swagger
 * /messages/{id}:
 *   get:
 *     summary: Get a single message by ID
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Message ID
 *     responses:
 *       200:
 *         description: Message object
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Message not found
 */
router.get(
  '/:id',
  requireAuth,
  messageCtl.getMessage
);

/**
 * @swagger
 * /messages:
 *   post:
 *     summary: Send a new message
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: Message payload
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - order
 *               - text
 *             properties:
 *               order:
 *                 type: string
 *                 description: Order ID this message belongs to
 *               text:
 *                 type: string
 *                 description: Message content
 *     responses:
 *       201:
 *         description: Created message
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *       400:
 *         description: Validation error
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post(
  '/',
  requireAuth,
  messageCtl.createMessage
);

/**
 * @swagger
 * /messages/{id}:
 *   patch:
 *     summary: Edit a message (sender only)
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Message ID
 *     requestBody:
 *       description: Fields to update
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *                 description: New message content
 *     responses:
 *       200:
 *         description: Updated message
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Forbidden – only the sender can edit
 *       404:
 *         description: Message not found
 */
router.patch(
  '/:id',
  requireAuth,
  messageCtl.updateMessage
);

/**
 * @swagger
 * /messages/{id}:
 *   delete:
 *     summary: Delete a message (sender only)
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Message ID
 *     responses:
 *       204:
 *         description: Message deleted
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Forbidden – only the sender can delete
 *       404:
 *         description: Message not found
 */
router.delete(
  '/:id',
  requireAuth,
  messageCtl.deleteMessage
);

module.exports = router;
