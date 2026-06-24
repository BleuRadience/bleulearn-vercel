// GET /api/lesson-plans -- lists the logged-in teacher's saved lesson plans.
// (Saving happens inside api/generate-lesson-plan.js at generation time,
// not here -- this endpoint is read-only by design.)
import { sql, requireDb } from '../lib/db.js';
import { requireRole, getCurrentUser } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });
  if (!requireDb(res)) return;
  if (!requireRole(req, res, ['teacher', 'admin'])) return;

  const user = getCurrentUser(req);
  try {
    const { rows } = await sql`
      SELECT id, strand, grade_level, topic, source, created_at FROM lesson_plans
      WHERE created_by = ${user.id}
      ORDER BY created_at DESC LIMIT 50
    `;
    return res.status(200).json({ lessonPlans: rows });
  } catch (err) {
    console.error('Lesson plans GET error:', err);
    return res.status(500).json({ error: 'Could not load saved lesson plans.', detail: err.message });
  }
}
