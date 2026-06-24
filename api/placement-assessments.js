// POST /api/placement-assessments
//   { scholar_user_id, strand, purpose, score_level, documented_evidence, recommended_track, transfer_record_id? }
//   purpose: 'transfer_diagnostic' | 'gifted_identification' | 'general_placement'
// GET  /api/placement-assessments?scholar_user_id=3
//
// CHANGED: this no longer updates track_assignments directly. Submitting
// an assessment now ALWAYS triggers an independent AI evidence review
// (lib/aiReview.js) and creates a pending_review row in
// ai_assessment_reviews. The scholar's operative track does NOT change
// until a teacher or admin explicitly approves via
// /api/admin/review-pending. This is the mandatory-oversight workflow.
import { sql, requireDb } from '../lib/db.js';
import { requireRole, getCurrentUser } from '../lib/auth.js';
import { record } from '../lib/activityLog.js';
import { runAiReview } from '../lib/aiReview.js';

const VALID_PURPOSES = ['transfer_diagnostic', 'gifted_identification', 'general_placement'];
const VALID_TRACKS = ['bridge', 'grade_level', 'gifted'];

export default async function handler(req, res) {
  if (!requireDb(res)) return;
  if (!requireRole(req, res, ['teacher', 'admin', 'case_manager'])) return;
  const user = getCurrentUser(req);

  if (req.method === 'GET') {
    const { scholar_user_id } = req.query;
    if (!scholar_user_id) return res.status(400).json({ error: 'scholar_user_id is required.' });
    const { rows } = await sql`
      SELECT pa.*, r.status AS review_status, r.ai_agrees_with_human, r.bias_risk_flags
      FROM placement_assessments pa
      LEFT JOIN ai_assessment_reviews r ON r.target_type = 'placement_assessment' AND r.target_id = pa.id
      WHERE pa.scholar_user_id = ${scholar_user_id} ORDER BY pa.administered_at DESC
    `;
    return res.status(200).json({ assessments: rows });
  }

  if (req.method === 'POST') {
    const { scholar_user_id, strand, purpose, score_level, documented_evidence, recommended_track, transfer_record_id } = req.body || {};
    if (!scholar_user_id || !strand || !VALID_PURPOSES.includes(purpose) || !documented_evidence || !VALID_TRACKS.includes(recommended_track)) {
      return res.status(400).json({
        error: `scholar_user_id, strand, purpose (${VALID_PURPOSES.join('/')}), documented_evidence, and recommended_track (${VALID_TRACKS.join('/')}) are all required.`
      });
    }
    if (![1, 2, 3, 4].includes(Number(score_level))) {
      return res.status(400).json({ error: 'score_level must be 1-4 (Beginning through Advanced).' });
    }

    try {
      const { rows } = await sql`
        INSERT INTO placement_assessments (scholar_user_id, transfer_record_id, strand, purpose, score_level, documented_evidence, recommended_track, administered_by)
        VALUES (${scholar_user_id}, ${transfer_record_id || null}, ${strand}, ${purpose}, ${score_level}, ${documented_evidence}, ${recommended_track}, ${user.id})
        RETURNING *
      `;
      const assessment = rows[0];

      const { rows: scopeRows } = await sql`
        SELECT expected_skill FROM scope_sequence_references WHERE strand = ${strand} LIMIT 1
      `;

      const aiResult = await runAiReview({
        targetType: 'placement_assessment',
        documentedEvidence: documented_evidence,
        recommendedAction: `Place scholar on "${recommended_track}" track (score level ${score_level}/4)`,
        scopeSequenceContext: scopeRows[0]?.expected_skill
      });

      const { rows: reviewRows } = await sql`
        INSERT INTO ai_assessment_reviews (target_type, target_id, ai_analysis, ai_agrees_with_human, bias_risk_flags, status)
        VALUES ('placement_assessment', ${assessment.id}, ${aiResult.ai_analysis}, ${aiResult.ai_agrees_with_human}, ${aiResult.bias_risk_flags}, 'pending_review')
        RETURNING *
      `;

      await record(user.id, 'placement_assessment_submitted_for_review', 'placement_assessments', { assessment_id: assessment.id, scholar_user_id, strand, purpose });
      return res.status(201).json({
        assessment,
        aiReview: reviewRows[0],
        message: aiResult.aiUnavailable
          ? 'Assessment recorded. AI review was unavailable -- a human must approve this directly via /api/admin/review-pending.'
          : 'Assessment recorded and sent for AI evidence review. The scholar track will NOT change until a teacher or admin approves via /api/admin/review-pending.'
      });
    } catch (err) {
      console.error('Placement assessment error:', err);
      return res.status(500).json({ error: 'Could not record assessment.', detail: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
