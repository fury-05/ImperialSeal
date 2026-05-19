/**
 * ImperialSeal — JWT Auth Middleware
 *
 * verifyToken(req, res, next)
 *   Validates the Bearer JWT from the Authorization header.
 *   On success, attaches req.user = { id, email, role, institutionId, jti }
 *   On failure, returns 401.
 *
 * Token claims expected:
 *   sub           — user UUID (users.id)
 *   email         — user email
 *   role          — 'super_admin' | 'institution_admin' | 'staff'
 *   institutionId — institution UUID (null for super_admin)
 *   jti           — unique token ID (for revocation checks)
 *   iat, exp      — standard JWT claims
 */

'use strict';

const jwt = require('jsonwebtoken');
const { db } = require('../config/database');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  logger.error('Missing env var: JWT_SECRET');
  process.exit(1);
}

/**
 * Extract the raw token string from the Authorization header.
 * Accepts "Bearer <token>" format only.
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function extractToken(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return null;
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * verifyToken middleware
 * Attaches req.user on success; sends 401 on failure.
 */
async function verifyToken(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please provide a Bearer token.',
      code: 'NO_TOKEN',
    });
  }

  // 1. Verify signature + expiry
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: process.env.JWT_ISSUER || 'imperialseal-api',
      audience: process.env.JWT_AUDIENCE || 'imperialseal-app',
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Your session has expired. Please log in again.',
        code: 'TOKEN_EXPIRED',
      });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token.',
        code: 'INVALID_TOKEN',
      });
    }
    logger.error('[Auth] JWT verification error:', err);
    return res.status(401).json({
      success: false,
      error: 'Token verification failed.',
      code: 'TOKEN_ERROR',
    });
  }

  // 2. Validate required claims
  if (!decoded.sub || !decoded.role) {
    return res.status(401).json({
      success: false,
      error: 'Malformed token: missing required claims.',
      code: 'MALFORMED_TOKEN',
    });
  }

  // 3. Check token revocation (jti blocklist in DB)
  //    We check the `revoked_tokens` table keyed by jti.
  //    This is only done when ENABLE_TOKEN_REVOCATION=true to keep the hot path fast.
  if (process.env.ENABLE_TOKEN_REVOCATION === 'true' && decoded.jti) {
    try {
      const revoked = await db.query('revoked_tokens', {
        filters: { jti: decoded.jti },
        select: 'jti',
      });
      if (revoked.length > 0) {
        return res.status(401).json({
          success: false,
          error: 'Token has been revoked. Please log in again.',
          code: 'TOKEN_REVOKED',
        });
      }
    } catch (dbErr) {
      // If revocation check fails, fail-open in development, fail-closed in production
      logger.error('[Auth] Revocation DB check failed:', dbErr);
      if (process.env.NODE_ENV === 'production') {
        return res.status(503).json({
          success: false,
          error: 'Authentication service temporarily unavailable.',
          code: 'AUTH_SERVICE_ERROR',
        });
      }
    }
  }

  // 4. Verify the user record still exists and is active
  let userRecord;
  try {
    userRecord = await db.single('users', { id: decoded.sub }, 'id, email, role, institution_id, is_active');
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return res.status(401).json({
        success: false,
        error: 'User account not found.',
        code: 'USER_NOT_FOUND',
      });
    }
    logger.error('[Auth] User lookup failed:', err);
    return res.status(503).json({
      success: false,
      error: 'Authentication service temporarily unavailable.',
      code: 'AUTH_SERVICE_ERROR',
    });
  }

  if (!userRecord.is_active) {
    return res.status(403).json({
      success: false,
      error: 'Your account has been deactivated. Please contact support.',
      code: 'ACCOUNT_DEACTIVATED',
    });
  }

  // 5. Attach user context to request
  req.user = {
    id: userRecord.id,
    email: userRecord.email,
    role: userRecord.role,
    institutionId: userRecord.institution_id || null,
    jti: decoded.jti || null,
    // Useful for downstream logging
    tokenIssuedAt: decoded.iat,
    tokenExpiresAt: decoded.exp,
  };

  next();
}

/**
 * optionalToken middleware
 * Like verifyToken but does NOT reject on missing/invalid token.
 * Attaches req.user if token is present and valid; otherwise req.user = null.
 * Use for public routes that have optional authenticated behaviour.
 */
async function optionalToken(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: process.env.JWT_ISSUER || 'imperialseal-api',
      audience: process.env.JWT_AUDIENCE || 'imperialseal-app',
    });

    if (decoded.sub && decoded.role) {
      req.user = {
        id: decoded.sub,
        email: decoded.email || null,
        role: decoded.role,
        institutionId: decoded.institutionId || null,
        jti: decoded.jti || null,
      };
    } else {
      req.user = null;
    }
  } catch (_) {
    req.user = null;
  }

  next();
}

/**
 * generateToken(payload, expiresIn)
 * Utility used by the auth routes to mint new tokens.
 *
 * @param {object} payload  - { sub, email, role, institutionId }
 * @param {string} expiresIn - e.g. '24h', '8h'
 * @returns {string} signed JWT
 */
function generateToken(payload, expiresIn = '24h') {
  const { v4: uuidv4 } = require('uuid');
  return jwt.sign(
    {
      sub: payload.sub || payload.id,
      email: payload.email,
      role: payload.role,
      institutionId: payload.institutionId || null,
      jti: uuidv4(),
    },
    JWT_SECRET,
    {
      algorithm: 'HS256',
      expiresIn,
      issuer: process.env.JWT_ISSUER || 'imperialseal-api',
      audience: process.env.JWT_AUDIENCE || 'imperialseal-app',
    }
  );
}

module.exports = { verifyToken, optionalToken, generateToken };