/**
 * ImperialSeal — Global Error Handler Middleware
 * Catches all errors thrown or passed via next(err)
 */

'use strict';

const logger = require('../utils/logger');

/**
 * Normalise various error shapes into a consistent API response.
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // Already responded — nothing to do
  if (res.headersSent) return;

  // ── Supabase / PostgreSQL errors ──────────────────────────────────────────
  if (err.code && typeof err.code === 'string' && err.code.startsWith('2') && err.details) {
    logger.warn(`DB error [${err.code}]: ${err.message}`);
    return res.status(400).json({
      success: false,
      error: err.message,
      code: `DB_${err.code}`,
    });
  }

  // ── JWT errors ─────────────────────────────────────────────────────────────
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Invalid token',
      code: 'INVALID_TOKEN',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Token expired. Please log in again.',
      code: 'TOKEN_EXPIRED',
    });
  }

  // ── CORS errors ────────────────────────────────────────────────────────────
  if (err.message && err.message.startsWith('CORS policy:')) {
    return res.status(403).json({
      success: false,
      error: err.message,
      code: 'CORS_BLOCKED',
    });
  }

  // ── Multer file upload errors ──────────────────────────────────────────────
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      error: 'File too large. Maximum upload size exceeded.',
      code: 'FILE_TOO_LARGE',
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      error: 'Unexpected file field in upload.',
      code: 'UNEXPECTED_FILE',
    });
  }

  // ── Validation errors (manually thrown with status) ───────────────────────
  if (err.status && err.status < 500) {
    return res.status(err.status).json({
      success: false,
      error: err.message,
      code: err.code || 'VALIDATION_ERROR',
      ...(err.fields ? { fields: err.fields } : {}),
    });
  }

  // ── Algosdk / blockchain errors ────────────────────────────────────────────
  if (err.response && err.response.body && err.response.body.message) {
    logger.error(`Blockchain error: ${err.response.body.message}`);
    return res.status(502).json({
      success: false,
      error: 'Blockchain operation failed. Please try again.',
      code: 'BLOCKCHAIN_ERROR',
      detail: process.env.NODE_ENV !== 'production' ? err.response.body.message : undefined,
    });
  }

  // ── Generic 500 ────────────────────────────────────────────────────────────
  logger.error(`Unhandled error [${req.method} ${req.originalUrl}]:`, err);

  return res.status(500).json({
    success: false,
    error: 'An internal server error occurred.',
    code: 'INTERNAL_ERROR',
    // Never leak stack traces in production
    ...(process.env.NODE_ENV !== 'production' ? { stack: err.stack } : {}),
  });
}

module.exports = errorHandler;