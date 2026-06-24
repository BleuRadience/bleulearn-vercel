// GET  /api/field-trips       -- the logged-in scholar's real visit record + total points
// POST /api/field-trips { trip_name, strand?, points_awarded }
//      Same real-points pattern as library.js, replacing cosmetic tracking.
import { sql, requireDb } from '../lib/db.js';
import { getCurrentUser } from '../lib/auth.js';
import { record } from '../lib/activityLog.js';

export default async function handler(req, res) {
  if (!requireDb(res)) return;
  const user = getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Not logged in.' });

  if (req.method === 'GET') {
    const { rows } = await sql`SELECT * FROM field_trip_visits WHERE scholar_user_id = ${user.id} ORDER BY visited_at DESC`;
    const totalPoints = rows.reduce((sum, r) => sum + r.points_awarded, 0);
    return res.status(200).json({ visits: rows, count: rows.length, totalPoints });
  }

  if (req.method === 'POST') {
    const { trip_name, strand, points_awarded } = req.body || {};
    if (!trip_name || !Number.isInteger(points_awarded) || points_awarded <= 0) {
      return res.status(400).json({ error: 'trip_name and a positive integer points_awarded are required.' });
    }
    try {
      const { rows } = await sql`
        INSERT INTO field_trip_visits (scholar_user_id, trip_name, strand, points_awarded)
        VALUES (${user.id}, ${trip_name}, ${strand || null}, ${points_awarded})
        RETURNING *
      `;
      await sql`
        INSERT INTO points_ledger (scholar_user_id, points, reason, strand)
        VALUES (${user.id}, ${points_awarded}, ${'Visited: ' + trip_name}, ${strand || null})
      `;
      await record(user.id, 'field_trip_visited', 'field_trip_visits', { trip_name, points_awarded });
      return res.status(201).json({ visit: rows[0] });
    } catch (err) {
      if (err.message && err.message.includes('duplicate')) {
        return res.status(409).json({ error: 'You already recorded this trip.' });
      }
      console.error('Field trips POST error:', err);
      return res.status(500).json({ error: 'Could not record this visit.', detail: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
