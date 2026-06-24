// GET  /api/course-sections?course_id=5
// POST /api/course-sections { course_id, title, position?, summary? } -- teacher/admin
import { sql, requireDb } from '../lib/db.js';
import { requireCourseStaff } from '../lib/auth.js';
import { record } from '../lib/activityLog.js';

export default async function handler(req, res) {
  if (!requireDb(res)) return;

  if (req.method === 'GET') {
    const { course_id } = req.query;
    if (!course_id) return res.status(400).json({ error: 'course_id is required.' });
    const { rows } = await sql`SELECT * FROM course_sections WHERE course_id = ${course_id} ORDER BY position ASC`;
    return res.status(200).json({ sections: rows });
  }

  if (req.method === 'POST') {
    const { course_id, title, position, summary } = req.body || {};
    if (!course_id || !title) return res.status(400).json({ error: 'course_id and title are required.' });
    const user = await requireCourseStaff(req, res, course_id, sql);
    if (!user) return;

    const { rows } = await sql`
      INSERT INTO course_sections (course_id, title, position, summary)
      VALUES (${course_id}, ${title}, ${position || 0}, ${summary || null})
      RETURNING *
    `;
    await record(user.id, 'section_created', 'course_sections', { section_id: rows[0].id, course_id });
    return res.status(201).json({ section: rows[0] });
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
