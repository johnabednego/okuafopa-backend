// controllers/userController.js
const User = require('../models/User');

/**
 * GET /api/users/me
 */
exports.getProfile = async (req, res, next) => {
  try {
    const u = await User.findById(req.user.sub);
    if (!u) return res.status(404).json({ error: 'User not found' });
    res.json(u.toJSON());
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/users/me
 */
exports.updateProfile = async (req, res, next) => {
  try {
    const {
      phoneNumber, country, city, profileImage, emailNotification, smsNotification
    } = req.body;
    const updates = { lastUpdatedBy: req.user.sub };
    if (profileImage !== undefined) updates.profileImage = profileImage;
    if (phoneNumber !== undefined) updates.phoneNumber = phoneNumber;
    if (country !== undefined) updates.country = country;
    if (city !== undefined) updates.city = city;
    if (emailNotification !== undefined) updates.emailNotification = emailNotification;
    if (smsNotification !== undefined) updates.smsNotification = smsNotification;

    const u = await User.findByIdAndUpdate(
      req.user.sub,
      { $set: updates },
      { new: true, runValidators: true }
    );
    res.locals.updated = u;
    res.json(u.toJSON());
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/users/me/change-password
 */
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const u = await User.findById(req.user.sub).select('+password');
    if (!u) return res.status(404).json({ error: 'User not found' });
    if (!await u.verifyPassword(currentPassword)) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    u.password = newPassword;
    u.lastUpdatedBy = req.user.sub;
    await u.save();
    res.locals.updated = u;
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/users/
 */
exports.listUsers = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 20);
    const [users, total] = await Promise.all([
      User.find().skip((page - 1) * limit).limit(limit),
      User.countDocuments()
    ]);
    res.json({ page, limit, total, data: users.map(u => u.toJSON()) });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/users/:id
 */
exports.getUserById = async (req, res, next) => {
  try {
    const u = await User.findById(req.params.id);
    if (!u) return res.status(404).json({ error: 'User not found' });
    res.json(u.toJSON());
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/users/:id
 */
exports.updateUserById = async (req, res, next) => {
  try {
    const whitelist = [
      'firstName', 'lastName', 'email', 'isActive',
      'phoneNumber', 'role', 'country', 'city', 'isAdmin'
    ];
    const updates = { lastUpdatedBy: req.user.sub };
    whitelist.forEach(f => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });
    const u = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!u) return res.status(404).json({ error: 'User not found' });
    res.locals.updated = u;
    res.json(u.toJSON());
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/users/:id
 */
exports.deleteUser = async (req, res, next) => {
  try {
    const before = await User.findById(req.params.id).lean();
    const u = await User.findByIdAndDelete(req.params.id);
    if (!u) return res.status(404).json({ error: 'User not found' });
    res.locals.updated = before;
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};
