// utils/withAudit.js
const AuditLog = require('../models/AuditLog');

/**
 * Record one audit entry.
 */
async function record({ userId, action, entity, entityId, before, after, metadata }) {
  const log = new AuditLog({ user: userId, action, entity, entityId, before, after, metadata });
  await log.save();
}

function withAudit(entity, action, handler) {
  return async function(req, res, next) {
    let before = null;
    if (['UPDATE','DELETE'].includes(action) && req.params.id) {
      const Model = require(`../models/${entity}`);
      before = await Model.findById(req.params.id).lean();
      res.locals.before = before;
    }

    // After response is sent, capture audit
    res.once('finish', async () => {
      try {
        // determine who to attribute
        const userId = (req.user && req.user.sub) || res.locals.auditUser;
        if (!userId) return;  // give up if we truly don't know

        let after = null, entityId = null;
        if (action === 'CREATE' && res.locals.created) {
          after    = res.locals.created.toObject();
          entityId = after._id;
        } else if (['UPDATE','DELETE'].includes(action) && res.locals.updated) {
          after    = res.locals.updated.toObject();
          entityId = req.params.id;
        }

        await record({
          userId,
          action,
          entity,
          entityId,
          before:   res.locals.before  || null,
          after:    after              || null,
          metadata: { path: req.originalUrl, method: req.method }
        });
      } catch (err) {
        console.error('Audit log failed:', err);
      }
    });

    // invoke original handler
    try {
      await handler(req, res, next);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = withAudit;
