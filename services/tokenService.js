const jwt = require('jsonwebtoken');

exports.generateAccessToken = user =>
  jwt.sign({ id: user.id, role: user.role, sub: user.id, isAdmin: user.isAdmin}, process.env.JWT_SECRET, { expiresIn: '1h' });

exports.verifyToken = token => jwt.verify(token, process.env.JWT_SECRET);