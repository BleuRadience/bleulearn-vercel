// ============================================================================
// POST /api/migrate -- one-time database initialization
// AvaBleu House HQ | BleuLearn Sovereign Curriculum | 2026
//
// Runs lib/schema.sql against the connected Postgres database. Every
// statement in that file is CREATE TABLE IF NOT EXISTS / CREATE INDEX IF
// NOT EXISTS, so calling this endpoint twice (or a hundred times) is safe
// and does not duplicate or destroy anything.
//
// PROTECTED BY MIGRATE_SECRET so a random visitor cannot trigger it.
// Set MIGRATE_SECRET in Vercel's environment variables to any string,
// then run:
//   curl -X POST https://yourdomain.vercel.app/api/migrate \
//     -H "Authorization: Bearer YOUR_MIGRATE_SECRET"
//
// Run this exactly once after the database is first connected. You do
// not need to run it again unless lib/schema.sql is later extended with
// new tables -- in that case, re-running it safely adds only what is new.
// ============================================================================

import { sql, requireDb } from '../lib/db.js';
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  if (!process.env.MIGRATE_SECRET) {
    return res.status(500).json({
      error: 'MIGRATE_SECRET is not set in this environment. Set it before this endpoint can run, ' +
             'so that database migrations cannot be triggered by an unauthenticated request.'
    });
  }

  const auth = req.headers.authorization || '';
  if (auth !== `Bearer ${process.env.MIGRATE_SECRET}`) {
    return res.status(401).json({ error: 'Invalid or missing migration secret.' });
  }

  if (!requireDb(res)) return; // writes its own 503 if POSTGRES_URL is missing

  try {
    const schemaPath = path.join(process.cwd(), 'lib', 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

    // Strip '--' line comments FIRST, line by line, before splitting on
    // semicolons. An earlier version of this only checked whether an
    // entire split statement started with '--', which incorrectly merged
    // schema.sql's leading multi-line comment block into the first real
    // CREATE TABLE statement and silently dropped it -- the users table
    // would never have been created. Caught by running this against a real
    // SQL engine in testing, not assumed correct from reading the code.
    const withoutComments = schemaSql
      .split('\n')
      .map(line => {
        const idx = line.indexOf('--');
        return idx === -1 ? line : line.slice(0, idx);
      })
      .join('\n');

    const statements = withoutComments
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const results = [];
    for (const statement of statements) {
      await sql.query(statement);
      results.push(statement.slice(0, 60).replace(/\s+/g, ' ') + '...');
    }

    return res.status(200).json({
      success: true,
      statementsRun: results.length,
      preview: results
    });
  } catch (err) {
    console.error('Migration error:', err);
    return res.status(500).json({ error: 'Migration failed.', detail: err.message });
  }
}
