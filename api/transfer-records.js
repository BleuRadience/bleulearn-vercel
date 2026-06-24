// POST /api/transfer-records { scholar_user_id, prior_school_name?, prior_school_curriculum_notes?, transfer_date? }
// GET  /api/transfer-records?scholar_user_id=3   -- full intake record + all gap findings for that scholar
// Restricted to teacher/admin -- this is intake paperwork, not scholar-facing.
import { sql, requireDb } from '../lib/db.js';
import { requireRole, getCurrentUser } from '../lib/auth.js';
import { record } from '../lib/activityLog.js';

export default async function handler(req, res) {
  if (!requireDb(res)) return;
  if (!requireRole(req, res, ['teacher', 'admin', 'case_manager'])) return;
  const user = getCurrentUser(req);

  if (req.method === 'GET') {
    const { scholar_user_id } = req.query;
    if (!scholar_user_id) return res.status(400).json({ error: 'scholar_user_id is required.' });
    const { rows: records } = await sql`SELECT * FROM transfer_records WHERE scholar_user_id = ${scholar_user_id} ORDER BY created_at DESC`;
    const recordsWithGaps = [];
    for (const r of records) {
      const { rows: gaps } = await sql`SELECT * FROM curriculum_gap_findings WHERE transfer_record_id = ${r.id} ORDER BY strand ASC`;
      recordsWithGaps.push({ ...r, gapFindings: gaps });
    }
    return res.status(200).json({ transferRecords: recordsWithGaps });
  }

  if (req.method === 'POST') {
    const { scholar_user_id, prior_school_name, prior_school_curriculum_notes, transfer_date } = req.body || {};
    if (!scholar_user_id) return res.status(400).json({ error: 'scholar_user_id is required.' });
    const { rows } = await sql`
      INSERT INTO transfer_records (scholar_user_id, prior_school_name, prior_school_curriculum_notes, transfer_date, created_by)
      VALUES (${scholar_user_id}, ${prior_school_name || null}, ${prior_school_curriculum_notes || null}, ${transfer_date || new Date().toISOString().slice(0,10)}, ${user.id})
      RETURNING *
    `;
    await record(user.id, 'transfer_record_created', 'transfer_records', { transfer_record_id: rows[0].id, scholar_user_id });
    return res.status(201).json({ transferRecord: rows[0] });
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
