// GET  /api/quizzes?course_id=5      -- list quizzes (questions/answers hidden from scholars)
// GET  /api/quizzes?id=8             -- one quiz with its questions
//      Scholars get questions WITHOUT correct_answer. Teachers/admins get everything.
// POST /api/quizzes { course_id, title, time_limit_minutes?, available_from?, available_until?,
//                      questions: [{question_text, question_type, options?, correct_answer, points?}] }
import { sql, requireDb } from '../lib/db.js';
import { getCurrentUser, requireCourseStaff } from '../lib/auth.js';
import { record } from '../lib/activityLog.js';

export default async function handler(req, res) {
  if (!requireDb(res)) return;
  const user = getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Not logged in.' });

  if (req.method === 'GET') {
    const isStaff = ['teacher', 'admin'].includes(user.role);

    if (req.query.id) {
      const { rows: quizRows } = await sql`SELECT * FROM quizzes WHERE id = ${req.query.id}`;
      if (quizRows.length === 0) return res.status(404).json({ error: 'Quiz not found.' });
      const { rows: questions } = await sql`SELECT * FROM quiz_questions WHERE quiz_id = ${req.query.id} ORDER BY position ASC`;
      const safeQuestions = isStaff ? questions : questions.map(q => ({ id: q.id, question_text: q.question_text, question_type: q.question_type, options: q.options, points: q.points }));
      return res.status(200).json({ quiz: quizRows[0], questions: safeQuestions });
    }

    if (!req.query.course_id) return res.status(400).json({ error: 'course_id or id is required.' });
    const { rows } = await sql`SELECT * FROM quizzes WHERE course_id = ${req.query.course_id}`;
    return res.status(200).json({ quizzes: rows });
  }

  if (req.method === 'POST') {
    const { course_id, title, time_limit_minutes, available_from, available_until, questions } = req.body || {};
    if (!course_id || !title || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'course_id, title, and a non-empty questions array are required.' });
    }
    const staffUser = await requireCourseStaff(req, res, course_id, sql);
    if (!staffUser) return;
    try {
      const { rows: quizRows } = await sql`
        INSERT INTO quizzes (course_id, title, time_limit_minutes, available_from, available_until, created_by)
        VALUES (${course_id}, ${title}, ${time_limit_minutes || null}, ${available_from || null}, ${available_until || null}, ${staffUser.id})
        RETURNING *
      `;
      const quiz = quizRows[0];

      let totalPoints = 0;
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q.question_text || !['multiple_choice', 'short_answer'].includes(q.question_type) || !q.correct_answer) {
          return res.status(400).json({ error: `Question ${i + 1} is missing question_text, a valid question_type, or correct_answer.` });
        }
        await sql`
          INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, points, position)
          VALUES (${quiz.id}, ${q.question_text}, ${q.question_type}, ${q.options ? JSON.stringify(q.options) : null}, ${q.correct_answer}, ${q.points || 1}, ${i})
        `;
        totalPoints += Number(q.points || 1);
      }

      // Auto-create the matching gradebook item, same pattern as assignments.
      await sql`
        INSERT INTO grade_items (course_id, item_type, item_ref_id, title, points_possible)
        VALUES (${course_id}, 'quiz', ${quiz.id}, ${title}, ${totalPoints})
      `;

      await record(staffUser.id, 'quiz_created', 'quizzes', { quiz_id: quiz.id, course_id, question_count: questions.length });
      return res.status(201).json({ quiz, questionCount: questions.length, totalPoints });
    } catch (err) {
      console.error('Quizzes POST error:', err);
      return res.status(500).json({ error: 'Could not create quiz.', detail: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
