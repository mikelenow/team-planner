const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Require specific roles (ADMIN, MANAGER, VIEWER)
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user?.role || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Access denied. Required role: ${roles.join(' or ')}` });
    }
    next();
  };
}

// Shorthand: admin only
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// Shorthand: admin or manager (can edit)
function requireEditor(req, res, next) {
  if (!['ADMIN', 'MANAGER'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'Editor access required (Admin or Manager)' });
  }
  next();
}

module.exports = { authenticate, requireRole, requireAdmin, requireEditor };
