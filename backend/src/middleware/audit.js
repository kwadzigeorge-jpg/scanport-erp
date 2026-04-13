const db = require('../config/database');

/**
 * Log an action to the immutable audit_logs table.
 * Can be called directly: logAudit(req, 'container:entry_created', 'container_transaction', txn.id, {...})
 */
async function logAudit(req, action, entity = null, entityId = null, details = {}) {
  try {
    const user = req.user || {};
    await db.query(
      `INSERT INTO audit_logs (user_id, username, role, action, entity, entity_id, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        user.id || null,
        user.username || 'system',
        user.role || null,
        action,
        entity,
        entityId ? String(entityId) : null,
        JSON.stringify(details),
        req.ip || req.socket?.remoteAddress || null,
        req.headers?.['user-agent'] || null,
      ]
    );
  } catch (err) {
    // Never throw from audit logger – log to stderr and continue
    console.error('Audit log failed:', err.message);
  }
}

module.exports = { logAudit };
