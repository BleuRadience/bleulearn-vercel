// GET  /api/forums?course_id=5          -- list forums in a course
// GET  /api/forums?id=3                 -- one forum + all its posts (threaded)
// POST /api/forums { course_id, title, description? }  -- create a forum (teacher/admin)
import { sql, requireDb } from '../lib/db.js';
import { getCurrentUser, requireCourseStaff } from '../lib/auth.js';
import { record } from '../lib/activityLog.js';

export default async function handler(req, res) {
  if (!requireDb(res)) return;
  const user = getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Not logged in.' });

  if (req.method === 'GET') {
    if (req.query.id) {
      const { rows: forumRows } = await sql`SELECT * FROM forums WHERE id = ${req.query.id}`;
      if (forumRows.length === 0) return res.status(404).json({ error: 'Forum not found.' });
      const { rows: posts } = await sql`
        SELECT p.*, u.full_name AS author_name FROM forum_posts p
        JOIN users u ON u.id = p.author_id WHERE p.forum_id = ${req.query.id} ORDER BY p.created_at ASC
      `;
      return res.status(200).json({ forum: forumRows[0], posts });
    }
    if (!req.query.course_id) return res.status(400).json({ error: 'course_id or id is required.' });
    const { rows } = await sql`SELECT * FROM forums WHERE course_id = ${req.query.course_id}`;
    return res.status(200).json({ forums: rows });
  }

  if (req.method === 'POST') {
    const { course_id, title, description } = req.body || {};
    if (!course_id || !title) return res.status(400).json({ error: 'course_id and title are required.' });
    const staffUser = await requireCourseStaff(req, res, course_id, sql);
    if (!staffUser) return;
    const { rows } = await sql`
      INSERT INTO forums (course_id, title, description, created_by) VALUES (${course_id}, ${title}, ${description || null}, ${user.id}) RETURNING *
    `;
    await record(user.id, 'forum_created', 'forums', { forum_id: rows[0].id, course_id });
    return res.status(201).json({ forum: rows[0] });
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
