const express = require('express');
const router = express.Router();
const txnCtl = require('../controllers/transactionController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Transactions
 *   description: Invoice and transaction management
 */

/**
 * @swagger
 * /transactions:
 *   post:
 *     summary: Create a new invoice for an order
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: Invoice data
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orderId
 *             properties:
 *               orderId:
 *                 type: string
 *                 description: The ID of the order being invoiced
 *               amount:
 *                 type: number
 *                 description: Total amount (calculated if omitted)
 *               details:
 *                 type: object
 *                 description: Optional metadata or line‐item details
 *     responses:
 *       201:
 *         description: Created invoice
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Transaction'
 *       400:
 *         description: Invalid order or invoice already exists
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post(
  '/',
  requireAuth,
  txnCtl.createTransaction
);

/**
 * @swagger
 * /transactions:
 *   get:
 *     summary: List all invoices (admin only)
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of invoices
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Transaction'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Forbidden – admin only
 */
router.get(
  '/',
  requireAuth,
  requireAdmin,
  txnCtl.listTransactions
);

/**
 * @swagger
 * /transactions/{id}:
 *   get:
 *     summary: Get an invoice by ID
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Transaction ID
 *     responses:
 *       200:
 *         description: Transaction data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Transaction'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Forbidden – admin only
 *       404:
 *         description: Transaction not found
 */
router.get(
  '/:id',
  requireAuth,
  requireAdmin,
  txnCtl.getTransaction
);

/**
 * @swagger
 * /transactions/{id}:
 *   patch:
 *     summary: Update an invoice (admin only)
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Transaction ID
 *     requestBody:
 *       description: Fields to update (amount or details)
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *               details:
 *                 type: object
 *     responses:
 *       200:
 *         description: Updated transaction
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Transaction'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Forbidden – admin only
 *       404:
 *         description: Transaction not found
 */
router.patch(
  '/:id',
  requireAuth,
  requireAdmin,
  txnCtl.updateTransaction
);

/**
 * @swagger
 * /transactions/{id}:
 *   delete:
 *     summary: Delete an invoice (admin only)
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Transaction ID
 *     responses:
 *       204:
 *         description: Transaction deleted
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Forbidden – admin only
 *       404:
 *         description: Transaction not found
 */
router.delete(
  '/:id',
  requireAuth,
  requireAdmin,
  txnCtl.deleteTransaction
);

module.exports = router;
