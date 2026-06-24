// POST /api/gifted-calibration
//   { scholar_user_id, strand, quarter, challenge_rating, evidence_notes, recommended_action }
// GET  /api/gifted-calibration?scholar_user_id=3
//
// CHANGED: no longer adjusts track_assignments directly. Every check-in
// now gets an independent AI evidence review and sits as pending_review
// until a teacher or admin approves via /api/admin/review-pending.
import { sql, requireDb } from '../lib/db.js';
import { requireRole, getCurrentUser } from '../lib/auth.js';
import { record } from '../lib/activityLog.js';
import { runAiReview } from '../lib/aiReview.js';

const VALID_RATINGS = ['too_easy', 'appropriate', 'too_challenging'];
const VALID_ACTIONS = ['extend_challenge', 'maintain', 'reduce_challenge'];

export default async function handler(req, res) {
  if (!requireDb(res)) return;
  if (!requireRole(req, res, ['teacher', 'admin', 'case_manager'])) return;
  const user = getCurrentUser(req);

  if (req.method === 'GET') {
    const { scholar_user_id } = req.query;
    if (!scholar_user_id) return res.status(400).json({ error: 'scholar_user_id is required.' });
    const { rows } = await sql`
      SELECT c.*, r.status AS review_status, r.ai_agrees_with_human, r.bias_risk_flags
      FROM gifted_calibration_checkins c
      LEFT JOIN ai_assessment_reviews r ON r.target_type = 'gifted_calibration_checkin' AND r.target_id = c.id
      WHERE c.scholar_user_id = ${scholar_user_id} ORDER BY c.quarter DESC
    `;
    return res.status(200).json({ checkins: rows });
  }

  if (req.method === 'POST') {
    const { scholar_user_id, strand, quarter, challenge_rating, evidence_notes, recommended_action } = req.body || {};
    if (!scholar_user_id || !strand || !quarter || !VALID_RATINGS.includes(challenge_rating) || !evidence_notes || !VALID_ACTIONS.includes(recommended_action)) {
      return res.status(400).json({
        error: `scholar_user_id, strand, quarter, challenge_rating (${VALID_RATINGS.join('/')}), evidence_notes, and recommended_action (${VALID_ACTIONS.join('/')}) are all required.`
      });
    }

    try {
      const { rows } = await sql`
        INSERT INTO gifted_calibration_checkins (scholar_user_id, strand, quarter, challenge_rating, evidence_notes, recommended_action, recorded_by)
        VALUES (${scholar_user_id}, ${strand}, ${quarter}, ${challenge_rating}, ${evidence_notes}, ${recommended_action}, ${user.id})
        ON CONFLICT (scholar_user_id, strand, quarter)
        DO UPDATE SET challenge_rating = EXCLUDED.challenge_rating, evidence_notes = EXCLUDED.evidence_notes, recommended_action = EXCLUDED.recommended_action, recorded_by = EXCLUDED.recorded_by, recorded_at = now()
        RETURNING *
      `;
      const checkin = rows[0];

      const aiResult = await runAiReview({
        targetType: 'gifted_calibration_checkin',
        documentedEvidence: evidence_notes,
        recommendedAction: `${recommended_action} (challenge rated "${challenge_rating}")`
      });

      // No ON CONFLICT here -- id is auto-generated and unique on every
      // insert, so there is nothing to conflict against. A resubmitted
      // check-in for the same quarter (the ON CONFLICT on the checkin
      // insert above) still gets its own fresh AI review row, which is
      // correct: re-evaluating updated evidence deserves a new opinion,
      // not a discarded one.
      const { rows: reviewRows } = await sql`
        INSERT INTO ai_assessment_reviews (target_type, target_id, ai_analysis, ai_agrees_with_human, bias_risk_flags, status)
        VALUES ('gifted_calibration_checkin', ${checkin.id}, ${aiResult.ai_analysis}, ${aiResult.ai_agrees_with_human}, ${aiResult.bias_risk_flags}, 'pending_review')
        RETURNING *
      `;

      await record(user.id, 'gifted_calibration_submitted_for_review', 'gifted_calibration_checkins', { checkin_id: checkin.id, scholar_user_id, strand, challenge_rating });
      return res.status(201).json({
        checkin,
        aiReview: reviewRows[0],
        message: 'Check-in recorded and sent for AI evidence review. No track change takes effect until a teacher or admin approves via /api/admin/review-pending.'
      });
    } catch (err) {
      console.error('Gifted calibration error:', err);
      return res.status(500).json({ error: 'Could not record check-in.', detail: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
