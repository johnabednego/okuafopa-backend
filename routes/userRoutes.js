const express = require('express');
const router  = express.Router();
const userCtl = require('../controllers/userController');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const withAudit    = require('../utils/withAudit');


/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management and profile
 */

/**
 * @swagger
 * /users:
 *   get:
 *     summary: List all users
 *     tags: [Users]
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
 *         description: A paginated list of users
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
 *                     $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', requireAuth, userCtl.listUsers);

/**
 * @swagger
 * /users/me:
 *   get:
 *     summary: Get current user's profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/me', requireAuth, userCtl.getProfile);

/**
 * @swagger
 * /users/me:
 *   patch:
 *     summary: Update current user's profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: Fields to update (firstName, lastName, profile, preferences, notificationSettings)
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               profile:
 *                 $ref: '#/components/schemas/Profile'
 *               preferences:
 *                 $ref: '#/components/schemas/Preferences'
 *               notificationSettings:
 *                 $ref: '#/components/schemas/NotificationSettings'
 *     responses:
 *       200:
 *         description: Updated user profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.patch(
  '/me',
  requireAuth,
  withAudit('User','UPDATE', userCtl.updateProfile)
);

/**
 * @swagger
 * /users/me/change-password:
 *   post:
 *     summary: Change current user's password
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: Provide current and new password
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Incorrect current password
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post(
  '/me/change-password',
  requireAuth,
  withAudit('User','UPDATE', userCtl.changePassword)
);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get any user by ID (admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Forbidden – admin only
 *       404:
 *         description: User not found
 */
router.get(
  '/:id',
  requireAuth, requireAdmin,
  withAudit('User','READ', userCtl.getUserById)
);

/**
 * @swagger
 * /users/{id}:
 *   patch:
 *     summary: Update any user by ID (admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       description: Fields to update (firstName, lastName, profile, preferences, notificationSettings, isAdmin)
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               profile:
 *                 $ref: '#/components/schemas/Profile'
 *               preferences:
 *                 $ref: '#/components/schemas/Preferences'
 *               notificationSettings:
 *                 $ref: '#/components/schemas/NotificationSettings'
 *               isAdmin:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Updated user data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Forbidden – admin only
 *       404:
 *         description: User not found
 */
router.patch(
  '/:id',
  requireAuth, requireAdmin,
  withAudit('User','UPDATE', userCtl.updateUserById)
);

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Delete a user (admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       204:
 *         description: User deleted
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Forbidden – admin only
 *       404:
 *         description: User not found
 */
router.delete(
  '/:id',
  requireAuth, requireAdmin,
  withAudit('User','DELETE', userCtl.deleteUser)
);

module.exports = router;
