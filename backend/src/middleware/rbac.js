/**
 * Role-Based Access Control middleware.
 * Usage: requirePermission('container:allocate')
 */
function requirePermission(...permissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    const has = permissions.every(p => req.user.permissions.includes(p));
    if (!has) {
      return res.status(403).json({
        error: `Access denied. Required permission(s): ${permissions.join(', ')}.`,
      });
    }
    next();
  };
}

/**
 * Require one of the given roles.
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Access denied. Required role(s): ${roles.join(', ')}.` });
    }
    next();
  };
}

module.exports = { requirePermission, requireRole };
