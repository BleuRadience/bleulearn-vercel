// GET  /api/assignments?course_id=5     -- list assignments in a course
// GET  /api/assignments?id=12           -- one assignment
// POST /api/assignments { course_id, section_id?, title, instructions?, due_at?, points_possible? }
//      Creating an assignment also creates its matching grade_items row,
//      so it shows up in the gradebook automatically -- a teacher should
//      never have to separately remember to "add it to grades."
import { sql, requireDb } from '../lib/db.js';
import { requireCourseStaff } from '../lib/auth.js';
import { record } from '../lib/activityLog.js';

export default async function handler(req, res) {
  if (!requireDb(res)) return;

  if (req.method === 'GET') {
    const user = getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'Not logged in.' });

    if (req.query.id) {
      const { rows } = await sql`SELECT * FROM assignments WHERE id = ${req.query.id}`;
      if (rows.length === 0) return res.status(404).json({ error: 'Assignment not found.' });
      return res.status(200).json({ assignment: rows[0] });
    }
    if (!req.query.course_id) return res.status(400).json({ error: 'course_id or id is required.' });

    const { rows } = await sql`
      SELECT * FROM assignments WHERE course_id = ${req.query.course_id} ORDER BY due_at ASC NULLS LAST
    `;
    return res.status(200).json({ assignments: rows });
  }

  if (req.method === 'POST') {
    const { course_id, section_id, title, instructions, due_at, points_possible } = req.body || {};
    if (!course_id || !title) return res.status(400).json({ error: 'course_id and title are required.' });
    const creator = await requireCourseStaff(req, res, course_id, sql);
    if (!creator) return; // requireCourseStaff already wrote the 401/403 response

    try {
      const { rows } = await sql`
        INSERT INTO assignments (course_id, section_id, title, instructions, due_at, points_possible, created_by)
        VALUES (${course_id}, ${section_id || null}, ${title}, ${instructions || null}, ${due_at || null}, ${points_possible || 100}, ${creator.id})
        RETURNING *
      `;
      const assignment = rows[0];

      // Auto-create the matching gradebook item.
      await sql`
        INSERT INTO grade_items (course_id, item_type, item_ref_id, title, points_possible)
        VALUES (${course_id}, 'assignment', ${assignment.id}, ${title}, ${points_possible || 100})
      `;

      await record(creator.id, 'assignment_created', 'assignments', { assignment_id: assignment.id, course_id });
      return res.status(201).json({ assignment });
    } catch (err) {
      console.error('Assignments POST error:', err);
      return res.status(500).json({ error: 'Could not create assignment.', detail: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
