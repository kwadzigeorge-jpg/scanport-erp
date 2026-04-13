const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/database');
const { logAudit } = require('../middleware/audit');

// ─── Login ────────────────────────────────────────────────────────────────────
async function login(req, res, next) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    // Load user + role
    const { rows } = await db.query(
      `SELECT u.id, u.username, u.email, u.full_name, u.password_hash, u.is_active,
              u.failed_login_attempts, u.locked_until,
              r.name AS role, r.id AS role_id
       FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.username = $1`,
      [username.trim()]
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const user = rows[0];

    // Account lockout check
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const remaining = Math.ceil((new Date(user.locked_until) - Date.now()) / 60000);
      return res.status(423).json({
        error: `Account locked. Try again in ${remaining} minute(s).`,
      });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is deactivated. Contact your administrator.' });
    }

    // Verify password
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      const maxFails = 10;
      const newFails = user.failed_login_attempts + 1;
      let lockedUntil = null;
      if (newFails >= maxFails) {
        const lockMins = 5;
        lockedUntil = new Date(Date.now() + lockMins * 60000);
      }
      await db.query(
        'UPDATE users SET failed_login_attempts=$1, locked_until=$2 WHERE id=$3',
        [newFails, lockedUntil, user.id]
      );
      await logAudit(req, 'auth:login_failed', 'user', user.id, { username });
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // Check concurrent sessions setting
    const { rows: cfg } = await db.query(
      "SELECT value FROM system_config WHERE key='prevent_concurrent_sessions'"
    );
    if (cfg[0]?.value === 'true') {
      await db.query('DELETE FROM user_sessions WHERE user_id = $1', [user.id]);
    }

    // Issue JWT
    const payload = { sub: user.id, role: user.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    });
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 8 * 3600 * 1000);

    await db.query(
      `INSERT INTO user_sessions (user_id, token_hash, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, tokenHash, req.ip, req.headers['user-agent'], expiresAt]
    );

    // Reset failed attempts
    await db.query(
      'UPDATE users SET failed_login_attempts=0, locked_until=NULL, last_login=NOW() WHERE id=$1',
      [user.id]
    );

    await logAudit(req, 'auth:login_success', 'user', user.id, { username, role: user.role });

    // Load permissions for this user
    const { rows: perms } = await db.query(
      `SELECT p.name FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.id
       WHERE rp.role_id = $1`,
      [user.role_id]
    );

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        permissions: perms.map(p => p.name),
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── Logout ───────────────────────────────────────────────────────────────────
async function logout(req, res, next) {
  try {
    await db.query('DELETE FROM user_sessions WHERE token_hash = $1', [req.user.tokenHash]);
    await logAudit(req, 'auth:logout', 'user', req.user.id);
    return res.json({ message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
}

// ─── Me ───────────────────────────────────────────────────────────────────────
async function me(req, res) {
  const { rows } = await db.query(
    `SELECT u.id, u.username, u.email, u.full_name, r.name AS role, u.last_login
     FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
    [req.user.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'User not found.' });
  const u = rows[0];
  return res.json({ id: u.id, username: u.username, fullName: u.full_name, email: u.email, role: u.role, lastLogin: u.last_login, permissions: req.user.permissions });
}

// ─── Forgot Password ──────────────────────────────────────────────────────────
async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const { rows } = await db.query('SELECT id, username FROM users WHERE email=$1', [email]);
    // Always return success to prevent user enumeration
    if (rows.length) {
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await db.query(
        'UPDATE users SET password_reset_token=$1, password_reset_expires=$2 WHERE id=$3',
        [token, expires, rows[0].id]
      );
      // TODO: send email with reset link
      await logAudit(req, 'auth:password_reset_requested', 'user', rows[0].id);
    }
    return res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
}

// ─── Reset Password ───────────────────────────────────────────────────────────
async function resetPassword(req, res, next) {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password are required.' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

    const { rows } = await db.query(
      `SELECT id FROM users WHERE password_reset_token=$1 AND password_reset_expires > NOW()`,
      [token]
    );
    if (!rows.length) return res.status(400).json({ error: 'Invalid or expired reset token.' });

    const hash = await bcrypt.hash(newPassword, 12);
    await db.query(
      `UPDATE users SET password_hash=$1, password_reset_token=NULL, password_reset_expires=NULL,
       failed_login_attempts=0, locked_until=NULL WHERE id=$2`,
      [hash, rows[0].id]
    );
    // Invalidate all sessions
    await db.query('DELETE FROM user_sessions WHERE user_id=$1', [rows[0].id]);
    await logAudit(req, 'auth:password_reset_completed', 'user', rows[0].id);
    return res.json({ message: 'Password reset successfully. Please log in.' });
  } catch (err) {
    next(err);
  }
}

// ─── Change Password ──────────────────────────────────────────────────────────
async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords are required.' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters.' });

    const { rows } = await db.query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
    const match = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!match) return res.status(400).json({ error: 'Current password is incorrect.' });

    const hash = await bcrypt.hash(newPassword, 12);
    await db.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.user.id]);
    await logAudit(req, 'auth:password_changed', 'user', req.user.id);
    return res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, logout, me, forgotPassword, resetPassword, changePassword };
