// POST /api/activity-completions { activity_type, activity_id } -- scholar marks something done
// GET  /api/activity-completions?activity_type=assignment&activity_id=12 -- who has completed it (teacher/admin)
import { sql, requireDb } from '../lib/db.js';
import { getCurrentUser, requireRole, requireEnrollment } from '../lib/auth.js';
import { record } from '../lib/activityLog.js';

const VALID_TYPES = ['assignment', 'quiz', 'forum', 'section'];

export default async function handler(req, res) {
  if (!requireDb(res)) return;
  const user = getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Not logged in.' });

  if (req.method === 'POST') {
    const { activity_type, activity_id } = req.body || {};
    if (!VALID_TYPES.includes(activity_type) || !activity_id) {
      return res.status(400).json({ error: `activity_type (one of: ${VALID_TYPES.join(', ')}) and activity_id are required.` });
    }

    // Look up which course this activity belongs to, then confirm
    // enrollment, the same way submissions.js, quiz-attempts.js, and
    // forum-posts.js were fixed -- closes the last instance of this gap.
    const tableByType = { assignment: 'assignments', quiz: 'quizzes', forum: 'forums', section: 'course_sections' };
    const { rows: ownerRows } = await sql.query(
      `SELECT course_id FROM ${tableByType[activity_type]} WHERE id = $1`, [activity_id]
    );
    if (ownerRows.length === 0) return res.status(404).json({ error: `${activity_type} not found.` });
    if (!(await requireEnrollment(req, res, ownerRows[0].course_id, sql))) return;

    const { rows } = await sql`
      INSERT INTO activity_completions (user_id, activity_type, activity_id)
      VALUES (${user.id}, ${activity_type}, ${activity_id})
      ON CONFLICT (user_id, activity_type, activity_id) DO NOTHING
      RETURNING *
    `;
    await record(user.id, 'activity_completed', 'activity_completions', { activity_type, activity_id });
    return res.status(201).json({ completion: rows[0] || { already_completed: true } });
  }

  if (req.method === 'GET') {
    if (!requireRole(req, res, ['teacher', 'admin'])) return;
    const { activity_type, activity_id } = req.query;
    if (!VALID_TYPES.includes(activity_type) || !activity_id) {
      return res.status(400).json({ error: 'Valid activity_type and activity_id are required.' });
    }
    const { rows } = await sql`
      SELECT c.*, u.full_name FROM activity_completions c JOIN users u ON u.id = c.user_id
      WHERE c.activity_type = ${activity_type} AND c.activity_id = ${activity_id}
    `;
    return res.status(200).json({ completions: rows });
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
