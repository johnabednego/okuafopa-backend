const jwt = require('jsonwebtoken');
const User = require('../models/User');

const { JWT_SECRET } = process.env;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in your environment');
}

/**
 * requireAuth
 *  - Verifies that a valid Bearer JWT is present in Authorization header
 *  - Attaches decoded token payload to req.user
 */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }

    const payload = jwt.verify(token, JWT_SECRET);
    // payload.sub => user ID, payload.isAdmin => boolean
    req.user = payload;
    next();
  } catch (err) {
    console.error('Auth error', err);
    return res.status(401).json({ message: 'Unauthorized: Invalid or expired token' });
  }
}

/**
 * requireAdmin
 *  - After requireAuth, checks req.user.isAdmin === true
 */
function requireAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ message: 'Forbidden: Admins only' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
