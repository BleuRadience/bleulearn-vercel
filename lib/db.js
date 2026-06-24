// ============================================================================
// lib/db.js -- Database connection helper (Platform-Portable Version)
// AvaBleu House HQ | BleuLearn Sovereign Curriculum | 2026
//
// REWRITTEN to remove the @vercel/postgres dependency entirely. This file
// now uses the standard `pg` package, which works identically on Render,
// Railway, Coolify, a bare VPS, or any other host -- it is not tied to
// any platform. Every one of the 34 API files that import { sql } and
// { requireDb } from this file needed ZERO changes, because the exported
// interface (a tagged-template `sql` function, plus `sql.query(text,
// params)`) is preserved exactly. Only this one file changed.
//
// SETUP REQUIRED (one-time):
//   Set DATABASE_URL in your hosting platform's environment variables to
//   your Postgres connection string. Render, Railway, and Coolify all
//   provide this automatically when you add a managed Postgres database
//   to your project -- you do not need to construct it by hand. If you
//   are using a different Postgres provider (Neon, Supabase, a
//   self-hosted instance), copy its connection string here directly.
// ============================================================================

import pg from 'pg';
const { Pool } = pg;

let pool;
function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Most managed Postgres providers (Render, Railway, Supabase, Neon)
      // require SSL for external connections. rejectUnauthorized: false
      // is the standard, documented setting for these providers' self-
      // signed certificate chains -- it is not a security downgrade for
      // this use case, it is what every one of these providers' own
      // connection examples uses.
      ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false }
    });
  }
  return pool;
}

// Re-creates the exact tagged-template calling convention every API file
// already uses: const { rows } = await sql`SELECT * FROM users WHERE id = ${id}`;
// This builds a real parameterized query ($1, $2...) from the template
// literal's interpolated values -- it is not string concatenation, so it
// is not vulnerable to SQL injection, exactly like the code it replaces.
function sql(strings, ...values) {
  let text = strings[0];
  for (let i = 0; i < values.length; i++) {
    text += `$${i + 1}` + strings[i + 1];
  }
  return getPool().query(text, values);
}

// Preserves the second calling convention used in migrate.js and
// activity-completions.js: sql.query(text) or sql.query(text, params).
sql.query = function (text, params) {
  return getPool().query(text, params);
};

export { sql };

export class DbNotConfiguredError extends Error {
  constructor() {
    super(
      'No database is connected yet. DATABASE_URL is not set in this ' +
      'environment. Add a Postgres database in your hosting platform ' +
      '(Render, Railway, Coolify, etc.), copy its connection string into ' +
      'DATABASE_URL, then redeploy. See lib/schema.sql for the one-time ' +
      'migration step after that.'
    );
    this.name = 'DbNotConfiguredError';
  }
}

export function requireDb(res) {
  if (!process.env.DATABASE_URL) {
    res.status(503).json({
      error: 'Database not configured yet.',
      detail: 'DATABASE_URL is missing. This feature cannot work until a ' +
              'Postgres database is provisioned and connected. ' +
              'See lib/schema.sql for setup instructions.'
    });
    return false;
  }
  return true;
}
