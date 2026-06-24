// GET /api/admin/overdue-reviews
// Closes a previously-documented gap: review_date on accommodation_plans
// and the quarterly cadence on gifted_calibration_checkins were tracked as
// data but nothing ever surfaced "this is due" to anyone. This computes
// it on read rather than needing a separate scheduled job.
import { sql, requireDb } from '../../lib/db.js';
import { requireRole } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });
  if (!requireDb(res)) return;
  if (!requireRole(req, res, ['teacher', 'admin', 'case_manager'])) return;

  const { rows: overduePlans } = await sql`
    SELECT ap.id, ap.scholar_user_id, u.full_name, ap.plan_type, ap.review_date
    FROM accommodation_plans ap JOIN users u ON u.id = ap.scholar_user_id
    WHERE ap.status = 'active' AND ap.review_date IS NOT NULL AND ap.review_date < CURRENT_DATE
    ORDER BY ap.review_date ASC
  `;

  // A scholar with an active Gifted track but no calibration check-in
  // recorded in the CURRENT quarter is overdue for one. Quarter is
  // computed the same way benchmark_scores already documents it.
  const now = new Date();
  const currentQuarter = `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`;
  const { rows: missingGiftedCheckins } = await sql`
    SELECT ta.scholar_user_id, u.full_name, ta.strand
    FROM track_assignments ta
    JOIN users u ON u.id = ta.scholar_user_id
    WHERE ta.is_current = true AND ta.track = 'gifted'
      AND NOT EXISTS (
        SELECT 1 FROM gifted_calibration_checkins g
        WHERE g.scholar_user_id = ta.scholar_user_id AND g.strand = ta.strand AND g.quarter = ${currentQuarter}
      )
  `;

  const { rows: pendingReviewCount } = await sql`SELECT COUNT(*) AS n FROM ai_assessment_reviews WHERE status = 'pending_review'`;

  return res.status(200).json({
    overdueAccommodationReviews: overduePlans,
    missingGiftedCalibrationThisQuarter: missingGiftedCheckins,
    currentQuarter,
    pendingAiReviewsAwaitingHuman: Number(pendingReviewCount[0].n)
  });
}
