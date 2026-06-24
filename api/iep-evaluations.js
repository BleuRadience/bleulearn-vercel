// POST /api/iep-evaluations
//   { accommodation_plan_id, area_assessed, present_level_of_performance,
//     documented_strengths?, documented_needs?, recommended_strategies }
// GET  /api/iep-evaluations?accommodation_plan_id=2
//
// This is what actually tells a teacher HOW to teach this scholar -- the
// accommodation_plans table's extended_time_multiplier only ever covered
// the time dimension. recommended_strategies is required, not optional --
// an evaluation with no instructional recommendation isn't useful to a
// classroom teacher, regardless of how thorough the rest of it is.
import { sql, requireDb } from '../lib/db.js';
import { requireRole, getCurrentUser } from '../lib/auth.js';
import { record } from '../lib/activityLog.js';
import { runAiReview } from '../lib/aiReview.js';

export default async function handler(req, res) {
  if (!requireDb(res)) return;
  if (!requireRole(req, res, ['teacher', 'admin', 'case_manager'])) return;
  const user = getCurrentUser(req);

  if (req.method === 'GET') {
    const { accommodation_plan_id } = req.query;
    if (!accommodation_plan_id) return res.status(400).json({ error: 'accommodation_plan_id is required.' });
    const { rows } = await sql`SELECT * FROM iep_evaluations WHERE accommodation_plan_id = ${accommodation_plan_id} ORDER BY assessed_at DESC`;
    return res.status(200).json({ evaluations: rows });
  }

  if (req.method === 'POST') {
    const { accommodation_plan_id, area_assessed, present_level_of_performance, documented_strengths, documented_needs, recommended_strategies } = req.body || {};
    if (!accommodation_plan_id || !area_assessed || !present_level_of_performance || !recommended_strategies) {
      return res.status(400).json({ error: 'accommodation_plan_id, area_assessed, present_level_of_performance, and recommended_strategies are required.' });
    }
    const { rows: planCheck } = await sql`SELECT id FROM accommodation_plans WHERE id = ${accommodation_plan_id}`;
    if (planCheck.length === 0) return res.status(404).json({ error: 'Accommodation plan not found. Create the plan first via /api/admin/accommodation-plans.' });

    const { rows } = await sql`
      INSERT INTO iep_evaluations (accommodation_plan_id, area_assessed, present_level_of_performance, documented_strengths, documented_needs, recommended_strategies, assessed_by)
      VALUES (${accommodation_plan_id}, ${area_assessed}, ${present_level_of_performance}, ${documented_strengths || null}, ${documented_needs || null}, ${recommended_strategies}, ${user.id})
      RETURNING *
    `;
    const evaluation = rows[0];

    // AI review here checks something different from the placement/gifted
    // cases: not "does the evidence support a track," but "is the present
    // level of performance specific enough, and do the recommended
    // strategies actually follow from the documented needs" -- catching a
    // vague PLAAFP or a strategy list disconnected from the stated needs
    // is itself a documented mechanism for inconsistent IEP quality.
    const aiResult = await runAiReview({
      targetType: 'iep_evaluation',
      documentedEvidence: `Present level of performance: ${present_level_of_performance}\nDocumented needs: ${documented_needs || 'not specified'}`,
      recommendedAction: `Recommended strategies: ${recommended_strategies}`
    });

    const { rows: reviewRows } = await sql`
      INSERT INTO ai_assessment_reviews (target_type, target_id, ai_analysis, ai_agrees_with_human, bias_risk_flags, status)
      VALUES ('iep_evaluation', ${evaluation.id}, ${aiResult.ai_analysis}, ${aiResult.ai_agrees_with_human}, ${aiResult.bias_risk_flags}, 'pending_review')
      RETURNING *
    `;

    await record(user.id, 'iep_evaluation_submitted_for_review', 'iep_evaluations', { evaluation_id: evaluation.id, accommodation_plan_id, area_assessed });
    return res.status(201).json({
      evaluation,
      aiReview: reviewRows[0],
      message: 'Evaluation recorded and sent for AI review of internal consistency. A teacher or admin should still confirm via /api/admin/review-pending before relying on it in the classroom.'
    });
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
