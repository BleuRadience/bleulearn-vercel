// GET  /api/points?scholar_id=123        -- list a scholar's point ledger + total
// POST /api/points  { scholar_id, points, reason, strand? }  -- award points
//
// Award-points is restricted to teacher/admin per the existing BleuLearn
// philosophy that points are never self-assigned and never subtracted --
// this endpoint structurally enforces "never subtracted" by never offering
// an update or delete operation at all. Every award is a new row, forever.
import { sql, requireDb } from '../lib/db.js';
import { getCurrentUser, requireRole } from '../lib/auth.js';

export default async function handler(req, res) {
  if (!requireDb(res)) return;

  if (req.method === 'GET') {
    const user = getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'Not logged in.' });

    const scholarId = req.query.scholar_id || (user.role === 'scholar' ? user.id : null);
    if (!scholarId) return res.status(400).json({ error: 'scholar_id is required.' });

    // Scholars and family can only view their own/linked scholar's points.
    // Teachers and admins can view any scholar.
    if (user.role === 'scholar' && String(user.id) !== String(scholarId)) {
      return res.status(403).json({ error: "You can only view your own points." });
    }
    if (user.role === 'family') {
      const { rows: linkRows } = await sql`SELECT 1 FROM family_links WHERE family_user_id = ${user.id} AND scholar_user_id = ${scholarId}`;
      if (linkRows.length === 0) return res.status(403).json({ error: 'You are not linked to this scholar.' });
    }

    try {
      const total = await sql`SELECT COALESCE(SUM(points), 0) AS total FROM points_ledger WHERE scholar_user_id = ${scholarId}`;
      const ledger = await sql`
        SELECT points, reason, strand, created_at FROM points_ledger
        WHERE scholar_user_id = ${scholarId}
        ORDER BY created_at DESC LIMIT 100
      `;
      return res.status(200).json({ total: Number(total.rows[0].total), ledger: ledger.rows });
    } catch (err) {
      console.error('Points GET error:', err);
      return res.status(500).json({ error: 'Could not load points.', detail: err.message });
    }
  }

  if (req.method === 'POST') {
    if (!requireRole(req, res, ['teacher', 'admin'])) return;
    const awarder = getCurrentUser(req);
    const { scholar_id, points, reason, strand } = req.body || {};

    if (!scholar_id || !Number.isInteger(points) || !reason) {
      return res.status(400).json({ error: 'scholar_id, integer points, and reason are required.' });
    }
    if (points <= 0) {
      return res.status(400).json({ error: 'Points must be positive. This system never subtracts points -- see the House System documentation for why.' });
    }

    try {
      const { rows } = await sql`
        INSERT INTO points_ledger (scholar_user_id, points, reason, strand, awarded_by)
        VALUES (${scholar_id}, ${points}, ${reason}, ${strand || null}, ${awarder.id})
        RETURNING id, points, reason, strand, created_at
      `;
      return res.status(201).json({ awarded: rows[0] });
    } catch (err) {
      console.error('Points POST error:', err);
      return res.status(500).json({ error: 'Could not award points.', detail: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
