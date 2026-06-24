// GET  /api/admin/accommodation-plans?scholar_user_id=3   -- teacher/admin: view a scholar's plans
// POST /api/admin/accommodation-plans { scholar_user_id, plan_type, extended_time_multiplier?, notes?, review_date? }
//
// Restricted to teacher/admin. In a real deployment, this would likely be
// further restricted to a designated special-education case manager role --
// this platform's role model (scholar/teacher/family/admin) doesn't have
// that distinction, and adding a fifth role for this alone was judged out
// of scope for what this pass needed to fix. Documented here rather than
// silently left as an open question.
import { sql, requireDb } from '../../lib/db.js';
import { requireRole, getCurrentUser } from '../../lib/auth.js';
import { record } from '../../lib/activityLog.js';

export default async function handler(req, res) {
  if (!requireDb(res)) return;
  if (!requireRole(req, res, ['teacher', 'admin', 'case_manager'])) return;
  const user = getCurrentUser(req);

  if (req.method === 'GET') {
    const { scholar_user_id } = req.query;
    if (!scholar_user_id) return res.status(400).json({ error: 'scholar_user_id is required.' });
    const { rows } = await sql`
      SELECT * FROM accommodation_plans WHERE scholar_user_id = ${scholar_user_id} ORDER BY created_at DESC
    `;
    return res.status(200).json({ plans: rows });
  }

  if (req.method === 'POST') {
    const { scholar_user_id, plan_type, extended_time_multiplier, notes, review_date } = req.body || {};
    if (!scholar_user_id || !['IEP', '504'].includes(plan_type)) {
      return res.status(400).json({ error: "scholar_user_id and plan_type ('IEP' or '504') are required." });
    }
    const multiplier = Number(extended_time_multiplier) >= 1.0 ? Number(extended_time_multiplier) : 1.0;

    const { rows } = await sql`
      INSERT INTO accommodation_plans (scholar_user_id, plan_type, extended_time_multiplier, notes, review_date, created_by)
      VALUES (${scholar_user_id}, ${plan_type}, ${multiplier}, ${notes || null}, ${review_date || null}, ${user.id})
      RETURNING *
    `;
    await record(user.id, 'accommodation_plan_created', 'accommodation_plans', { plan_id: rows[0].id, scholar_user_id, plan_type });
    return res.status(201).json({ plan: rows[0] });
  }

  if (req.method === 'PATCH') {
    const { plan_id, status } = req.body || {};
    if (!plan_id || !['active', 'inactive'].includes(status)) {
      return res.status(400).json({ error: "plan_id and status ('active' or 'inactive') are required." });
    }
    const { rows } = await sql`UPDATE accommodation_plans SET status = ${status} WHERE id = ${plan_id} RETURNING *`;
    if (rows.length === 0) return res.status(404).json({ error: 'Plan not found.' });
    await record(user.id, 'accommodation_plan_updated', 'accommodation_plans', { plan_id, status });
    return res.status(200).json({ plan: rows[0] });
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
