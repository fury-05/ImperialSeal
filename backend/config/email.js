/**
 * ImperialSeal — Email Factory
 * Reads the active email provider from DB (platform_config + email_providers)
 * and routes sendEmail() to the correct implementation.
 *
 * Providers supported:
 *   sendgrid  — @sendgrid/mail (dynamically required)
 *   mailgun   — form-data + axios POST to Mailgun API
 *   smtp      — nodemailer (dynamically required)
 *   resend    — axios POST to resend.com API
 *   console   — logs to console (development fallback)
 *
 * sendEmail({ to, subject, html, text?, attachments?, replyTo?, cc?, bcc? })
 *   → Promise<{ messageId, provider }>
 */

'use strict';

const axios = require('axios');
const logger = require('../utils/logger');
const { db } = require('./database');

// ─── Cache active provider config (refreshed every 5 min) ────────────────────
let cachedProviderConfig = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Load active email provider config from DB.
 * Returns { provider, from_name, from_email, api_key, domain, smtp_host,
 *           smtp_port, smtp_user, smtp_pass, smtp_secure }
 */
async function getProviderConfig() {
  const now = Date.now();
  if (cachedProviderConfig && now < cacheExpiresAt) {
    return cachedProviderConfig;
  }

  try {
    // Get active provider name from platform_config
    const activeProviderRow = await db.single('platform_config', { key: 'email_provider' });
    const providerName = activeProviderRow?.value || 'console';

    // Get provider credentials from email_providers table
    let providerRow = null;
    try {
      providerRow = await db.single('email_providers', {
        provider: providerName,
        is_active: true,
      });
    } catch (err) {
      if (err.code !== 'NOT_FOUND') throw err;
      // Provider row missing — fall back to console
      logger.warn(`[Email] Provider "${providerName}" not found in email_providers. Using console.`);
    }

    const config = {
      provider: providerRow ? providerName : 'console',
      from_name: providerRow?.from_name || 'ImperialSeal',
      from_email: providerRow?.from_email || 'noreply@imperialseal.io',
      api_key: providerRow?.api_key || null,
      domain: providerRow?.domain || null,
      smtp_host: providerRow?.smtp_host || null,
      smtp_port: providerRow?.smtp_port || 587,
      smtp_user: providerRow?.smtp_user || null,
      smtp_pass: providerRow?.smtp_pass || null,
      smtp_secure: providerRow?.smtp_secure || false,
    };

    cachedProviderConfig = config;
    cacheExpiresAt = now + CACHE_TTL_MS;
    return config;
  } catch (err) {
    logger.error('[Email] Failed to load provider config:', err);
    // Return a safe console fallback so the app doesn't crash
    return {
      provider: 'console',
      from_name: 'ImperialSeal',
      from_email: 'noreply@imperialseal.io',
    };
  }
}

/**
 * Invalidate the provider config cache.
 * Call this from the super admin UI after switching providers.
 */
function invalidateEmailCache() {
  cachedProviderConfig = null;
  cacheExpiresAt = 0;
  logger.info('[Email] Provider config cache invalidated');
}

// ─── Provider Implementations ─────────────────────────────────────────────────

/**
 * SendGrid
 */
async function sendViaSendgrid(config, message) {
  let sgMail;
  try {
    sgMail = require('@sendgrid/mail');
  } catch (_) {
    throw new Error('SendGrid package not installed. Run: npm install @sendgrid/mail');
  }

  sgMail.setApiKey(config.api_key);

  const msg = {
    to: message.to,
    from: { name: config.from_name, email: config.from_email },
    subject: message.subject,
    html: message.html,
    ...(message.text ? { text: message.text } : {}),
    ...(message.replyTo ? { replyTo: message.replyTo } : {}),
    ...(message.cc ? { cc: message.cc } : {}),
    ...(message.bcc ? { bcc: message.bcc } : {}),
    ...(message.attachments?.length > 0
      ? {
          attachments: message.attachments.map((a) => ({
            content: a.content.toString('base64'),
            filename: a.filename,
            type: a.contentType,
            disposition: 'attachment',
          })),
        }
      : {}),
  };

  const [response] = await sgMail.send(msg);
  return { messageId: response.headers['x-message-id'] || null, provider: 'sendgrid' };
}

/**
 * Mailgun (via REST API — no extra SDK needed)
 */
async function sendViaMailgun(config, message) {
  if (!config.api_key || !config.domain) {
    throw new Error('Mailgun requires api_key and domain in email_providers table');
  }

  const FormData = require('form-data'); // built into Node.js 18 but use form-data for compat
  const form = new FormData();
  form.append('from', `${config.from_name} <${config.from_email}>`);
  form.append('to', Array.isArray(message.to) ? message.to.join(',') : message.to);
  form.append('subject', message.subject);
  form.append('html', message.html);
  if (message.text) form.append('text', message.text);
  if (message.replyTo) form.append('h:Reply-To', message.replyTo);
  if (message.cc) form.append('cc', Array.isArray(message.cc) ? message.cc.join(',') : message.cc);
  if (message.bcc) form.append('bcc', Array.isArray(message.bcc) ? message.bcc.join(',') : message.bcc);

  if (message.attachments?.length > 0) {
    for (const att of message.attachments) {
      form.append('attachment', att.content, {
        filename: att.filename,
        contentType: att.contentType,
      });
    }
  }

  const response = await axios.post(
    `https://api.mailgun.net/v3/${config.domain}/messages`,
    form,
    {
      auth: { username: 'api', password: config.api_key },
      headers: form.getHeaders(),
    }
  );

  return { messageId: response.data.id || null, provider: 'mailgun' };
}

/**
 * SMTP (via nodemailer)
 */
async function sendViaSmtp(config, message) {
  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch (_) {
    throw new Error('Nodemailer not installed. Run: npm install nodemailer');
  }

  const transporter = nodemailer.createTransporter({
    host: config.smtp_host,
    port: config.smtp_port,
    secure: config.smtp_secure,
    auth: {
      user: config.smtp_user,
      pass: config.smtp_pass,
    },
  });

  const mailOptions = {
    from: `"${config.from_name}" <${config.from_email}>`,
    to: Array.isArray(message.to) ? message.to.join(',') : message.to,
    subject: message.subject,
    html: message.html,
    ...(message.text ? { text: message.text } : {}),
    ...(message.replyTo ? { replyTo: message.replyTo } : {}),
    ...(message.cc ? { cc: message.cc } : {}),
    ...(message.bcc ? { bcc: message.bcc } : {}),
    ...(message.attachments?.length > 0
      ? {
          attachments: message.attachments.map((a) => ({
            filename: a.filename,
            content: a.content,
            contentType: a.contentType,
          })),
        }
      : {}),
  };

  const info = await transporter.sendMail(mailOptions);
  return { messageId: info.messageId || null, provider: 'smtp' };
}

/**
 * Resend (resend.com)
 */
async function sendViaResend(config, message) {
  if (!config.api_key) {
    throw new Error('Resend requires api_key in email_providers table');
  }

  const payload = {
    from: `${config.from_name} <${config.from_email}>`,
    to: Array.isArray(message.to) ? message.to : [message.to],
    subject: message.subject,
    html: message.html,
    ...(message.text ? { text: message.text } : {}),
    ...(message.replyTo ? { reply_to: message.replyTo } : {}),
    ...(message.cc ? { cc: Array.isArray(message.cc) ? message.cc : [message.cc] } : {}),
    ...(message.bcc ? { bcc: Array.isArray(message.bcc) ? message.bcc : [message.bcc] } : {}),
    ...(message.attachments?.length > 0
      ? {
          attachments: message.attachments.map((a) => ({
            filename: a.filename,
            content: a.content.toString('base64'),
          })),
        }
      : {}),
  };

  const response = await axios.post('https://api.resend.com/emails', payload, {
    headers: {
      Authorization: `Bearer ${config.api_key}`,
      'Content-Type': 'application/json',
    },
  });

  return { messageId: response.data.id || null, provider: 'resend' };
}

/**
 * Console fallback (development / misconfiguration safety)
 */
function sendViaConsole(config, message) {
  logger.info('─────────────── [EMAIL CONSOLE FALLBACK] ───────────────');
  logger.info(`  To:      ${Array.isArray(message.to) ? message.to.join(', ') : message.to}`);
  logger.info(`  From:    ${config.from_name} <${config.from_email}>`);
  logger.info(`  Subject: ${message.subject}`);
  logger.info(`  HTML:    ${message.html?.substring(0, 200)}...`);
  if (message.attachments?.length > 0) {
    logger.info(`  Attachments: ${message.attachments.map((a) => a.filename).join(', ')}`);
  }
  logger.info('─────────────────────────────────────────────────────────');
  return Promise.resolve({ messageId: `console-${Date.now()}`, provider: 'console' });
}

// ─── sendEmail (public API) ───────────────────────────────────────────────────
/**
 * Send an email via the active provider.
 *
 * @param {object} message
 * @param {string|string[]} message.to          - Recipient email(s)
 * @param {string}          message.subject     - Email subject
 * @param {string}          message.html        - HTML body
 * @param {string}          [message.text]      - Plain text body (fallback)
 * @param {string}          [message.replyTo]   - Reply-to address
 * @param {string|string[]} [message.cc]        - CC recipient(s)
 * @param {string|string[]} [message.bcc]       - BCC recipient(s)
 * @param {Array}           [message.attachments] - [{ filename, content: Buffer, contentType }]
 *
 * @returns {Promise<{ messageId: string|null, provider: string }>}
 */
async function sendEmail(message) {
  if (!message.to || !message.subject || !message.html) {
    throw new Error('sendEmail: to, subject, and html are required');
  }

  const config = await getProviderConfig();

  // Development override — always use console unless explicitly opt-out
  if (process.env.NODE_ENV === 'development' && process.env.EMAIL_FORCE_PROVIDER !== 'true') {
    return sendViaConsole(config, message);
  }

  try {
    switch (config.provider) {
      case 'sendgrid':
        return await sendViaSendgrid(config, message);
      case 'mailgun':
        return await sendViaMailgun(config, message);
      case 'smtp':
        return await sendViaSmtp(config, message);
      case 'resend':
        return await sendViaResend(config, message);
      case 'console':
      default:
        return await sendViaConsole(config, message);
    }
  } catch (err) {
    logger.error(`[Email] Send failed via ${config.provider}:`, err.message);
    throw err;
  }
}

module.exports = {
  sendEmail,
  invalidateEmailCache,
  getProviderConfig,
};