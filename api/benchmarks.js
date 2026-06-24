// GET  /api/benchmarks?scholar_id=123
// POST /api/benchmarks  { scholar_id, strand, quarter, level, notes? }
//
// Implements the official transcript record per the Grading and Transcript
// Policy (Master Doc Part IV.1): level 1=Beginning, 2=Approaching,
// 3=Proficient, 4=Advanced. One row per scholar/strand/quarter -- a
// re-submission for the same quarter updates that record rather than
// duplicating it, since a benchmark is the documented final word for that
// quarter, not a running log.
import { sql, requireDb } from '../lib/db.js';
import { requireRole, getCurrentUser } from '../lib/auth.js';

const LEVEL_LABEL = { 1: 'Beginning', 2: 'Approaching', 3: 'Proficient', 4: 'Advanced' };

export default async function handler(req, res) {
  if (!requireDb(res)) return;

  if (req.method === 'GET') {
    const user = getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'Not logged in.' });
    const scholarId = req.query.scholar_id || (user.role === 'scholar' ? user.id : null);
    if (!scholarId) return res.status(400).json({ error: 'scholar_id is required.' });
    if (user.role === 'scholar' && String(user.id) !== String(scholarId)) {
      return res.status(403).json({ error: 'You can only view your own benchmark scores.' });
    }
    if (user.role === 'family') {
      const { rows: linkRows } = await sql`SELECT 1 FROM family_links WHERE family_user_id = ${user.id} AND scholar_user_id = ${scholarId}`;
      if (linkRows.length === 0) return res.status(403).json({ error: 'You are not linked to this scholar.' });
    }

    try {
      const { rows } = await sql`
        SELECT strand, quarter, level, notes, created_at FROM benchmark_scores
        WHERE scholar_user_id = ${scholarId}
        ORDER BY quarter DESC, strand ASC
      `;
      const withLabels = rows.map(r => ({ ...r, levelLabel: LEVEL_LABEL[r.level] }));
      return res.status(200).json({ records: withLabels });
    } catch (err) {
      console.error('Benchmarks GET error:', err);
      return res.status(500).json({ error: 'Could not load benchmark scores.', detail: err.message });
    }
  }

  if (req.method === 'POST') {
    if (!requireRole(req, res, ['teacher', 'admin'])) return;
    const recorder = getCurrentUser(req);
    const { scholar_id, strand, quarter, level, notes } = req.body || {};

    if (!scholar_id || !strand || !quarter || ![1, 2, 3, 4].includes(level)) {
      return res.status(400).json({ error: 'scholar_id, strand, quarter, and level (1-4) are all required.' });
    }

    try {
      const { rows } = await sql`
        INSERT INTO benchmark_scores (scholar_user_id, strand, quarter, level, notes, recorded_by)
        VALUES (${scholar_id}, ${strand}, ${quarter}, ${level}, ${notes || null}, ${recorder.id})
        ON CONFLICT (scholar_user_id, strand, quarter)
        DO UPDATE SET level = EXCLUDED.level, notes = EXCLUDED.notes, recorded_by = EXCLUDED.recorded_by
        RETURNING strand, quarter, level, notes
      `;
      return res.status(200).json({ recorded: { ...rows[0], levelLabel: LEVEL_LABEL[rows[0].level] } });
    } catch (err) {
      console.error('Benchmarks POST error:', err);
      return res.status(500).json({ error: 'Could not record benchmark score.', detail: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
