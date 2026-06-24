// GET  /api/admin/review-pending?status=pending_review&target_type=placement_assessment
//      Lists pending AI-reviewed assessments with the underlying assessment data
//      joined in, so a teacher/admin sees the original evidence AND the AI's
//      independent read side by side before deciding.
// POST /api/admin/review-pending
//      { review_id, decision: 'approved'|'overridden', human_decision_notes?, override_track? }
//      THIS IS THE ONLY PLACE an AI-reviewed assessment becomes operative.
//      Approving a placement_assessment or gifted_calibration_checkin
//      updates track_assignments using the ORIGINAL recommended action.
//      Overriding requires human_decision_notes (never a silent click) and
//      may specify override_track to set a DIFFERENT track than either the
//      human assessor or the AI suggested -- the teacher/admin has the
//      final word, always, over both.
import { sql, requireDb } from '../../lib/db.js';
import { requireRole, getCurrentUser } from '../../lib/auth.js';
import { record } from '../../lib/activityLog.js';

const VALID_TRACKS = ['bridge', 'grade_level', 'gifted'];

export default async function handler(req, res) {
  if (!requireDb(res)) return;
  if (!requireRole(req, res, ['teacher', 'admin', 'case_manager'])) return;
  const user = getCurrentUser(req);

  if (req.method === 'GET') {
    const status = req.query.status || 'pending_review';
    const targetType = req.query.target_type;

    const { rows: reviews } = targetType
      ? await sql`SELECT * FROM ai_assessment_reviews WHERE status = ${status} AND target_type = ${targetType} ORDER BY created_at ASC`
      : await sql`SELECT * FROM ai_assessment_reviews WHERE status = ${status} ORDER BY created_at ASC`;

    // Join in the underlying evidence per target_type so the reviewer
    // doesn't have to make a second request to see what's being reviewed.
    const enriched = [];
    for (const r of reviews) {
      let detail = null;
      if (r.target_type === 'placement_assessment') {
        detail = (await sql`SELECT * FROM placement_assessments WHERE id = ${r.target_id}`).rows[0];
      } else if (r.target_type === 'gifted_calibration_checkin') {
        detail = (await sql`SELECT * FROM gifted_calibration_checkins WHERE id = ${r.target_id}`).rows[0];
      } else if (r.target_type === 'iep_evaluation') {
        detail = (await sql`SELECT * FROM iep_evaluations WHERE id = ${r.target_id}`).rows[0];
      } else if (r.target_type === 'curriculum_gap_finding') {
        detail = (await sql`SELECT * FROM curriculum_gap_findings WHERE id = ${r.target_id}`).rows[0];
      }
      enriched.push({ review: r, detail });
    }
    return res.status(200).json({ pending: enriched });
  }

  if (req.method === 'POST') {
    const { review_id, decision, human_decision_notes, override_track } = req.body || {};
    if (!review_id || !['approved', 'overridden'].includes(decision)) {
      return res.status(400).json({ error: "review_id and decision ('approved' or 'overridden') are required." });
    }
    if (decision === 'overridden' && !human_decision_notes) {
      return res.status(400).json({ error: 'human_decision_notes is required when overriding -- a documented reason, not a silent click.' });
    }
    if (override_track && !VALID_TRACKS.includes(override_track)) {
      return res.status(400).json({ error: `override_track must be one of: ${VALID_TRACKS.join(', ')}` });
    }

    const { rows: reviewRows } = await sql`SELECT * FROM ai_assessment_reviews WHERE id = ${review_id}`;
    if (reviewRows.length === 0) return res.status(404).json({ error: 'Review not found.' });
    const review = reviewRows[0];
    if (review.status !== 'pending_review') {
      return res.status(409).json({ error: `This review was already resolved (status: ${review.status}).` });
    }

    try {
      await sql`
        UPDATE ai_assessment_reviews SET status = ${decision}, human_decision_notes = ${human_decision_notes || null},
          reviewed_by = ${user.id}, reviewed_at = now()
        WHERE id = ${review_id}
      `;

      // Apply the operative effect, ONLY now, ONLY here.
      let trackResult = null;
      if (review.target_type === 'placement_assessment') {
        const { rows } = await sql`SELECT * FROM placement_assessments WHERE id = ${review.target_id}`;
        const assessment = rows[0];
        const finalTrack = decision === 'overridden' && override_track ? override_track : assessment.recommended_track;
        await sql`UPDATE track_assignments SET is_current = false WHERE scholar_user_id = ${assessment.scholar_user_id} AND strand = ${assessment.strand} AND is_current = true`;
        await sql`
          INSERT INTO track_assignments (scholar_user_id, strand, track, reason, assigned_by)
          VALUES (${assessment.scholar_user_id}, ${assessment.strand}, ${finalTrack},
                  ${(decision === 'overridden' ? 'OVERRIDDEN by human after AI review, review #' : 'placement_assessments #') + assessment.id + (decision === 'overridden' ? ': ' + human_decision_notes.slice(0,150) : '')},
                  ${user.id})
        `;
        trackResult = finalTrack;
      } else if (review.target_type === 'gifted_calibration_checkin') {
        const { rows } = await sql`SELECT * FROM gifted_calibration_checkins WHERE id = ${review.target_id}`;
        const checkin = rows[0];
        let finalTrack = null;
        if (decision === 'overridden' && override_track) {
          finalTrack = override_track;
        } else if (checkin.recommended_action === 'extend_challenge') {
          finalTrack = 'gifted';
        } else if (checkin.recommended_action === 'reduce_challenge') {
          finalTrack = 'grade_level';
        }
        if (finalTrack) {
          const { rows: current } = await sql`SELECT track FROM track_assignments WHERE scholar_user_id = ${checkin.scholar_user_id} AND strand = ${checkin.strand} AND is_current = true`;
          if (current[0]?.track !== finalTrack) {
            await sql`UPDATE track_assignments SET is_current = false WHERE scholar_user_id = ${checkin.scholar_user_id} AND strand = ${checkin.strand} AND is_current = true`;
            await sql`
              INSERT INTO track_assignments (scholar_user_id, strand, track, reason, assigned_by)
              VALUES (${checkin.scholar_user_id}, ${checkin.strand}, ${finalTrack},
                      ${(decision === 'overridden' ? 'OVERRIDDEN after AI review, gifted_calibration_checkins #' : 'gifted_calibration_checkins #') + checkin.id + ' (' + checkin.quarter + ')'},
                      ${user.id})
            `;
          }
          trackResult = finalTrack;
        }
      }
      // iep_evaluation and curriculum_gap_finding have no auto-applied
      // operative table -- approval/override here just confirms the
      // documented record for teacher use; there is nothing further to
      // write automatically. Documented explicitly, not silently absent.

      await record(user.id, 'assessment_review_resolved', 'ai_assessment_reviews', { review_id, decision, target_type: review.target_type, trackResult });
      return res.status(200).json({ review_id, decision, target_type: review.target_type, trackResult });
    } catch (err) {
      console.error('Review resolution error:', err);
      return res.status(500).json({ error: 'Could not resolve review.', detail: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
