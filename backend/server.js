/**
 * ImperialSeal — API Server
 * Express application entry point
 */

'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const logger = require('./utils/logger');
const { testConnections } = require('./config/blockchain');
const { scheduleEmailCron } = require('./jobs/emailQueue');
const errorHandler = require('./middleware/errorHandler');

// ─── Route Imports ────────────────────────────────────────────────────────────
const authRoutes = require('./routes/auth');
const superAdminRoutes = require('./routes/superAdmin');
const institutionRoutes = require('./routes/institution');
const courseRoutes = require('./routes/courses');
const certificateRoutes = require('./routes/certificates');
const badgeRoutes = require('./routes/badges');
const recipientRoutes = require('./routes/recipients');
const issuanceRoutes = require('./routes/issuance');
const paymentRoutes = require('./routes/payments');
const storageRoutes = require('./routes/storage');
const verifyRoutes = require('./routes/verify');
const webhookRoutes = require('./routes/webhooks');
const configRoutes = require('./routes/config');

// ─── App Init ─────────────────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 4000;

// ─── Trust Proxy (Nginx sits in front) ────────────────────────────────────────
app.set('trust proxy', 1);

// ─── Security Headers ─────────────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
  })
);

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.ADMIN_URL,
  // Allow localhost in development
  ...(process.env.NODE_ENV !== 'production'
    ? ['http://localhost:3000', 'http://localhost:3001']
    : []),
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman in dev)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      logger.warn(`CORS blocked: ${origin}`);
      return callback(new Error(`CORS policy: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page'],
  })
);

// ─── Global Rate Limiter: 100 req / 15 min ────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  message: {
    success: false,
    error: 'Too many requests. Please try again in 15 minutes.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  handler: (req, res, next, options) => {
    logger.warn(`Global rate limit hit: ${req.ip} → ${req.originalUrl}`);
    res.status(429).json(options.message);
  },
});

// Auth-specific rate limiter: 10 req / 1 min
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  message: {
    success: false,
    error: 'Too many authentication attempts. Please wait 1 minute.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
  },
  handler: (req, res, next, options) => {
    logger.warn(`Auth rate limit hit: ${req.ip} → ${req.originalUrl}`);
    res.status(429).json(options.message);
  },
});

// Issuance limiter: 20 req / 15 min (blockchain ops are expensive)
const issuanceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.institutionId || req.ip,
  message: {
    success: false,
    error: 'Issuance rate limit reached. Max 20 operations per 15 minutes.',
    code: 'ISSUANCE_RATE_LIMIT_EXCEEDED',
  },
});

app.use(globalLimiter);

// ─── Body Parsers ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Request Logger ───────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level](
      `${req.method} ${req.originalUrl} ${res.statusCode} — ${duration}ms — ${req.ip}`
    );
  });
  next();
});

// ─── Health Check (no auth, no rate limit) ────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

app.get('/api/v1/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ─── Route Mounts ─────────────────────────────────────────────────────────────
// Auth — tighter rate limit
app.use('/api/v1/auth', authLimiter, authRoutes);

// Super admin — separate JWT claim enforced inside
app.use('/api/v1/admin', superAdminRoutes);

// Institution management (admin-facing)
app.use('/api/v1/institutions', institutionRoutes);

// Core resource routes
app.use('/api/v1/courses', courseRoutes);
app.use('/api/v1/certificates', certificateRoutes);
app.use('/api/v1/badges', badgeRoutes);
app.use('/api/v1/recipients', recipientRoutes);

// Issuance — blockchain operations, tighter limit
app.use('/api/v1/issuance', issuanceLimiter, issuanceRoutes);

// Payments & on-chain verification
app.use('/api/v1/payments', paymentRoutes);

// Oracle Object Storage proxy
app.use('/api/v1/storage', storageRoutes);

// Public certificate/badge verification (unauthenticated)
app.use('/api/v1/verify', verifyRoutes);

// Webhook receivers (WalletConnect, payment callbacks)
app.use('/api/v1/webhooks', webhookRoutes);

// Platform config (brand name, email settings, etc.)
app.use('/api/v1/config', configRoutes);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    code: 'NOT_FOUND',
    path: req.originalUrl,
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Startup ──────────────────────────────────────────────────────────────────
async function bootstrap() {
  try {
    // Test blockchain connections
    await testConnections();

    // Start email queue cron
    scheduleEmailCron();

    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`────────────────────────────────────────`);
      logger.info(`  ImperialSeal API running on port ${PORT}`);
      logger.info(`  Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`  Frontend URL: ${process.env.FRONTEND_URL}`);
      logger.info(`────────────────────────────────────────`);
    });
  } catch (err) {
    logger.error('Bootstrap failed:', err);
    process.exit(1);
  }
}

bootstrap();

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

module.exports = app; // exported for testing