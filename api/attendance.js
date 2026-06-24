// GET  /api/attendance?scholar_id=123&from=2026-01-01&to=2026-06-01
// POST /api/attendance  { scholar_id, date, status, notes? }
//
// One row per scholar per day (see UNIQUE constraint in schema.sql).
// Re-marking the same date updates that day's record via ON CONFLICT --
// a single day's attendance is one fact, correctable, not an append-only log.
// Implements the chronic-absence threshold from the Attendance Policy
// (Master Doc Part IV.3): 10% of 180 days = 18 days.
import { sql, requireDb } from '../lib/db.js';
import { requireRole, getCurrentUser } from '../lib/auth.js';

const CHRONIC_ABSENCE_RATE = 0.10; // 10%, per the documented Attendance Policy (Master Doc Part IV.3)

export default async function handler(req, res) {
  if (!requireDb(res)) return;

  if (req.method === 'GET') {
    const user = getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'Not logged in.' });
    const scholarId = req.query.scholar_id || (user.role === 'scholar' ? user.id : null);
    if (!scholarId) return res.status(400).json({ error: 'scholar_id is required.' });
    if (user.role === 'scholar' && String(user.id) !== String(scholarId)) {
      return res.status(403).json({ error: 'You can only view your own attendance.' });
    }
    if (user.role === 'family') {
      const { rows: linkRows } = await sql`SELECT 1 FROM family_links WHERE family_user_id = ${user.id} AND scholar_user_id = ${scholarId}`;
      if (linkRows.length === 0) return res.status(403).json({ error: 'You are not linked to this scholar.' });
    }

    try {
      const { rows } = await sql`
        SELECT date, status, notes FROM attendance
        WHERE scholar_user_id = ${scholarId}
        ORDER BY date DESC
      `;
      const absentCount = rows.filter(r => r.status === 'unexcused_absent' || r.status === 'excused_absent').length;

      // FIX: previously compared absentCount to a flat 18, which silently
      // assumed a full 180-day year for everyone. A transfer student
      // enrolled for only ~25 days with 5 absences (a real 20% rate) was
      // never flagged, because 5 < 18 -- even though 20% is double the
      // policy's 10% threshold. Now computed proportionally to how long
      // this scholar has actually been enrolled, using the EARLIEST
      // enrollment date across any course (a transfer date), not a fixed
      // school-year constant.
      const { rows: enrollRows } = await sql`
        SELECT MIN(enrolled_at) AS first_enrolled FROM enrollments WHERE user_id = ${scholarId} AND role_in_course = 'student'
      `;
      const firstEnrolled = enrollRows[0]?.first_enrolled ? new Date(enrollRows[0].first_enrolled) : null;
      const daysEnrolled = firstEnrolled ? Math.max(1, Math.ceil((Date.now() - firstEnrolled.getTime()) / 86400000)) : 180;
      const chronicAbsenceThreshold = Math.max(1, Math.round(daysEnrolled * CHRONIC_ABSENCE_RATE));

      return res.status(200).json({
        records: rows,
        absentDaysThisRecord: absentCount,
        daysEnrolled,
        chronicAbsenceThreshold,
        isChronicallyAbsent: absentCount >= chronicAbsenceThreshold
      });
    } catch (err) {
      console.error('Attendance GET error:', err);
      return res.status(500).json({ error: 'Could not load attendance.', detail: err.message });
    }
  }

  if (req.method === 'POST') {
    if (!requireRole(req, res, ['teacher', 'admin'])) return;
    const recorder = getCurrentUser(req);
    const { scholar_id, date, status, notes } = req.body || {};
    const validStatuses = ['present', 'excused_absent', 'unexcused_absent', 'tardy'];

    if (!scholar_id || !date || !validStatuses.includes(status)) {
      return res.status(400).json({ error: `scholar_id, date, and status (one of: ${validStatuses.join(', ')}) are required.` });
    }

    try {
      const { rows } = await sql`
        INSERT INTO attendance (scholar_user_id, date, status, recorded_by, notes)
        VALUES (${scholar_id}, ${date}, ${status}, ${recorder.id}, ${notes || null})
        ON CONFLICT (scholar_user_id, date)
        DO UPDATE SET status = EXCLUDED.status, notes = EXCLUDED.notes, recorded_by = EXCLUDED.recorded_by
        RETURNING date, status, notes
      `;
      return res.status(200).json({ recorded: rows[0] });
    } catch (err) {
      console.error('Attendance POST error:', err);
      return res.status(500).json({ error: 'Could not record attendance.', detail: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
