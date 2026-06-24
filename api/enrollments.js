// GET   /api/enrollments?course_id=5                    -- active roster for a course (teacher/admin)
// GET   /api/enrollments?course_id=5&include_inactive=1  -- full roster including withdrawn/transferred
// GET   /api/enrollments?user_id=3                       -- a scholar's own enrolled courses
// POST  /api/enrollments { course_id, user_id, role_in_course } -- enroll someone (or re-activate if previously withdrawn)
// PATCH /api/enrollments { enrollment_id, status, withdrawal_notes? } -- withdraw or mark transferred-out
import { sql, requireDb } from '../lib/db.js';
import { getCurrentUser, requireCourseStaff } from '../lib/auth.js';
import { record } from '../lib/activityLog.js';

export default async function handler(req, res) {
  if (!requireDb(res)) return;

  if (req.method === 'GET') {
    const user = getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'Not logged in.' });

    if (req.query.course_id) {
      if (!['teacher', 'admin'].includes(user.role)) {
        return res.status(403).json({ error: 'Only teachers and admins can view a full course roster.' });
      }
      // Defaults to active enrollments only, so a withdrawn or transferred
      // student doesn't keep showing up on a teacher's working roster --
      // their history is preserved (never deleted), just filtered out of
      // the default view. Pass include_inactive=1 to see everyone.
      const { rows } = req.query.include_inactive
        ? await sql`SELECT e.*, u.full_name, u.email FROM enrollments e JOIN users u ON u.id = e.user_id WHERE e.course_id = ${req.query.course_id}`
        : await sql`SELECT e.*, u.full_name, u.email FROM enrollments e JOIN users u ON u.id = e.user_id WHERE e.course_id = ${req.query.course_id} AND e.status = 'active'`;
      return res.status(200).json({ roster: rows });
    }

    const userId = req.query.user_id || user.id;
    if (String(userId) !== String(user.id) && !['teacher', 'admin'].includes(user.role)) {
      return res.status(403).json({ error: 'You can only view your own enrollments.' });
    }
    const { rows } = await sql`
      SELECT e.*, c.title AS course_title, c.strand FROM enrollments e
      JOIN courses c ON c.id = e.course_id
      WHERE e.user_id = ${userId}
    `;
    return res.status(200).json({ enrollments: rows });
  }

  if (req.method === 'POST') {
    const { course_id, user_id, role_in_course } = req.body || {};
    const validRoles = ['student', 'teacher', 'ta'];
    if (!course_id || !user_id || !validRoles.includes(role_in_course)) {
      return res.status(400).json({ error: `course_id, user_id, and role_in_course (one of: ${validRoles.join(', ')}) are required.` });
    }
    const enroller = await requireCourseStaff(req, res, course_id, sql);
    if (!enroller) return;
    try {
      // ON CONFLICT also resets status to 'active' -- this is the
      // transfer-back case: a student who withdrew and later returns to
      // the same course should become visible on the roster again, not
      // stay hidden because their old row still says 'withdrawn'.
      const { rows } = await sql`
        INSERT INTO enrollments (course_id, user_id, role_in_course)
        VALUES (${course_id}, ${user_id}, ${role_in_course})
        ON CONFLICT (course_id, user_id) DO UPDATE SET role_in_course = EXCLUDED.role_in_course, status = 'active', withdrawn_at = NULL
        RETURNING *
      `;
      await record(enroller.id, 'enrollment_created', 'enrollments', { course_id, user_id, role_in_course });
      return res.status(201).json({ enrollment: rows[0] });
    } catch (err) {
      console.error('Enrollments POST error:', err);
      return res.status(500).json({ error: 'Could not enroll user.', detail: err.message });
    }
  }

  if (req.method === 'PATCH') {
    const { enrollment_id, status, withdrawal_notes } = req.body || {};
    if (!enrollment_id || !['withdrawn', 'transferred_out', 'active'].includes(status)) {
      return res.status(400).json({ error: "enrollment_id and status (one of: withdrawn, transferred_out, active) are required." });
    }
    const { rows: existing } = await sql`SELECT course_id FROM enrollments WHERE id = ${enrollment_id}`;
    if (existing.length === 0) return res.status(404).json({ error: 'Enrollment not found.' });
    const actor = await requireCourseStaff(req, res, existing[0].course_id, sql);
    if (!actor) return;

    const { rows } = await sql`
      UPDATE enrollments SET status = ${status},
        withdrawn_at = ${status === 'active' ? null : new Date().toISOString()},
        withdrawal_notes = ${withdrawal_notes || null}
      WHERE id = ${enrollment_id}
      RETURNING *
    `;
    await record(actor.id, 'enrollment_status_changed', 'enrollments', { enrollment_id, status });
    return res.status(200).json({ enrollment: rows[0] });
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
