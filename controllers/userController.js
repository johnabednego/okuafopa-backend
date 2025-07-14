const User = require('../models/User');

// GET /api/users/me
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash');
    res.json(user);
  } catch (err) {
    next(err);
  }
};

// PUT /api/users/me
exports.updateMe = async (req, res, next) => {
  try {
    const updates = { ...req.body };
    // Prevent role/phone changes
    delete updates.role;
    delete updates.phone;
    if (updates.password) {
      const bcrypt = require('bcrypt');
      updates.passwordHash = await bcrypt.hash(updates.password, 12);
      delete updates.password;
    }

    const user = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
      select: '-passwordHash',
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
};
