const User         = require('../models/User');
const emailService = require('../services/emailService');
const tokenService = require('../services/tokenService');

/**
 * POST /api/auth/signup
 */
exports.signup = async (req, res, next) => {
  try {
    const {
      firstName, lastName, email, password,
      phoneNumber, role, country, city, profileImage
    } = req.body;

    if (await User.exists({ email })) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const user = new User({
      firstName, lastName, email, password,
      phoneNumber, role, country, city, profileImage
    });

    const otp = user.generateOTP('emailVerification');
    await user.save();
    await emailService.sendOTP(email, otp, 'Email Verification');

    // tell withAudit who created
    res.locals.created    = user;
    res.locals.auditUser  = user._id;

    res.status(201).json({
      message: 'Signup successful—OTP sent for email verification.',
      email: user.email
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/verify-email
 */
exports.verifyEmail = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email })
      .select('+otp +otpExpiry +otpPurpose');

    if (!user || !user.verifyOTP(otp, 'emailVerification')) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    user.emailVerified = true;
    user.clearOTP();
    await user.save();

    const token = tokenService.generateAccessToken(user);

    // audit this update
    res.locals.updated    = user;
    res.locals.auditUser  = user._id;

    res.json({ message: 'Email verified', token, user: user.toJSON() });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/login
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.verifyPassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    if (!user.emailVerified) {
      return res.status(403).json({ message: 'Email not verified' });
    }

    const token = tokenService.generateAccessToken(user);

    // audit the login event
    res.locals.updated    = user;
    res.locals.auditUser  = user._id;

    res.json({ token, user: user.toJSON() });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/forgot-password
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.json({ message: 'If that email is registered, you’ll receive a reset code.' });
    }

    const otp = user.generateOTP('passwordReset');
    await user.save();
    await emailService.sendOTP(email, otp, 'Password Reset');

    // audit OTP generation
    res.locals.updated    = user;
    res.locals.auditUser  = user._id;

    res.json({ message: 'Password reset OTP sent to your email.' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/reset-password
 */
exports.resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await User.findOne({ email })
      .select('+password +otp +otpExpiry +otpPurpose');

    if (!user || !user.verifyOTP(otp, 'passwordReset')) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    user.password = newPassword;
    user.clearOTP();
    await user.save();

    // audit the password reset
    res.locals.updated    = user;
    res.locals.auditUser  = user._id;

    res.json({ message: 'Password successfully reset. You can now log in.' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/resend-otp
 */
exports.resendOTP = async (req, res, next) => {
  try {
    const { email, purpose } = req.body;
    if (!User.OTP_PURPOSES.includes(purpose)) {
      return res.status(400).json({ message: 'Invalid purpose' });
    }

    const user = await User.findOne({ email })
      .select('+otp +otpExpiry +otpPurpose +emailVerified');
    if (!user) {
      return res.json({ message: 'If eligible, a new code will be sent.' });
    }

    if (user.otp && user.otpExpiry > Date.now()) {
      return res.status(400).json({ message: 'A valid code has already been sent.' });
    }
    if (purpose === 'emailVerification' && user.emailVerified) {
      return res.status(400).json({ message: 'Email is already verified.' });
    }

    const otp = user.generateOTP(purpose);
    const label = purpose === 'emailVerification' ? 'Email Verification' : 'Password Reset';
    await user.save();
    await emailService.sendOTP(email, otp, label);

    // audit OTP resend
    res.locals.updated    = user;
    res.locals.auditUser  = user._id;

    res.json({ message: `New OTP sent for ${purpose}.` });
  } catch (err) {
    next(err);
  }
};
