// ============================================================================
// lib/activityLog.js -- the audit trail (Moodle calls this "Logs")
// AvaBleu House HQ | BleuLearn Sovereign Curriculum | 2026
//
// Every API route that creates, grades, submits, or enrolls should call
// record() after a successful write. This is fire-and-forget: a logging
// failure must never break the actual operation it's describing, so
// record() swallows its own errors after logging them to the console.
// ============================================================================

import { sql } from './db.js';

export async function record(userId, action, context, details) {
  try {
    await sql`
      INSERT INTO activity_log (user_id, action, context, details)
      VALUES (${userId || null}, ${action}, ${context || null}, ${details ? JSON.stringify(details) : null})
    `;
  } catch (err) {
    console.error('Non-fatal: activity log write failed:', err);
  }
}
