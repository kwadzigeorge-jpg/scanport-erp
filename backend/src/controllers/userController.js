const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { logAudit } = require('../middleware/audit');

async function listUsers(req, res, next) {
  try {
    const { page = 1, limit = 20, role, search, is_active } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];

    if (role)      { params.push(role);           conditions.push(`r.name = $${params.length}`); }
    if (search)    { params.push(`%${search}%`);  conditions.push(`(u.username ILIKE $${params.length} OR u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`); }
    if (is_active !== undefined && is_active !== '') {
      params.push(is_active === 'true');
      conditions.push(`u.is_active = $${params.length}`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const { rows } = await db.query(
      `SELECT u.id, u.username, u.email, u.full_name, r.name AS role,
              u.is_active, u.last_login, u.created_at, u.failed_login_attempts,
              u.locked_until,
              (SELECT COUNT(*) FROM user_sessions s WHERE s.user_id=u.id AND s.expires_at > NOW()) AS active_sessions
       FROM users u JOIN roles r ON r.id = u.role_id
       ${where} ORDER BY u.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit), offset]
    );

    const { rows: count } = await db.query(
      `SELECT COUNT(*) FROM users u JOIN roles r ON r.id = u.role_id ${where}`, params
    );

    return res.json({ users: rows, total: parseInt(count[0].count), page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
}

async function getUser(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT u.id, u.username, u.email, u.full_name, r.name AS role, r.id AS role_id,
              u.is_active, u.last_login, u.created_at, u.failed_login_attempts, u.locked_until,
              cb.username AS created_by_username
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN users cb ON cb.id = u.created_by
       WHERE u.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found.' });

    const { rows: perms } = await db.query(
      `SELECT p.name, p.description FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.id
       WHERE rp.role_id = $1 ORDER BY p.name`,
      [rows[0].role_id]
    );

    const { rows: activity } = await db.query(
      `SELECT action, entity, created_at, ip_address FROM audit_logs
       WHERE user_id=$1 ORDER BY created_at DESC LIMIT 15`,
      [req.params.id]
    );

    return res.json({ ...rows[0], permissions: perms, recent_activity: activity });
  } catch (err) { next(err); }
}

async function createUser(req, res, next) {
  try {
    const { username, email, password, fullName, role } = req.body;
    if (!username || !email || !password || !fullName || !role) {
      return res.status(400).json({ error: 'username, email, password, fullName, and role are required.' });
    }
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      return res.status(400).json({ error: 'Password must contain at least one uppercase letter and one number.' });
    }

    const { rows: roleRows } = await db.query('SELECT id FROM roles WHERE name=$1', [role]);
    if (!roleRows.length) return res.status(400).json({ error: `Role "${role}" not found.` });

    const hash = await bcrypt.hash(password, 12);
    const { rows } = await db.query(
      `INSERT INTO users (username, email, password_hash, full_name, role_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, username, email, full_name`,
      [username.trim().toLowerCase(), email.trim().toLowerCase(), hash, fullName.trim(), roleRows[0].id, req.user.id]
    );

    await logAudit(req, 'user:created', 'user', rows[0].id, { username, role });
    return res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username or email already exists.' });
    next(err);
  }
}

async function updateUser(req, res, next) {
  try {
    const { fullName, email, role, is_active } = req.body;
    const updates = [];
    const params = [];

    if (is_active === false && req.params.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot deactivate your own account.' });
    }

    if (fullName !== undefined) { params.push(fullName.trim()); updates.push(`full_name=$${params.length}`); }
    if (email !== undefined)    { params.push(email.toLowerCase().trim()); updates.push(`email=$${params.length}`); }
    if (is_active !== undefined){ params.push(is_active); updates.push(`is_active=$${params.length}`); }
    if (role !== undefined) {
      const { rows: r } = await db.query('SELECT id FROM roles WHERE name=$1', [role]);
      if (!r.length) return res.status(400).json({ error: `Role "${role}" not found.` });
      params.push(r[0].id); updates.push(`role_id=$${params.length}`);
    }
    if (!updates.length) return res.status(400).json({ error: 'No fields to update.' });

    params.push(req.params.id);
    const { rowCount } = await db.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id=$${params.length}`, params
    );
    if (!rowCount) return res.status(404).json({ error: 'User not found.' });

    if (is_active === false) {
      await db.query('DELETE FROM user_sessions WHERE user_id=$1', [req.params.id]);
    }

    await logAudit(req, 'user:updated', 'user', req.params.id, { fullName, email, role, is_active });
    return res.json({ message: 'User updated.' });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already in use.' });
    next(err);
  }
}

async function resetUserPassword(req, res, next) {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }
    const hash = await bcrypt.hash(newPassword, 12);
    await db.query(
      'UPDATE users SET password_hash=$1, failed_login_attempts=0, locked_until=NULL WHERE id=$2',
      [hash, req.params.id]
    );
    await db.query('DELETE FROM user_sessions WHERE user_id=$1', [req.params.id]);
    await logAudit(req, 'user:password_reset_by_admin', 'user', req.params.id, { resetBy: req.user.username });
    return res.json({ message: 'Password reset. All active sessions terminated.' });
  } catch (err) { next(err); }
}

async function unlockUser(req, res, next) {
  try {
    const { rowCount } = await db.query(
      'UPDATE users SET failed_login_attempts=0, locked_until=NULL WHERE id=$1',
      [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'User not found.' });
    await logAudit(req, 'user:unlocked', 'user', req.params.id, { unlockedBy: req.user.username });
    return res.json({ message: 'Account unlocked.' });
  } catch (err) { next(err); }
}

async function killUserSessions(req, res, next) {
  try {
    const { rowCount } = await db.query('DELETE FROM user_sessions WHERE user_id=$1', [req.params.id]);
    await logAudit(req, 'user:sessions_killed', 'user', req.params.id, { killedBy: req.user.username, sessions: rowCount });
    return res.json({ message: `${rowCount} session(s) terminated.` });
  } catch (err) { next(err); }
}

async function listActiveSessions(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT s.id, s.user_id, u.username, u.full_name, r.name AS role,
              s.ip_address, s.last_active, s.created_at, s.expires_at
       FROM user_sessions s
       JOIN users u ON u.id = s.user_id
       JOIN roles r ON r.id = u.role_id
       WHERE s.expires_at > NOW()
       ORDER BY s.last_active DESC`
    );
    return res.json(rows);
  } catch (err) { next(err); }
}

async function killSession(req, res, next) {
  try {
    await db.query('DELETE FROM user_sessions WHERE id=$1', [req.params.sessionId]);
    await logAudit(req, 'user:session_killed', 'user_sessions', req.params.sessionId, { killedBy: req.user.username });
    return res.json({ message: 'Session terminated.' });
  } catch (err) { next(err); }
}

async function listRoles(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT r.id, r.name, r.description,
              COUNT(DISTINCT u.id) FILTER (WHERE u.is_active=TRUE) AS user_count,
              array_agg(p.name ORDER BY p.name) FILTER (WHERE p.name IS NOT NULL) AS permissions
       FROM roles r
       LEFT JOIN users u ON u.role_id = r.id
       LEFT JOIN role_permissions rp ON rp.role_id = r.id
       LEFT JOIN permissions p ON p.id = rp.permission_id
       GROUP BY r.id ORDER BY r.id`
    );
    return res.json(rows);
  } catch (err) { next(err); }
}

async function listPermissions(req, res, next) {
  try {
    const { rows } = await db.query('SELECT id, name, description FROM permissions ORDER BY name');
    return res.json(rows);
  } catch (err) { next(err); }
}

async function getUserStats(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE is_active=TRUE) AS active,
         COUNT(*) FILTER (WHERE is_active=FALSE) AS inactive,
         COUNT(*) FILTER (WHERE locked_until > NOW()) AS locked,
         COUNT(*) FILTER (WHERE last_login > NOW() - INTERVAL '24 hours') AS logged_in_today,
         COUNT(*) FILTER (WHERE last_login IS NULL) AS never_logged_in
       FROM users`
    );
    const { rows: byRole } = await db.query(
      `SELECT r.name AS role, COUNT(u.id) AS count
       FROM roles r LEFT JOIN users u ON u.role_id=r.id AND u.is_active=TRUE
       GROUP BY r.id ORDER BY r.id`
    );
    return res.json({ ...rows[0], by_role: byRole });
  } catch (err) { next(err); }
}

module.exports = {
  listUsers, getUser, createUser, updateUser,
  resetUserPassword, unlockUser,
  killUserSessions, listActiveSessions, killSession,
  listRoles, listPermissions, getUserStats,
};
