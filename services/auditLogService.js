const AuditLog = require('../models/AuditLog');
const User     = require('../models/User');
const { sendAuditNotification } = require('./emailService');

async function record({ userId, action, entity, entityId = null, before = null, after = null, metadata = {} }) {
  const log = new AuditLog({ user: userId, action, entity, entityId, before, after, metadata });
  await log.save();

  // notify all admins
  const admins = await User.find({ isAdmin: true }).select('email');
  await Promise.all(admins.map(a =>
    sendAuditNotification('audit', log, a)
  ));

  return log;
}

module.exports = { record };
