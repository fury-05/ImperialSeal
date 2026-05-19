/**
 * ImperialSeal — Super Admin Guard Middleware
 *
 * requireSuperAdmin(req, res, next)
 *   Must be used AFTER verifyToken in the middleware chain.
 *   Checks that req.user.role === 'super_admin'.
 *   Returns 403 for any other role.
 *
 * Usage:
 *   router.get('/admin/stats', verifyToken, requireSuperAdmin, handler)
 *   — or mount the entire admin router behind both:
 *   app.use('/api/v1/admin', verifyToken, requireSuperAdmin, adminRouter)
 */

'use strict';

const logger = require('../utils/logger');

const SUPER_ADMIN_ROLE = 'super_admin';

/**
 * requireSuperAdmin middleware
 */
function requireSuperAdmin(req, res, next) {
  // verifyToken must have run first
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required.',
      code: 'NO_AUTH',
    });
  }

  if (req.user.role !== SUPER_ADMIN_ROLE) {
    logger.warn(
      `[SuperAdmin Guard] Access denied: user ${req.user.id} (role: ${req.user.role}) attempted ${req.method} ${req.originalUrl}`
    );
    return res.status(403).json({
      success: false,
      error: 'Access denied. Super admin privileges required.',
      code: 'FORBIDDEN_SUPER_ADMIN',
    });
  }

  next();
}

module.exports = { requireSuperAdmin };