const express = require('express');
const router  = express.Router();
const adminCtl = require('../controllers/adminController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Administrative dashboard and metrics
 */

/**
 * @swagger
 * /admin/metrics:
 *   get:
 *     summary: Get dashboard metrics (users, products, orders, revenue, feedback)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Aggregated metrics for the dashboard
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 usersByRole:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         description: Role name
 *                       count:
 *                         type: integer
 *                 products:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     active:
 *                       type: integer
 *                 orders:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     byStatus:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             description: Order status
 *                           count:
 *                             type: integer
 *                 revenue:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                     monthly:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: object
 *                             properties:
 *                               year:
 *                                 type: integer
 *                               month:
 *                                 type: integer
 *                           revenue:
 *                             type: number
 *                           orders:
 *                             type: integer
 *                 topProducts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       productId:
 *                         type: string
 *                       title:
 *                         type: string
 *                       totalQty:
 *                         type: integer
 *                       totalSales:
 *                         type: number
 *                 feedback:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     averageRating:
 *                       type: number
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Forbidden – admin only
 */
router.get(
  '/metrics',
  requireAuth,
  requireAdmin,
  adminCtl.getDashboardMetrics
);

module.exports = router;
