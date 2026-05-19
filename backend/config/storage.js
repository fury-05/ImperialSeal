/**
 * ImperialSeal — Oracle Cloud Object Storage Client
 * Uses S3-compatible API via @aws-sdk/client-s3
 *
 * Exports:
 *   uploadFile(buffer, key, contentType)  → public URL string
 *   deleteFile(key)                        → void
 *   getSignedUrl(key, expirySeconds)       → pre-signed URL string
 *   storageClient                          → raw S3Client (for advanced use)
 */

'use strict';

const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl: awsGetSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const logger = require('../utils/logger');

// ─── Validate env ─────────────────────────────────────────────────────────────
const REQUIRED = [
  'ORACLE_S3_ENDPOINT',
  'ORACLE_S3_REGION',
  'ORACLE_S3_ACCESS_KEY',
  'ORACLE_S3_SECRET_KEY',
  'ORACLE_S3_BUCKET',
];

for (const key of REQUIRED) {
  if (!process.env[key]) {
    logger.error(`Missing required Oracle Storage env var: ${key}`);
    process.exit(1);
  }
}

const BUCKET = process.env.ORACLE_S3_BUCKET;
const ENDPOINT = process.env.ORACLE_S3_ENDPOINT; // e.g. https://<namespace>.compat.objectstorage.<region>.oraclecloud.com
const REGION = process.env.ORACLE_S3_REGION;     // e.g. ap-mumbai-1
const PUBLIC_BASE_URL = process.env.ORACLE_S3_PUBLIC_BASE_URL || null;
// e.g. https://objectstorage.ap-mumbai-1.oraclecloud.com/n/<namespace>/b/<bucket>/o

// ─── S3 Client ────────────────────────────────────────────────────────────────
const storageClient = new S3Client({
  endpoint: ENDPOINT,
  region: REGION,
  credentials: {
    accessKeyId: process.env.ORACLE_S3_ACCESS_KEY,
    secretAccessKey: process.env.ORACLE_S3_SECRET_KEY,
  },
  // Oracle requires path-style addressing
  forcePathStyle: true,
});

// ─── Helper: build public URL ─────────────────────────────────────────────────
/**
 * Construct the public URL for an object key.
 * If ORACLE_S3_PUBLIC_BASE_URL is set, use it; otherwise assemble from parts.
 */
function buildPublicUrl(key) {
  if (PUBLIC_BASE_URL) {
    return `${PUBLIC_BASE_URL.replace(/\/$/, '')}/${encodeURIComponent(key)}`;
  }
  // Default Oracle public URL format for pre-authenticated or public buckets
  return `${ENDPOINT.replace(/\/$/, '')}/${BUCKET}/${encodeURIComponent(key)}`;
}

// ─── uploadFile ───────────────────────────────────────────────────────────────
/**
 * Upload a file buffer to Oracle Object Storage.
 *
 * @param {Buffer}  buffer       - File content as Buffer
 * @param {string}  key          - Object key / path (e.g. 'certificates/uuid.pdf')
 * @param {string}  contentType  - MIME type (e.g. 'application/pdf', 'image/png')
 * @param {object}  [options]
 * @param {boolean} [options.isPublic=true]  - Set public-read ACL
 * @param {object}  [options.metadata={}]    - Custom metadata key-value pairs
 * @returns {Promise<string>} Public URL of the uploaded object
 */
async function uploadFile(buffer, key, contentType, options = {}) {
  const { isPublic = true, metadata = {} } = options;

  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError('uploadFile: buffer must be a Buffer instance');
  }
  if (!key || typeof key !== 'string') {
    throw new TypeError('uploadFile: key must be a non-empty string');
  }
  if (!contentType || typeof contentType !== 'string') {
    throw new TypeError('uploadFile: contentType must be a non-empty string');
  }

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ContentLength: buffer.length,
    ...(isPublic ? { ACL: 'public-read' } : {}),
    ...(Object.keys(metadata).length > 0 ? { Metadata: metadata } : {}),
  });

  try {
    await storageClient.send(command);
    const url = buildPublicUrl(key);
    logger.debug(`[Storage] Uploaded: ${key} (${buffer.length} bytes) → ${url}`);
    return url;
  } catch (err) {
    logger.error(`[Storage] Upload failed for key "${key}":`, err);
    throw new Error(`Storage upload failed: ${err.message}`);
  }
}

// ─── deleteFile ───────────────────────────────────────────────────────────────
/**
 * Delete an object from Oracle Object Storage.
 *
 * @param {string} key - Object key to delete
 * @returns {Promise<void>}
 */
async function deleteFile(key) {
  if (!key || typeof key !== 'string') {
    throw new TypeError('deleteFile: key must be a non-empty string');
  }

  const command = new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  try {
    await storageClient.send(command);
    logger.debug(`[Storage] Deleted: ${key}`);
  } catch (err) {
    logger.error(`[Storage] Delete failed for key "${key}":`, err);
    throw new Error(`Storage delete failed: ${err.message}`);
  }
}

// ─── getSignedUrl ─────────────────────────────────────────────────────────────
/**
 * Generate a pre-signed (time-limited) GET URL for a private object.
 *
 * @param {string} key             - Object key
 * @param {number} [expirySeconds=3600] - URL expiry in seconds (default 1 hour)
 * @returns {Promise<string>} Pre-signed URL
 */
async function getSignedUrl(key, expirySeconds = 3600) {
  if (!key || typeof key !== 'string') {
    throw new TypeError('getSignedUrl: key must be a non-empty string');
  }
  if (typeof expirySeconds !== 'number' || expirySeconds <= 0) {
    throw new TypeError('getSignedUrl: expirySeconds must be a positive number');
  }

  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  try {
    const url = await awsGetSignedUrl(storageClient, command, {
      expiresIn: expirySeconds,
    });
    logger.debug(`[Storage] Signed URL generated for: ${key} (${expirySeconds}s)`);
    return url;
  } catch (err) {
    logger.error(`[Storage] Signed URL failed for key "${key}":`, err);
    throw new Error(`Storage signed URL failed: ${err.message}`);
  }
}

// ─── fileExists ───────────────────────────────────────────────────────────────
/**
 * Check if an object exists in Oracle Object Storage.
 *
 * @param {string} key
 * @returns {Promise<boolean>}
 */
async function fileExists(key) {
  try {
    const command = new HeadObjectCommand({ Bucket: BUCKET, Key: key });
    await storageClient.send(command);
    return true;
  } catch (err) {
    if (err.$metadata?.httpStatusCode === 404) return false;
    throw new Error(`Storage existence check failed for "${key}": ${err.message}`);
  }
}

// ─── copyFile ─────────────────────────────────────────────────────────────────
/**
 * Copy an object within the same bucket to a new key.
 *
 * @param {string} sourceKey
 * @param {string} destinationKey
 * @returns {Promise<string>} Public URL of the new object
 */
async function copyFile(sourceKey, destinationKey) {
  const command = new CopyObjectCommand({
    Bucket: BUCKET,
    CopySource: `${BUCKET}/${sourceKey}`,
    Key: destinationKey,
  });

  try {
    await storageClient.send(command);
    return buildPublicUrl(destinationKey);
  } catch (err) {
    logger.error(`[Storage] Copy failed "${sourceKey}" → "${destinationKey}":`, err);
    throw new Error(`Storage copy failed: ${err.message}`);
  }
}

// ─── Key Builders (centralised naming conventions) ────────────────────────────
const storageKeys = {
  /**
   * Certificate PDF
   * @param {string} institutionId
   * @param {string} courseId
   * @param {string} issuanceId
   */
  certificatePdf: (institutionId, courseId, issuanceId) =>
    `institutions/${institutionId}/courses/${courseId}/certificates/${issuanceId}.pdf`,

  /**
   * Badge image (PNG)
   */
  badgeImage: (institutionId, courseId, badgeId) =>
    `institutions/${institutionId}/courses/${courseId}/badges/${badgeId}.png`,

  /**
   * Template design file
   */
  template: (institutionId, templateId, ext = 'html') =>
    `institutions/${institutionId}/templates/${templateId}.${ext}`,

  /**
   * Institution logo
   */
  institutionLogo: (institutionId, ext = 'png') =>
    `institutions/${institutionId}/assets/logo.${ext}`,

  /**
   * Course banner image
   */
  courseBanner: (institutionId, courseId, ext = 'jpg') =>
    `institutions/${institutionId}/courses/${courseId}/banner.${ext}`,

  /**
   * QR code PNG
   */
  qrCode: (issuanceId) =>
    `qr-codes/${issuanceId}.png`,
};

module.exports = {
  storageClient,
  uploadFile,
  deleteFile,
  getSignedUrl,
  fileExists,
  copyFile,
  storageKeys,
  buildPublicUrl,
};