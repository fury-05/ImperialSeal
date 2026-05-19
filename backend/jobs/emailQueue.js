/**
 * ImperialSeal — Email Queue Cron Job
 * Runs every 15 minutes. Processes pending emails up to daily_limit / 96 per run.
 * Full implementation lives in services/emailQueueService.js
 * This file only exports the scheduler bootstrap used in server.js.
 */

'use strict';

const cron = require('node-cron');
const logger = require('../utils/logger');

let emailQueueService = null;

/**
 * Lazily load the email queue service to avoid circular deps at boot.
 */
function getEmailQueueService() {
  if (!emailQueueService) {
    emailQueueService = require('../services/emailQueueService');
  }
  return emailQueueService;
}

/**
 * scheduleEmailCron()
 * Called once in server.js bootstrap.
 * Schedules a cron task every 15 minutes to flush the email queue.
 */
function scheduleEmailCron() {
  // every 15 minutes: 0, 15, 30, 45
  cron.schedule('*/15 * * * *', async () => {
    logger.info('[EmailCron] Starting email queue flush...');
    try {
      const service = getEmailQueueService();
      const result = await service.processQueue();
      logger.info(
        `[EmailCron] Flush complete — sent: ${result.sent}, failed: ${result.failed}, skipped: ${result.skipped}`
      );
    } catch (err) {
      logger.error('[EmailCron] Queue flush error:', err);
    }
  });

  logger.info('[EmailCron] Scheduled — runs every 15 minutes');
}

module.exports = { scheduleEmailCron };