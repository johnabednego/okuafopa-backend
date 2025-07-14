const express = require('express');
const router = express.Router();
const auditLogCtl = require('../controllers/auditLogController');
const { requireAuth, requireAdmin } = require('../middleware/auth');


/**
 * @swagger
 * tags:
 *   name: AuditLogs
 *   description: Audit log entries
 */

/**
 * @swagger
 * /audit-logs:
 *   get:
 *     summary: List audit log entries (admin only)
 *     tags: [AuditLogs]
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
 *     responses:
 *       200:
 *         description: A paginated list of audit logs
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
 *                     $ref: '#/components/schemas/AuditLog'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Forbidden – admin only
 */
router.get('/', requireAuth, requireAdmin, auditLogCtl.listLogs);

/**
 * @swagger
 * /audit-logs/{id}:
 *   get:
 *     summary: Get an audit log entry by ID (admin only)
 *     tags: [AuditLogs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Audit log ID
 *     responses:
 *       200:
 *         description: Audit log entry
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuditLog'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Forbidden – admin only
 *       404:
 *         description: Audit log not found
 */
router.get('/:id', requireAuth, requireAdmin, auditLogCtl.getLogById);

/**
 * @swagger
 * /audit-logs:
 *   post:
 *     summary: Create an audit log entry (admin only)
 *     tags: [AuditLogs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: Audit log payload
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AuditLog'
 *     responses:
 *       201:
 *         description: Created audit log entry
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuditLog'
 *       400:
 *         description: Bad request
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Forbidden – admin only
 */
router.post('/', requireAuth, requireAdmin, auditLogCtl.createLog);

module.exports = router;