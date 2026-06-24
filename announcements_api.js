// GET  /api/announcements?course_id=5  -- anyone enrolled can read
// POST /api/announcements { course_id, title, body }  -- teacher/admin only
//
// This is the actual lightweight teacher-student interaction layer: no
// external chat service, no video infrastructure, no separate server --
// just a real table in the same database everything else uses. Text-based
// communication does not require heavy infrastructure to be real.
import { sql, requireDb } from '../lib/db.js';
import { getCurrentUser, requireCourseStaff, requireEnrollment } from '../lib/auth.js';
import { record } from '../lib/activityLog.js';

export default async function handler(req, res) {
  if (!requireDb(res)) return;
  const user = getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Not logged in.' });

  if (req.method === 'GET') {
    const { course_id } = req.query;
    if (!course_id) return res.status(400).json({ error: 'course_id is required.' });
    if (!(await requireEnrollment(req, res, course_id, sql))) return;

    const { rows } = await sql`
      SELECT a.*, u.full_name AS posted_by_name FROM announcements a
      JOIN users u ON u.id = a.posted_by
      WHERE a.course_id = ${course_id} ORDER BY a.created_at DESC
    `;
    return res.status(200).json({ announcements: rows });
  }

  if (req.method === 'POST') {
    const { course_id, title, body } = req.body || {};
    if (!course_id || !title || !body) return res.status(400).json({ error: 'course_id, title, and body are required.' });
    const staffUser = await requireCourseStaff(req, res, course_id, sql);
    if (!staffUser) return;

    const { rows } = await sql`
      INSERT INTO announcements (course_id, title, body, posted_by) VALUES (${course_id}, ${title}, ${body}, ${staffUser.id}) RETURNING *
    `;

    // Notify every enrolled scholar -- reuses the existing notifications
    // table, no new infrastructure.
    const { rows: roster } = await sql`SELECT user_id FROM enrollments WHERE course_id = ${course_id} AND role_in_course = 'student' AND status = 'active'`;
    for (const r of roster) {
      await sql`INSERT INTO notifications (user_id, type, message) VALUES (${r.user_id}, 'announcement', ${'New announcement: ' + title})`;
    }

    await record(staffUser.id, 'announcement_posted', 'announcements', { announcement_id: rows[0].id, course_id });
    return res.status(201).json({ announcement: rows[0], notifiedScholars: roster.length });
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
