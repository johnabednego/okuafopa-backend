const jwt = require('jsonwebtoken');

exports.generateAccessToken = user =>
  jwt.sign({ id: user.id, role: user.role, sub: user.id, isAdmin: user.isAdmin, 
    isActive: user.isActive,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,

  }, process.env.JWT_SECRET, { expiresIn: '1h' });

exports.verifyToken = token => jwt.verify(token, process.env.JWT_SECRET);