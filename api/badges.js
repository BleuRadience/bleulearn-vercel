// GET  /api/badges                                    -- list all badges
// GET  /api/badges?user_id=3                          -- one scholar's earned badges
// POST /api/badges { title, description?, icon? }     -- create a badge (teacher/admin)
// POST /api/badges/award { user_id, badge_id }         -- handled via ?action=award below
import { sql, requireDb } from '../lib/db.js';
import { getCurrentUser, requireRole } from '../lib/auth.js';
import { record } from '../lib/activityLog.js';

export default async function handler(req, res) {
  if (!requireDb(res)) return;

  if (req.method === 'GET') {
    if (req.query.user_id) {
      const { rows } = await sql`
        SELECT b.*, ub.awarded_at FROM user_badges ub JOIN badges b ON b.id = ub.badge_id
        WHERE ub.user_id = ${req.query.user_id} ORDER BY ub.awarded_at DESC
      `;
      return res.status(200).json({ badges: rows });
    }
    const { rows } = await sql`SELECT * FROM badges ORDER BY created_at DESC`;
    return res.status(200).json({ badges: rows });
  }

  if (req.method === 'POST') {
    if (!requireRole(req, res, ['teacher', 'admin'])) return;
    const user = getCurrentUser(req);
    const { action, title, description, icon, user_id, badge_id } = req.body || {};

    if (action === 'award') {
      if (!user_id || !badge_id) return res.status(400).json({ error: 'user_id and badge_id are required to award a badge.' });
      const { rows } = await sql`
        INSERT INTO user_badges (user_id, badge_id, awarded_by) VALUES (${user_id}, ${badge_id}, ${user.id})
        ON CONFLICT (user_id, badge_id) DO NOTHING RETURNING *
      `;
      await record(user.id, 'badge_awarded', 'user_badges', { user_id, badge_id });
      return res.status(201).json({ awarded: rows[0] || { already_awarded: true } });
    }

    if (!title) return res.status(400).json({ error: 'title is required to create a badge.' });
    const { rows } = await sql`
      INSERT INTO badges (title, description, icon, created_by) VALUES (${title}, ${description || null}, ${icon || '🏅'}, ${user.id}) RETURNING *
    `;
    await record(user.id, 'badge_created', 'badges', { badge_id: rows[0].id, title });
    return res.status(201).json({ badge: rows[0] });
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
