/**
 * ImperialSeal — Institution Guard Middleware
 *
 * requireInstitution(req, res, next)
 *   Must be used AFTER verifyToken.
 *   Allows: institution_admin, staff
 *   Blocks: super_admin (use requireSuperAdmin), unauthenticated
 *
 *   On success:
 *     req.institution = full institution row from DB
 *     req.user.institutionId is already set by verifyToken
 *
 * requireInstitutionAdmin(req, res, next)
 *   Like requireInstitution but ALSO requires role === 'institution_admin'.
 *   Use for destructive/management operations (delete course, manage staff, etc.)
 */

'use strict';

const { db } = require('../config/database');
const logger = require('../utils/logger');

const ALLOWED_ROLES = ['institution_admin', 'staff'];

/**
 * requireInstitution middleware
 * Populates req.institution with the institution row.
 */
async function requireInstitution(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required.',
      code: 'NO_AUTH',
    });
  }

  if (!ALLOWED_ROLES.includes(req.user.role)) {
    logger.warn(
      `[Institution Guard] Access denied: user ${req.user.id} (role: ${req.user.role}) attempted ${req.method} ${req.originalUrl}`
    );
    return res.status(403).json({
      success: false,
      error: 'Access denied. Institution account required.',
      code: 'FORBIDDEN_INSTITUTION',
    });
  }

  if (!req.user.institutionId) {
    logger.error(
      `[Institution Guard] User ${req.user.id} has role ${req.user.role} but no institutionId in token`
    );
    return res.status(403).json({
      success: false,
      error: 'Your account is not associated with any institution.',
      code: 'NO_INSTITUTION_ID',
    });
  }

  // Load institution from DB
  let institution;
  try {
    institution = await db.single(
      'institutions',
      { id: req.user.institutionId },
      `id, name, slug, logo_url, is_active, subscription_status,
       subscription_expires_at, blockchain_preference, token_type,
       wallet_address, annual_slots_remaining, created_at`
    );
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return res.status(403).json({
        success: false,
        error: 'Institution not found. Please contact support.',
        code: 'INSTITUTION_NOT_FOUND',
      });
    }
    logger.error('[Institution Guard] DB lookup failed:', err);
    return res.status(503).json({
      success: false,
      error: 'Service temporarily unavailable.',
      code: 'SERVICE_ERROR',
    });
  }

  // Check institution is active
  if (!institution.is_active) {
    return res.status(403).json({
      success: false,
      error: 'Your institution account has been deactivated. Please contact support.',
      code: 'INSTITUTION_DEACTIVATED',
    });
  }

  // Check subscription is not expired
  if (institution.subscription_status === 'expired') {
    return res.status(403).json({
      success: false,
      error: 'Your institution subscription has expired. Please renew to continue.',
      code: 'SUBSCRIPTION_EXPIRED',
      expiredAt: institution.subscription_expires_at,
    });
  }

  if (
    institution.subscription_status === 'suspended' ||
    institution.subscription_status === 'cancelled'
  ) {
    return res.status(403).json({
      success: false,
      error: `Your institution subscription is ${institution.subscription_status}. Please contact support.`,
      code: 'SUBSCRIPTION_INACTIVE',
      status: institution.subscription_status,
    });
  }

  // Attach to request
  req.institution = institution;
  next();
}

/**
 * requireInstitutionAdmin middleware
 * Same as requireInstitution, but also requires role === 'institution_admin'.
 * Use for admin-level operations within an institution.
 */
async function requireInstitutionAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required.',
      code: 'NO_AUTH',
    });
  }

  if (req.user.role !== 'institution_admin') {
    logger.warn(
      `[InstitutionAdmin Guard] Access denied: user ${req.user.id} (role: ${req.user.role}) attempted ${req.method} ${req.originalUrl}`
    );
    return res.status(403).json({
      success: false,
      error: 'Access denied. Institution admin privileges required.',
      code: 'FORBIDDEN_INSTITUTION_ADMIN',
    });
  }

  // Reuse requireInstitution logic (it will check institution active + subscription)
  return requireInstitution(req, res, next);
}

/**
 * requireSlots middleware
 * Checks that the institution has remaining issuance slots before a mint.
 * Must be used AFTER requireInstitution (needs req.institution).
 *
 * @param {number} [slotsNeeded=1] - How many slots this operation needs
 */
function requireSlots(slotsNeeded = 1) {
  return (req, res, next) => {
    if (!req.institution) {
      return res.status(500).json({
        success: false,
        error: 'requireSlots must be used after requireInstitution',
        code: 'MIDDLEWARE_ORDER_ERROR',
      });
    }

    const remaining = req.institution.annual_slots_remaining ?? 0;
    if (remaining < slotsNeeded) {
      return res.status(402).json({
        success: false,
        error: `Insufficient issuance slots. You have ${remaining} slot(s) remaining. Please purchase more slots.`,
        code: 'INSUFFICIENT_SLOTS',
        slotsRemaining: remaining,
        slotsRequired: slotsNeeded,
      });
    }

    next();
  };
}

module.exports = {
  requireInstitution,
  requireInstitutionAdmin,
  requireSlots,
};