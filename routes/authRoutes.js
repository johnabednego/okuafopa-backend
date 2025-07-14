const express  = require('express');
const router   = express.Router();
const authCtl  = require('../controllers/authController');
const withAudit  = require('../utils/withAudit');

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: Sign-up, email verification, login, and password reset
 */

/**
 * @swagger
 * /auth/signup:
 *   post:
 *     summary: Create a new user account
 *     tags: [Authentication]
 *     requestBody:
 *       description: User signup information
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - email
 *               - password
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *               avatarUrl:
 *                 type: string
 *                 format: uri
 *                 description: URL to user’s avatar image
 *               phoneNumber:
 *                 type: string
 *                 description: User’s contact phone number
 *               address:
 *                 type: object
 *                 description: User’s address information
 *                 properties:
 *                   country:
 *                     type: string
 *                     description: Country name
 *                   city:
 *                     type: string
 *                     description: City name
 *               emailOnAssignment:
 *                 type: boolean
 *                 description: Receive email when assigned
 *               emailOnComment:
 *                 type: boolean
 *                 description: Receive email on comments
 *               pushOnDailySummary:
 *                 type: boolean
 *                 description: Receive push notification for daily summaries
 *     responses:
 *       201:
 *         description: Signup successful—OTP sent for email verification.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 email:
 *                   type: string
 *       409:
 *         description: Email already registered
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
/**
 * @route POST /api/auth/signup
 * @action CREATE User
 */
router.post(
  '/signup',
  withAudit('User', 'CREATE', authCtl.signup)
);

/**
 * @swagger
 * /auth/verify-email:
 *   post:
 *     summary: Verify email address with OTP
 *     tags: [Authentication]
 *     requestBody:
 *       description: Email verification payload
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email verified; returns JWT and user profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 token:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid or expired OTP
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
/**
 * @route POST /api/auth/verify-email
 * @action UPDATE User
 */
router.post(
  '/verify-email',
  withAudit('User', 'UPDATE', authCtl.verifyEmail)
);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Log in with email and password
 *     tags: [Authentication]
 *     requestBody:
 *       description: User credentials
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Login successful; returns JWT and user profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Email not verified
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @route POST /api/auth/login
 * @action LOGIN User
 */
router.post(
  '/login',
  withAudit('User', 'LOGIN', authCtl.login)
);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request a password reset OTP
 *     tags: [Authentication]
 *     requestBody:
 *       description: Email for password reset
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: If that email is registered, you’ll receive a reset code.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
/**
 * @route POST /api/auth/forgot-password
 * @action UPDATE User
 */
router.post(
  '/forgot-password',
  withAudit('User', 'UPDATE', authCtl.forgotPassword)
);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Reset password using OTP
 *     tags: [Authentication]
 *     requestBody:
 *       description: Payload to reset password
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *               - newPassword
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Password successfully reset
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid or expired OTP
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
/**
 * @route POST /api/auth/reset-password
 * @action UPDATE User
 */
router.post(
  '/reset-password',
  withAudit('User', 'UPDATE', authCtl.resetPassword)
);

/**
 * @swagger
 * /auth/resend-otp:
 *   post:
 *     summary: Resend a one-time code (OTP) if the previous one expired
 *     tags: [Authentication]
 *     requestBody:
 *       description: Must supply the user’s email and which OTP you need
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - purpose
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: The user’s email address
 *               purpose:
 *                 type: string
 *                 enum:
 *                   - emailVerification
 *                   - passwordReset
 *                 description: |
 *                   Which OTP to resend:
 *                     • `emailVerification` (signup flow)
 *                     • `passwordReset` (forgot-password flow)
 *     responses:
 *       200:
 *         description: If eligible, a new OTP will be sent (or a generic OK)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad request (invalid purpose, still-valid OTP, already verified, etc.)
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
/**
 * @route POST /api/auth/resend-otp
 * @action UPDATE User
 */
router.post(
  '/resend-otp',
  withAudit('User', 'UPDATE', authCtl.resendOTP)
);


module.exports = router;
