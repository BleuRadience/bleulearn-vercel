// GET /api/admin/equity-analytics
// Admin only. This platform does not collect race, ethnicity, or any
// other demographic field anywhere -- so this report cannot and does not
// show outcomes "by race." What it CAN show, and what the real research
// on gifted/IEP referral disparities actually points to as the
// mechanism worth watching, is REFERRER-LEVEL variance: does one teacher
// refer scholars to Gifted or flag them for IEP evaluation at a rate far
// out of line with their peers, independent of who those scholars are.
// A wide outlier here is a signal for a documented conversation, not a
// verdict -- this report names a question, it does not answer one.
import { sql, requireDb } from '../../lib/db.js';
import { requireRole } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });
  if (!requireDb(res)) return;
  if (!requireRole(req, res, ['admin'])) return;

  // Uses SUM(CASE WHEN...) rather than COUNT(*) FILTER(WHERE...) --
  // verified during testing that an in-memory test engine's FILTER clause
  // does not correctly exclude NULL-evaluating rows (confirmed via an
  // isolated test: a plain WHERE clause excluded a NULL row correctly,
  // but the equivalent FILTER did not). CASE WHEN matches the verified-
  // correct plain-WHERE semantics and works identically across engines,
  // so this avoids betting on which engine's FILTER implementation to trust.
  const { rows: giftedByReferrer } = await sql`
    SELECT u.full_name AS referring_teacher, u.id AS teacher_id,
           SUM(CASE WHEN pa.recommended_track = 'gifted' THEN 1 ELSE 0 END) AS gifted_referrals,
           SUM(CASE WHEN pa.recommended_track = 'bridge' THEN 1 ELSE 0 END) AS bridge_referrals,
           COUNT(*) AS total_assessments
    FROM placement_assessments pa
    JOIN users u ON u.id = pa.administered_by
    GROUP BY u.id, u.full_name
    ORDER BY gifted_referrals DESC
  `;

  const { rows: iepByReferrer } = await sql`
    SELECT u.full_name AS creating_teacher, u.id AS teacher_id, COUNT(*) AS accommodation_plans_created
    FROM accommodation_plans ap
    JOIN users u ON u.id = ap.created_by
    GROUP BY u.id, u.full_name
    ORDER BY accommodation_plans_created DESC
  `;

  const { rows: aiDisagreementRate } = await sql`
    SELECT target_type, COUNT(*) AS total_reviews,
           SUM(CASE WHEN ai_agrees_with_human IS FALSE THEN 1 ELSE 0 END) AS ai_disagreed,
           SUM(CASE WHEN status = 'overridden' THEN 1 ELSE 0 END) AS human_overrode_ai
    FROM ai_assessment_reviews
    GROUP BY target_type
  `;

  const { rows: vagueEvidenceFlags } = await sql`
    SELECT target_type, COUNT(*) AS flagged_for_vague_or_biased_evidence
    FROM ai_assessment_reviews
    WHERE bias_risk_flags IS NOT NULL AND bias_risk_flags != ''
    GROUP BY target_type
  `;

  return res.status(200).json({
    giftedAndBridgeReferralsByTeacher: giftedByReferrer,
    accommodationPlansByCreator: iepByReferrer,
    aiReviewDisagreementRates: aiDisagreementRate,
    evidenceQualityFlagsByType: vagueEvidenceFlags,
    note: 'This report shows referrer-level patterns only -- this platform collects no demographic data. A teacher whose gifted/bridge referral counts are a clear outlier relative to peers is a prompt for a documented conversation, not a conclusion.'
  });
}
