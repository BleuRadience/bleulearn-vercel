// POST /api/admin/family-links { family_user_id, scholar_user_id } -- admin only
// GET  /api/admin/family-links?scholar_user_id=3                  -- admin only
import { sql, requireDb } from '../../lib/db.js';
import { requireRole, getCurrentUser } from '../../lib/auth.js';
import { record } from '../../lib/activityLog.js';

export default async function handler(req, res) {
  if (!requireDb(res)) return;
  if (!requireRole(req, res, ['admin'])) return;
  const admin = getCurrentUser(req);

  if (req.method === 'POST') {
    const { family_user_id, scholar_user_id } = req.body || {};
    if (!family_user_id || !scholar_user_id) {
      return res.status(400).json({ error: 'family_user_id and scholar_user_id are required.' });
    }
    const { rows } = await sql`
      INSERT INTO family_links (family_user_id, scholar_user_id) VALUES (${family_user_id}, ${scholar_user_id})
      ON CONFLICT DO NOTHING RETURNING *
    `;
    await record(admin.id, 'family_link_created', 'family_links', { family_user_id, scholar_user_id });
    return res.status(201).json({ link: rows[0] || { already_linked: true } });
  }

  if (req.method === 'GET') {
    const { scholar_user_id } = req.query;
    if (!scholar_user_id) return res.status(400).json({ error: 'scholar_user_id is required.' });
    const { rows } = await sql`
      SELECT fl.*, u.full_name, u.email FROM family_links fl JOIN users u ON u.id = fl.family_user_id
      WHERE fl.scholar_user_id = ${scholar_user_id}
    `;
    return res.status(200).json({ links: rows });
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
