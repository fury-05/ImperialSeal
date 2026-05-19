/**
 * ImperialSeal — Winston Logger
 * Structured logging with daily rotation
 */

'use strict';

const { createLogger, format, transports } = require('winston');
require('winston-daily-rotate-file');
const path = require('path');

const { combine, timestamp, printf, colorize, errors, json } = format;

const isProduction = process.env.NODE_ENV === 'production';

// Human-readable format for development
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}]: ${stack || message}${metaStr}`;
  })
);

// JSON format for production (PM2 + log aggregators)
const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

const logTransports = [];

if (isProduction) {
  // Rotating file: error
  logTransports.push(
    new transports.DailyRotateFile({
      filename: path.join('logs', 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true,
    })
  );

  // Rotating file: combined
  logTransports.push(
    new transports.DailyRotateFile({
      filename: path.join('logs', 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '50m',
      maxFiles: '14d',
      zippedArchive: true,
    })
  );

  // Also log to stdout for PM2 capture
  logTransports.push(
    new transports.Console({
      format: prodFormat,
    })
  );
} else {
  logTransports.push(
    new transports.Console({
      format: devFormat,
    })
  );
}

const logger = createLogger({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  transports: logTransports,
  exitOnError: false,
});

module.exports = logger;