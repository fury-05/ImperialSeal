/**
 * ImperialSeal — Supabase Database Client
 * Uses service-role key (full bypass of RLS) for all server-side operations.
 *
 * Exports:
 *   supabase          — raw Supabase client (for complex queries)
 *   db.query()        — select rows with filters
 *   db.single()       — select exactly one row
 *   db.insert()       — insert one or many rows
 *   db.update()       — update rows matching a filter
 *   db.remove()       — delete rows matching a filter
 *   db.rpc()          — call a Postgres RPC / stored function
 *   db.count()        — count rows matching a filter
 */

'use strict';

const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

// ─── Validate required environment variables ──────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  logger.error(
    'Missing Supabase environment variables: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY'
  );
  process.exit(1);
}

// ─── Supabase Client ──────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'x-application-name': 'imperialseal-api',
    },
  },
});

// ─── Error Helper ─────────────────────────────────────────────────────────────
/**
 * Throw a normalised error from a Supabase response.
 * Attaches .status for the global error handler.
 */
function throwDbError(error, context = '') {
  const msg = error?.message || 'Database operation failed';
  const dbError = new Error(context ? `[${context}] ${msg}` : msg);
  dbError.code = error?.code;
  dbError.details = error?.details;
  dbError.hint = error?.hint;
  dbError.status = 500;
  throw dbError;
}

// ─── db helpers ───────────────────────────────────────────────────────────────

const db = {
  /**
   * query(table, options)
   * SELECT rows from a table.
   *
   * @param {string} table  - Table name
   * @param {object} opts
   * @param {string}   [opts.select='*']           - Column selector
   * @param {object}   [opts.filters={}]           - { column: value } equality filters
   * @param {Array}    [opts.rawFilters=[]]         - [{ method, args }] for .gte(), .like(), etc.
   * @param {object}   [opts.order]                 - { column, ascending? }
   * @param {number}   [opts.limit]
   * @param {number}   [opts.offset]
   * @returns {Promise<Array>}
   */
  async query(table, opts = {}) {
    const {
      select = '*',
      filters = {},
      rawFilters = [],
      order,
      limit,
      offset,
    } = opts;

    let q = supabase.from(table).select(select);

    // Equality filters
    for (const [col, val] of Object.entries(filters)) {
      if (val === null) {
        q = q.is(col, null);
      } else {
        q = q.eq(col, val);
      }
    }

    // Raw filter methods: [{ method: 'gte', args: ['created_at', date] }]
    for (const { method, args } of rawFilters) {
      if (typeof q[method] === 'function') {
        q = q[method](...args);
      }
    }

    if (order) {
      q = q.order(order.column, { ascending: order.ascending ?? true });
    }
    if (limit !== undefined) q = q.limit(limit);
    if (offset !== undefined) q = q.range(offset, offset + (limit || 50) - 1);

    const { data, error } = await q;
    if (error) throwDbError(error, `query:${table}`);
    return data || [];
  },

  /**
   * single(table, filters, select)
   * SELECT exactly one row. Throws 404-style error if not found.
   *
   * @param {string} table
   * @param {object} filters   - { column: value } equality filters
   * @param {string} [select='*']
   * @returns {Promise<object>}
   */
  async single(table, filters = {}, select = '*') {
    let q = supabase.from(table).select(select);

    for (const [col, val] of Object.entries(filters)) {
      if (val === null) {
        q = q.is(col, null);
      } else {
        q = q.eq(col, val);
      }
    }

    const { data, error } = await q.maybeSingle();

    if (error) throwDbError(error, `single:${table}`);

    if (!data) {
      const notFound = new Error(`Record not found in ${table}`);
      notFound.status = 404;
      notFound.code = 'NOT_FOUND';
      throw notFound;
    }

    return data;
  },

  /**
   * insert(table, payload, returning)
   * INSERT one row or multiple rows.
   *
   * @param {string}          table
   * @param {object|Array}    payload   - Single object or array of objects
   * @param {string}          [returning='*']
   * @returns {Promise<object|Array>}  - Inserted row(s)
   */
  async insert(table, payload, returning = '*') {
    const { data, error } = await supabase
      .from(table)
      .insert(payload)
      .select(returning);

    if (error) throwDbError(error, `insert:${table}`);

    // Return single object if single row was inserted
    if (!Array.isArray(payload) && data && data.length === 1) {
      return data[0];
    }
    return data || [];
  },

  /**
   * update(table, filters, payload, returning)
   * UPDATE rows matching filters.
   *
   * @param {string}  table
   * @param {object}  filters   - { column: value } equality filters
   * @param {object}  payload   - Fields to update
   * @param {string}  [returning='*']
   * @returns {Promise<Array>}  - Updated rows
   */
  async update(table, filters = {}, payload = {}, returning = '*') {
    let q = supabase.from(table).update(payload);

    for (const [col, val] of Object.entries(filters)) {
      if (val === null) {
        q = q.is(col, null);
      } else {
        q = q.eq(col, val);
      }
    }

    const { data, error } = await q.select(returning);
    if (error) throwDbError(error, `update:${table}`);
    return data || [];
  },

  /**
   * remove(table, filters)
   * DELETE rows matching filters.
   *
   * @param {string}  table
   * @param {object}  filters  - { column: value } equality filters (REQUIRED — prevents full-table delete)
   * @returns {Promise<void>}
   */
  async remove(table, filters = {}) {
    if (Object.keys(filters).length === 0) {
      throw new Error(
        `db.remove() called on "${table}" with no filters. Full-table deletes are not allowed.`
      );
    }

    let q = supabase.from(table).delete();

    for (const [col, val] of Object.entries(filters)) {
      if (val === null) {
        q = q.is(col, null);
      } else {
        q = q.eq(col, val);
      }
    }

    const { error } = await q;
    if (error) throwDbError(error, `remove:${table}`);
  },

  /**
   * rpc(functionName, params)
   * Call a Supabase / Postgres RPC function.
   *
   * @param {string} functionName
   * @param {object} [params={}]
   * @returns {Promise<any>}
   */
  async rpc(functionName, params = {}) {
    const { data, error } = await supabase.rpc(functionName, params);
    if (error) throwDbError(error, `rpc:${functionName}`);
    return data;
  },

  /**
   * count(table, filters)
   * COUNT rows matching filters.
   *
   * @param {string} table
   * @param {object} [filters={}]
   * @returns {Promise<number>}
   */
  async count(table, filters = {}) {
    let q = supabase.from(table).select('*', { count: 'exact', head: true });

    for (const [col, val] of Object.entries(filters)) {
      if (val === null) {
        q = q.is(col, null);
      } else {
        q = q.eq(col, val);
      }
    }

    const { count, error } = await q;
    if (error) throwDbError(error, `count:${table}`);
    return count || 0;
  },

  /**
   * upsert(table, payload, onConflict, returning)
   * INSERT or UPDATE (upsert) rows.
   *
   * @param {string}        table
   * @param {object|Array}  payload
   * @param {string}        onConflict  - Conflict column(s), e.g. 'id' or 'email,institution_id'
   * @param {string}        [returning='*']
   * @returns {Promise<object|Array>}
   */
  async upsert(table, payload, onConflict, returning = '*') {
    const { data, error } = await supabase
      .from(table)
      .upsert(payload, { onConflict })
      .select(returning);

    if (error) throwDbError(error, `upsert:${table}`);
    if (!Array.isArray(payload) && data && data.length === 1) return data[0];
    return data || [];
  },
};

module.exports = { supabase, db };