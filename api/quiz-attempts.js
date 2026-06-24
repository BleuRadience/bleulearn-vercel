// POST /api/quiz-attempts { quiz_id }                            -- scholar starts an attempt
// POST /api/quiz-attempts { attempt_id, responses: [{question_id, response_text}] } -- submit + auto-grade
// GET  /api/quiz-attempts?quiz_id=8                              -- scholar: their own attempts
// GET  /api/quiz-attempts?attempt_id=44                          -- full result detail
//
// AUTO-GRADING: multiple_choice grades exactly (selected option id vs.
// correct_answer). short_answer grades on a case-insensitive, whitespace-
// trimmed exact match -- which is real but limited; it will mark a
// correct answer wrong if phrased differently than expected. That
// limitation is intentional to disclose rather than to oversell this as
// smarter than it is. Every short_answer response is still visible to the
// teacher for manual override via api/submissions-style grading logic
// (not yet wired for quiz manual override -- see DEVELOPER_SETUP.md).
import { sql, requireDb } from '../lib/db.js';
import { getCurrentUser, requireEnrollment } from '../lib/auth.js';
import { record } from '../lib/activityLog.js';

export default async function handler(req, res) {
  if (!requireDb(res)) return;
  const user = getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Not logged in.' });

  if (req.method === 'GET') {
    if (req.query.attempt_id) {
      const { rows: attemptRows } = await sql`SELECT * FROM quiz_attempts WHERE id = ${req.query.attempt_id}`;
      if (attemptRows.length === 0) return res.status(404).json({ error: 'Attempt not found.' });
      if (attemptRows[0].scholar_user_id !== user.id && !['teacher', 'admin'].includes(user.role)) {
        return res.status(403).json({ error: 'You can only view your own attempts.' });
      }
      const { rows: responses } = await sql`
        SELECT r.*, q.question_text, q.points AS question_points FROM quiz_responses r
        JOIN quiz_questions q ON q.id = r.question_id WHERE r.attempt_id = ${req.query.attempt_id}
      `;
      return res.status(200).json({ attempt: attemptRows[0], responses });
    }
    if (!req.query.quiz_id) return res.status(400).json({ error: 'quiz_id or attempt_id is required.' });
    const { rows } = await sql`
      SELECT * FROM quiz_attempts WHERE quiz_id = ${req.query.quiz_id} AND scholar_user_id = ${user.id} ORDER BY started_at DESC
    `;
    return res.status(200).json({ attempts: rows });
  }

  if (req.method === 'POST') {
    const { quiz_id, attempt_id, responses } = req.body || {};

    // Mode 1: start a new attempt.
    if (quiz_id && !attempt_id) {
      const { rows: quizRows } = await sql`SELECT * FROM quizzes WHERE id = ${quiz_id}`;
      if (quizRows.length === 0) return res.status(404).json({ error: 'Quiz not found.' });
      if (!(await requireEnrollment(req, res, quizRows[0].course_id, sql))) return;

      // ACCOMMODATION: if this scholar has an active accommodation plan,
      // their effective time limit is multiplied accordingly. Found and
      // fixed alongside this: time limits were stored on every quiz but
      // never enforced for ANYONE -- there was nothing to extend, because
      // no one was being timed. Both are fixed together here.
      const { rows: planRows } = await sql`
        SELECT extended_time_multiplier FROM accommodation_plans
        WHERE scholar_user_id = ${user.id} AND status = 'active' ORDER BY extended_time_multiplier DESC LIMIT 1
      `;
      const multiplier = planRows.length > 0 ? Number(planRows[0].extended_time_multiplier) : 1.0;
      const effectiveLimit = quizRows[0].time_limit_minutes
        ? Math.round(Number(quizRows[0].time_limit_minutes) * multiplier)
        : null;

      const { rows } = await sql`
        INSERT INTO quiz_attempts (quiz_id, scholar_user_id, effective_time_limit_minutes)
        VALUES (${quiz_id}, ${user.id}, ${effectiveLimit}) RETURNING *
      `;
      await record(user.id, 'quiz_attempt_started', 'quiz_attempts', { attempt_id: rows[0].id, quiz_id, effectiveLimit });
      return res.status(201).json({ attempt: rows[0], effectiveTimeLimitMinutes: effectiveLimit });
    }

    // Mode 2: submit responses and auto-grade.
    if (attempt_id && Array.isArray(responses)) {
      const { rows: attemptRows } = await sql`SELECT * FROM quiz_attempts WHERE id = ${attempt_id}`;
      if (attemptRows.length === 0) return res.status(404).json({ error: 'Attempt not found.' });
      const attempt = attemptRows[0];
      if (attempt.scholar_user_id !== user.id) return res.status(403).json({ error: 'This is not your attempt.' });
      if (attempt.status === 'submitted') return res.status(409).json({ error: 'This attempt was already submitted.' });

      // ENFORCEMENT: previously a quiz's time_limit_minutes was stored but
      // never actually checked anywhere -- a scholar submitting 3 hours
      // after starting was accepted identically to one who submitted in 2
      // minutes. This is the first real enforcement, using the effective
      // (possibly accommodation-extended) limit captured at attempt start.
      if (attempt.effective_time_limit_minutes) {
        const elapsedMinutes = (Date.now() - new Date(attempt.started_at).getTime()) / 60000;
        if (elapsedMinutes > attempt.effective_time_limit_minutes) {
          // Deliberately does NOT auto-grade as zero and does NOT mark the
          // attempt 'submitted' -- that would destroy the scholar's actual
          // answers and remove a teacher's ability to review a borderline
          // case (clock drift, a brief disconnect, etc). The attempt stays
          // 'in_progress'; only an explicit teacher action can resolve it.
          // There is no such manual-override endpoint yet -- see
          // DEVELOPER_SETUP.md, this is named there as the next piece.
          return res.status(403).json({
            error: `Time limit exceeded. This attempt's limit was ${attempt.effective_time_limit_minutes} minutes; ${Math.round(elapsedMinutes)} minutes elapsed. Your answers were not submitted -- contact your teacher, who can review this attempt.`
          });
        }
      }

      const { rows: questions } = await sql`SELECT * FROM quiz_questions WHERE quiz_id = ${attempt.quiz_id}`;
      let score = 0, maxScore = 0;

      for (const q of questions) {
        maxScore += Number(q.points);
        const resp = responses.find(r => String(r.question_id) === String(q.id));
        const responseText = resp ? (resp.response_text || '') : '';
        const isCorrect = responseText.trim().toLowerCase() === String(q.correct_answer).trim().toLowerCase();
        const pointsAwarded = isCorrect ? Number(q.points) : 0;
        if (isCorrect) score += pointsAwarded;

        await sql`
          INSERT INTO quiz_responses (attempt_id, question_id, response_text, is_correct, points_awarded)
          VALUES (${attempt_id}, ${q.id}, ${responseText}, ${isCorrect}, ${pointsAwarded})
          ON CONFLICT (attempt_id, question_id) DO UPDATE SET response_text = EXCLUDED.response_text, is_correct = EXCLUDED.is_correct, points_awarded = EXCLUDED.points_awarded
        `;
      }

      const { rows: updated } = await sql`
        UPDATE quiz_attempts SET submitted_at = now(), score = ${score}, max_score = ${maxScore}, status = 'submitted'
        WHERE id = ${attempt_id} RETURNING *
      `;

      // Mirror into the gradebook, same pattern as submissions.js.
      const { rows: giRows } = await sql`SELECT id FROM grade_items WHERE item_type = 'quiz' AND item_ref_id = ${attempt.quiz_id}`;
      if (giRows.length > 0) {
        await sql`
          INSERT INTO grades (grade_item_id, scholar_user_id, points_earned)
          VALUES (${giRows[0].id}, ${user.id}, ${score})
          ON CONFLICT (grade_item_id, scholar_user_id) DO UPDATE SET points_earned = EXCLUDED.points_earned, graded_at = now()
        `;
      }

      await record(user.id, 'quiz_submitted', 'quiz_attempts', { attempt_id, score, maxScore });
      return res.status(200).json({ attempt: updated[0], score, maxScore });
    }

    return res.status(400).json({ error: 'Provide either quiz_id (to start) or attempt_id + responses (to submit).' });
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
