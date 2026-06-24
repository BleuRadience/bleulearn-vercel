// GET   /api/notifications              -- the logged-in user's notifications, newest first
// PATCH /api/notifications { id }       -- mark one notification read
import { sql, requireDb } from '../lib/db.js';
import { getCurrentUser } from '../lib/auth.js';

export default async function handler(req, res) {
  if (!requireDb(res)) return;
  const user = getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Not logged in.' });

  if (req.method === 'GET') {
    const { rows } = await sql`
      SELECT * FROM notifications WHERE user_id = ${user.id} ORDER BY created_at DESC LIMIT 50
    `;
    const unreadCount = rows.filter(n => !n.is_read).length;
    return res.status(200).json({ notifications: rows, unreadCount });
  }

  if (req.method === 'PATCH') {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id is required.' });
    const { rows } = await sql`
      UPDATE notifications SET is_read = true WHERE id = ${id} AND user_id = ${user.id} RETURNING *
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Notification not found.' });
    return res.status(200).json({ notification: rows[0] });
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
