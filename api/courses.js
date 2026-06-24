// GET  /api/courses                 -- list all courses (anyone logged in)
// GET  /api/courses?id=5            -- one course + its sections
// POST /api/courses { strand, title, grade_level, description? }  -- create (teacher/admin)
import { sql, requireDb } from '../lib/db.js';
import { getCurrentUser, requireRole } from '../lib/auth.js';
import { record } from '../lib/activityLog.js';

export default async function handler(req, res) {
  if (!requireDb(res)) return;

  if (req.method === 'GET') {
    const user = getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'Not logged in.' });

    if (req.query.id) {
      const { rows: courseRows } = await sql`SELECT * FROM courses WHERE id = ${req.query.id}`;
      if (courseRows.length === 0) return res.status(404).json({ error: 'Course not found.' });
      const { rows: sections } = await sql`
        SELECT * FROM course_sections WHERE course_id = ${req.query.id} ORDER BY position ASC
      `;
      return res.status(200).json({ course: courseRows[0], sections });
    }

    try {
      const { rows } = await sql`SELECT * FROM courses ORDER BY created_at DESC`;
      return res.status(200).json({ courses: rows });
    } catch (err) {
      console.error('Courses GET error:', err);
      return res.status(500).json({ error: 'Could not load courses.', detail: err.message });
    }
  }

  if (req.method === 'POST') {
    if (!requireRole(req, res, ['teacher', 'admin'])) return;
    const creator = getCurrentUser(req);
    const { strand, title, grade_level, description } = req.body || {};
    if (!strand || !title || !grade_level) {
      return res.status(400).json({ error: 'strand, title, and grade_level are required.' });
    }

    try {
      const { rows } = await sql`
        INSERT INTO courses (strand, title, grade_level, description, created_by)
        VALUES (${strand}, ${title}, ${grade_level}, ${description || null}, ${creator.id})
        RETURNING *
      `;
      // Creating teacher is automatically enrolled as the course's teacher of record.
      await sql`
        INSERT INTO enrollments (course_id, user_id, role_in_course)
        VALUES (${rows[0].id}, ${creator.id}, 'teacher')
      `;
      await record(creator.id, 'course_created', 'courses', { course_id: rows[0].id, title });
      return res.status(201).json({ course: rows[0] });
    } catch (err) {
      console.error('Courses POST error:', err);
      return res.status(500).json({ error: 'Could not create course.', detail: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
