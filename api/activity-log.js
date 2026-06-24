// GET /api/activity-log?user_id=3   -- one user's audit history (admin only, or your own)
// GET /api/activity-log             -- site-wide recent activity (admin only)
import { sql, requireDb } from '../lib/db.js';
import { getCurrentUser } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });
  if (!requireDb(res)) return;
  const user = getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Not logged in.' });

  if (req.query.user_id) {
    if (String(req.query.user_id) !== String(user.id) && user.role !== 'admin') {
      return res.status(403).json({ error: 'You can only view your own activity log.' });
    }
    const { rows } = await sql`SELECT * FROM activity_log WHERE user_id = ${req.query.user_id} ORDER BY created_at DESC LIMIT 200`;
    return res.status(200).json({ log: rows });
  }

  if (user.role !== 'admin') return res.status(403).json({ error: 'Site-wide activity log requires admin role.' });
  const { rows } = await sql`SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 200`;
  return res.status(200).json({ log: rows });
}
