// GET   /api/submissions?assignment_id=12        -- teacher/admin: all submissions for grading
// GET   /api/submissions?assignment_id=12&mine=1 -- scholar: their own submission
// POST  /api/submissions { assignment_id, submission_text }  -- scholar submits/resubmits
// PATCH /api/submissions { submission_id, grade, feedback }  -- teacher/admin grades it
//
// Grading via PATCH also writes the matching `grades` row against this
// assignment's grade_items entry, so the gradebook reflects it immediately
// without a separate manual step.
import { sql, requireDb } from '../lib/db.js';
import { getCurrentUser, requireCourseStaff, requireEnrollment } from '../lib/auth.js';
import { record } from '../lib/activityLog.js';

export default async function handler(req, res) {
  if (!requireDb(res)) return;
  const user = getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Not logged in.' });

  if (req.method === 'GET') {
    const { assignment_id, mine } = req.query;
    if (!assignment_id) return res.status(400).json({ error: 'assignment_id is required.' });

    if (mine || user.role === 'scholar') {
      const { rows } = await sql`
        SELECT * FROM submissions WHERE assignment_id = ${assignment_id} AND scholar_user_id = ${user.id}
      `;
      return res.status(200).json({ submission: rows[0] || null });
    }

    if (!['teacher', 'admin'].includes(user.role)) {
      return res.status(403).json({ error: 'Only teachers and admins can view all submissions for an assignment.' });
    }
    const { rows } = await sql`
      SELECT s.*, u.full_name FROM submissions s
      JOIN users u ON u.id = s.scholar_user_id
      WHERE s.assignment_id = ${assignment_id}
      ORDER BY s.submitted_at DESC
    `;
    return res.status(200).json({ submissions: rows });
  }

  if (req.method === 'POST') {
    const { assignment_id, submission_text } = req.body || {};
    if (!assignment_id || !submission_text) {
      return res.status(400).json({ error: 'assignment_id and submission_text are required.' });
    }
    const { rows: assignRows } = await sql`SELECT course_id FROM assignments WHERE id = ${assignment_id}`;
    if (assignRows.length === 0) return res.status(404).json({ error: 'Assignment not found.' });
    if (!(await requireEnrollment(req, res, assignRows[0].course_id, sql))) return;
    try {
      const { rows } = await sql`
        INSERT INTO submissions (assignment_id, scholar_user_id, submission_text, status)
        VALUES (${assignment_id}, ${user.id}, ${submission_text}, 'submitted')
        ON CONFLICT (assignment_id, scholar_user_id)
        DO UPDATE SET submission_text = EXCLUDED.submission_text, submitted_at = now(), status = 'submitted'
        RETURNING *
      `;
      await record(user.id, 'assignment_submitted', 'submissions', { assignment_id });
      return res.status(201).json({ submission: rows[0] });
    } catch (err) {
      console.error('Submissions POST error:', err);
      return res.status(500).json({ error: 'Could not submit.', detail: err.message });
    }
  }

  if (req.method === 'PATCH') {
    const { submission_id, grade, feedback } = req.body || {};
    if (!submission_id || grade === undefined) {
      return res.status(400).json({ error: 'submission_id and grade are required.' });
    }
    try {
      // Look up which course this submission belongs to (via its
      // assignment) BEFORE allowing the grade write -- this is what
      // closes the course-level IDOR for grading specifically: without
      // this lookup, any global "teacher" could grade a submission
      // belonging to a course they have no enrollment in at all.
      const { rows: lookupRows } = await sql`
        SELECT s.*, a.course_id FROM submissions s JOIN assignments a ON a.id = s.assignment_id WHERE s.id = ${submission_id}
      `;
      if (lookupRows.length === 0) return res.status(404).json({ error: 'Submission not found.' });
      const grader = await requireCourseStaff(req, res, lookupRows[0].course_id, sql);
      if (!grader) return;

      const { rows } = await sql`
        UPDATE submissions SET grade = ${grade}, feedback = ${feedback || null},
          graded_by = ${grader.id}, graded_at = now(), status = 'graded'
        WHERE id = ${submission_id}
        RETURNING *
      `;
      const sub = rows[0];

      // Mirror this grade into the gradebook's `grades` table against the
      // assignment's grade_items row, so the gradebook is always in sync.
      const { rows: giRows } = await sql`
        SELECT id FROM grade_items WHERE item_type = 'assignment' AND item_ref_id = ${sub.assignment_id}
      `;
      if (giRows.length > 0) {
        await sql`
          INSERT INTO grades (grade_item_id, scholar_user_id, points_earned, feedback, graded_by)
          VALUES (${giRows[0].id}, ${sub.scholar_user_id}, ${grade}, ${feedback || null}, ${user.id})
          ON CONFLICT (grade_item_id, scholar_user_id)
          DO UPDATE SET points_earned = EXCLUDED.points_earned, feedback = EXCLUDED.feedback, graded_by = EXCLUDED.graded_by, graded_at = now()
        `;
      }

      await record(grader.id, 'submission_graded', 'submissions', { submission_id, grade });
      return res.status(200).json({ submission: sub });
    } catch (err) {
      console.error('Submissions PATCH error:', err);
      return res.status(500).json({ error: 'Could not grade submission.', detail: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
