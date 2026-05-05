const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/database');
const { computeEffectivePermissions } = require('../controllers/permissionController');

/**
 * Verify JWT and attach user + permissions to req.
 * Also validates the session is still active in DB.
 */
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided.' });
    }

    const token = header.split(' ')[1];
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }

    // Check session still exists
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const { rows } = await db.query(
      `SELECT s.id, s.expires_at, u.id AS user_id, u.username, u.full_name,
              u.is_active, r.name AS role, s.last_active
       FROM user_sessions s
       JOIN users u ON u.id = s.user_id
       JOIN roles r ON r.id = u.role_id
       WHERE s.token_hash = $1`,
      [tokenHash]
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'Session not found. Please log in again.' });
    }

    const session = rows[0];

    if (!session.is_active) {
      return res.status(401).json({ error: 'Account deactivated.' });
    }

    // Check inactivity timeout
    const inactivityMs = parseInt(process.env.SESSION_INACTIVITY_MINUTES || 30) * 60 * 1000;
    if (Date.now() - new Date(session.last_active).getTime() > inactivityMs) {
      await db.query('DELETE FROM user_sessions WHERE token_hash = $1', [tokenHash]);
      return res.status(401).json({ error: 'Session expired due to inactivity.' });
    }

    // Refresh last_active
    await db.query('UPDATE user_sessions SET last_active = NOW() WHERE token_hash = $1', [tokenHash]);

    // Load effective permissions (includes group inheritance, user overrides, denies)
    const permissions = await computeEffectivePermissions(session.user_id);

    req.user = {
      id: session.user_id,
      username: session.username,
      fullName: session.full_name,
      role: session.role,
      permissions,
      tokenHash,
    };

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { authenticate };
