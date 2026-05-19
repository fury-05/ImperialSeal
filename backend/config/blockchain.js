/**
 * ImperialSeal — Blockchain Client Configuration
 * Supports two networks: VOI Network and Algorand Mainnet
 *
 * Exports:
 *   getClient(blockchain)     → { algod, indexer, network }
 *   testConnections()         → logs status of both chains at startup
 *   BLOCKCHAIN                → enum { VOI: 'voi', ALGORAND: 'algorand' }
 */

'use strict';

const algosdk = require('algosdk');
const logger = require('../utils/logger');

// ─── Blockchain identifier enum ───────────────────────────────────────────────
const BLOCKCHAIN = Object.freeze({
  VOI: 'voi',
  ALGORAND: 'algorand',
});

// ─── Validate env ─────────────────────────────────────────────────────────────
const REQUIRED_ENV = [
  'VOI_ALGOD_URL',
  'VOI_ALGOD_TOKEN',
  'VOI_ALGOD_PORT',
  'VOI_INDEXER_URL',
  'VOI_INDEXER_TOKEN',
  'VOI_INDEXER_PORT',
  'ALGORAND_ALGOD_URL',
  'ALGORAND_ALGOD_TOKEN',
  'ALGORAND_ALGOD_PORT',
  'ALGORAND_INDEXER_URL',
  'ALGORAND_INDEXER_TOKEN',
  'ALGORAND_INDEXER_PORT',
];

const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length > 0) {
  logger.error(`Missing blockchain env vars: ${missing.join(', ')}`);
  process.exit(1);
}

// ─── Client factories ─────────────────────────────────────────────────────────

/**
 * Build an algod client.
 * algosdk.Algodv2 constructor: (token, server, port)
 * For services that expect a header token (Nodely, etc.), token can be a header object.
 */
function buildAlgodClient(url, token, port) {
  // If token looks like a header key-value pair (JSON string), parse it
  let parsedToken = token;
  if (token.startsWith('{')) {
    try {
      parsedToken = JSON.parse(token);
    } catch (_) {
      // use as-is
    }
  }
  return new algosdk.Algodv2(parsedToken, url, port);
}

/**
 * Build an indexer client.
 * algosdk.Indexer constructor: (token, server, port)
 */
function buildIndexerClient(url, token, port) {
  let parsedToken = token;
  if (token.startsWith('{')) {
    try {
      parsedToken = JSON.parse(token);
    } catch (_) {
      // use as-is
    }
  }
  return new algosdk.Indexer(parsedToken, url, port);
}

// ─── VOI Network ──────────────────────────────────────────────────────────────
const voiAlgod = buildAlgodClient(
  process.env.VOI_ALGOD_URL,
  process.env.VOI_ALGOD_TOKEN,
  parseInt(process.env.VOI_ALGOD_PORT, 10)
);

const voiIndexer = buildIndexerClient(
  process.env.VOI_INDEXER_URL,
  process.env.VOI_INDEXER_TOKEN,
  parseInt(process.env.VOI_INDEXER_PORT, 10)
);

// ─── Algorand Mainnet ─────────────────────────────────────────────────────────
const algorandAlgod = buildAlgodClient(
  process.env.ALGORAND_ALGOD_URL,
  process.env.ALGORAND_ALGOD_TOKEN,
  parseInt(process.env.ALGORAND_ALGOD_PORT, 10)
);

const algorandIndexer = buildIndexerClient(
  process.env.ALGORAND_INDEXER_URL,
  process.env.ALGORAND_INDEXER_TOKEN,
  parseInt(process.env.ALGORAND_INDEXER_PORT, 10)
);

// ─── Client registry ─────────────────────────────────────────────────────────
const clients = {
  [BLOCKCHAIN.VOI]: {
    algod: voiAlgod,
    indexer: voiIndexer,
    network: BLOCKCHAIN.VOI,
    genesisId: process.env.VOI_GENESIS_ID || 'voitest-v1',
    genesisHash: process.env.VOI_GENESIS_HASH || null,
    nativeCurrency: 'VOI',
    nativeCurrencyDecimals: 6,
    // CoinGecko ID for VOI price lookup
    coingeckoId: process.env.VOI_COINGECKO_ID || 'voi-network',
    explorerBaseUrl: process.env.VOI_EXPLORER_URL || 'https://explorer.voi.network',
  },
  [BLOCKCHAIN.ALGORAND]: {
    algod: algorandAlgod,
    indexer: algorandIndexer,
    network: BLOCKCHAIN.ALGORAND,
    genesisId: 'mainnet-v1.0',
    genesisHash: 'wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=',
    nativeCurrency: 'ALGO',
    nativeCurrencyDecimals: 6,
    coingeckoId: 'algorand',
    explorerBaseUrl: 'https://algoexplorer.io',
  },
};

// ─── getClient ────────────────────────────────────────────────────────────────
/**
 * Get the algod + indexer clients for a given blockchain.
 *
 * @param {string} blockchain - 'voi' | 'algorand'
 * @returns {{ algod: algosdk.Algodv2, indexer: algosdk.Indexer, network: string,
 *             nativeCurrency: string, nativeCurrencyDecimals: number,
 *             coingeckoId: string, explorerBaseUrl: string }}
 * @throws {Error} if blockchain string is not recognised
 */
function getClient(blockchain) {
  const normalised = (blockchain || '').toLowerCase().trim();
  const client = clients[normalised];

  if (!client) {
    throw new Error(
      `Unknown blockchain: "${blockchain}". Must be one of: ${Object.values(BLOCKCHAIN).join(', ')}`
    );
  }

  return client;
}

// ─── testConnections ──────────────────────────────────────────────────────────
/**
 * Ping both algod nodes on startup. Logs a warning (not fatal) if a node
 * is unreachable — the service can still run for the healthy chain.
 *
 * @returns {Promise<void>}
 */
async function testConnections() {
  const tests = [
    { label: 'VOI Algod', client: voiAlgod },
    { label: 'VOI Indexer', client: voiIndexer },
    { label: 'Algorand Algod', client: algorandAlgod },
    { label: 'Algorand Indexer', client: algorandIndexer },
  ];

  const results = await Promise.allSettled(
    tests.map(async ({ label, client }) => {
      // .versionsCheck() (for algod) or .makeHealthCheck() (for indexer) are the lightest probes
      if (client instanceof algosdk.Algodv2) {
        const status = await client.versionsCheck().do();
        return { label, ok: true, version: status?.build?.version || 'unknown' };
      } else {
        // Indexer
        const health = await client.makeHealthCheck().do();
        return { label, ok: true, round: health?.round || 0 };
      }
    })
  );

  for (let i = 0; i < results.length; i++) {
    const { label } = tests[i];
    const result = results[i];
    if (result.status === 'fulfilled') {
      const { version, round } = result.value;
      const detail = version ? `version: ${version}` : `round: ${round}`;
      logger.info(`  ✓ ${label} connected (${detail})`);
    } else {
      logger.warn(`  ✗ ${label} unreachable: ${result.reason?.message || 'unknown error'}`);
    }
  }
}

// ─── Utility: μALGO / μVOI ← → base unit helpers ────────────────────────────

/**
 * Convert human-readable amount to microunits (e.g., 1.5 ALGO → 1500000).
 * @param {number} amount
 * @returns {number}
 */
function toMicroUnits(amount) {
  return Math.round(amount * 1_000_000);
}

/**
 * Convert microunits to human-readable amount (e.g., 1500000 → 1.5).
 * @param {number} microAmount
 * @returns {number}
 */
function fromMicroUnits(microAmount) {
  return microAmount / 1_000_000;
}

/**
 * Get the current suggested transaction parameters (fee, first/last valid round).
 * @param {string} blockchain - 'voi' | 'algorand'
 * @returns {Promise<object>} suggestedParams
 */
async function getSuggestedParams(blockchain) {
  const { algod } = getClient(blockchain);
  return algod.getTransactionParams().do();
}

module.exports = {
  BLOCKCHAIN,
  getClient,
  testConnections,
  toMicroUnits,
  fromMicroUnits,
  getSuggestedParams,
};