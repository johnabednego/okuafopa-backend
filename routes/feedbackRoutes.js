// routes/feedbackRoutes.js

const express = require('express');
const router = express.Router();
const feedbackCtl = require('../controllers/feedbackController');
const { requireAuth } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Feedbacks
 *   description: Ratings and comments on orders
 */

/**
 * @swagger
 * /feedbacks:
 *   get:
 *     summary: List feedback entries, optionally filtered by order
 *     tags: [Feedbacks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *         description: Order ID to filter feedbacks
 *     responses:
 *       200:
 *         description: Array of feedback objects
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Feedback'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get(
  '/',
  requireAuth,
  feedbackCtl.listFeedbacks
);

/**
 * @swagger
 * /feedbacks/{id}:
 *   get:
 *     summary: Get a single feedback by ID
 *     tags: [Feedbacks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Feedback ID
 *     responses:
 *       200:
 *         description: Feedback object
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Feedback'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Feedback not found
 */
router.get(
  '/:id',
  requireAuth,
  feedbackCtl.getFeedback
);

/**
 * @swagger
 * /feedbacks:
 *   post:
 *     summary: Submit new feedback for an order
 *     tags: [Feedbacks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: "Feedback payload"
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - order
 *               - rating
 *             properties:
 *               order:
 *                 type: string
 *                 description: Order ID
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               comment:
 *                 type: string
 *                 description: Optional comment
 *     responses:
 *       201:
 *         description: Created feedback
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Feedback'
 *       400:
 *         description: Invalid order or feedback already exists
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Forbidden – can only feedback own orders
 */
router.post(
  '/',
  requireAuth,
  feedbackCtl.createFeedback
);

/**
 * @swagger
 * /feedbacks/{id}:
 *   patch:
 *     summary: Update feedback or add a response
 *     tags: [Feedbacks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Feedback ID
 *     requestBody:
 *       description: "Fields to update (buyer: rating/comment; farmer/admin: responseText)"
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               comment:
 *                 type: string
 *               responseText:
 *                 type: string
 *                 description: "Farmer’s response to feedback"
 *     responses:
 *       200:
 *         description: Updated feedback
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Feedback'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Forbidden – not authorized
 *       404:
 *         description: Feedback not found
 */
router.patch(
  '/:id',
  requireAuth,
  feedbackCtl.updateFeedback
);

/**
 * @swagger
 * /feedbacks/{id}:
 *   delete:
 *     summary: Delete a feedback entry (author or admin)
 *     tags: [Feedbacks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Feedback ID
 *     responses:
 *       204:
 *         description: Feedback deleted
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Forbidden – only author or admin
 *       404:
 *         description: Feedback not found
 */
router.delete(
  '/:id',
  requireAuth,
  feedbackCtl.deleteFeedback
);

module.exports = router;
