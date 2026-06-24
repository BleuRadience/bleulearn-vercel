// GET /api/gradebook?course_id=5&scholar_id=3  -- one scholar's full gradebook in a course
// GET /api/gradebook?course_id=5               -- teacher/admin: whole-class gradebook matrix
// POST /api/gradebook { course_id, name, weight } -- create a grade category (teacher/admin)
//
// Computes a real weighted final grade: percent-correct within each
// category, then categories combined by their weight. If a course has no
// categories defined, falls back to a simple total-points calculation
// across all grade_items -- so the gradebook is never just blank because
// categories weren't set up yet.
import { sql, requireDb } from '../lib/db.js';
import { getCurrentUser, requireCourseStaff } from '../lib/auth.js';

function computeWeightedGrade(items, grades, categories) {
  const gradeByItem = {};
  for (const g of grades) gradeByItem[g.grade_item_id] = g.points_earned;

  if (categories.length === 0) {
    let earned = 0, possible = 0;
    for (const item of items) {
      if (gradeByItem[item.id] !== undefined && gradeByItem[item.id] !== null) {
        earned += Number(gradeByItem[item.id]);
        possible += Number(item.points_possible);
      }
    }
    return possible > 0 ? Math.round((earned / possible) * 1000) / 10 : null;
  }

  let weightedTotal = 0, weightUsed = 0;
  for (const cat of categories) {
    const catItems = items.filter(i => i.category_id === cat.id);
    let earned = 0, possible = 0;
    for (const item of catItems) {
      if (gradeByItem[item.id] !== undefined && gradeByItem[item.id] !== null) {
        earned += Number(gradeByItem[item.id]);
        possible += Number(item.points_possible);
      }
    }
    if (possible > 0) {
      weightedTotal += (earned / possible) * Number(cat.weight);
      weightUsed += Number(cat.weight);
    }
  }
  return weightUsed > 0 ? Math.round((weightedTotal / weightUsed) * 100 * 10) / 10 : null;
}

export default async function handler(req, res) {
  if (!requireDb(res)) return;
  const user = getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Not logged in.' });

  if (req.method === 'GET') {
    const { course_id, scholar_id } = req.query;
    if (!course_id) return res.status(400).json({ error: 'course_id is required.' });

    const { rows: items } = await sql`SELECT * FROM grade_items WHERE course_id = ${course_id}`;
    const { rows: categories } = await sql`SELECT * FROM grade_categories WHERE course_id = ${course_id}`;

    if (scholar_id || user.role === 'scholar') {
      const targetId = scholar_id || user.id;
      if (user.role === 'scholar' && String(user.id) !== String(targetId)) {
        return res.status(403).json({ error: 'You can only view your own gradebook.' });
      }
      if (user.role === 'family') {
        const { rows: linkRows } = await sql`SELECT 1 FROM family_links WHERE family_user_id = ${user.id} AND scholar_user_id = ${targetId}`;
        if (linkRows.length === 0) return res.status(403).json({ error: 'You are not linked to this scholar.' });
      }
      const { rows: grades } = await sql`SELECT * FROM grades WHERE scholar_user_id = ${targetId}`;
      const finalGrade = computeWeightedGrade(items, grades, categories);
      const detail = items.map(item => {
        const g = grades.find(g => g.grade_item_id === item.id);
        return { item_title: item.title, points_possible: item.points_possible, points_earned: g ? g.points_earned : null, feedback: g ? g.feedback : null };
      });
      return res.status(200).json({ finalGrade, items: detail, categories });
    }

    if (!['teacher', 'admin'].includes(user.role)) {
      return res.status(403).json({ error: 'Only teachers and admins can view the whole-class gradebook.' });
    }
    // Excludes withdrawn/transferred-out students from the class matrix --
    // their grade HISTORY still exists in the grades table untouched, but
    // a teacher's whole-class view shouldn't show a final grade row for
    // someone no longer in the class.
    const { rows: roster } = await sql`
      SELECT u.id, u.full_name FROM enrollments e JOIN users u ON u.id = e.user_id
      WHERE e.course_id = ${course_id} AND e.role_in_course = 'student' AND e.status = 'active'
    `;
    const { rows: allGrades } = await sql`
      SELECT g.* FROM grades g JOIN grade_items gi ON gi.id = g.grade_item_id WHERE gi.course_id = ${course_id}
    `;
    const matrix = roster.map(scholar => {
      const scholarGrades = allGrades.filter(g => g.scholar_user_id === scholar.id);
      return { scholar_id: scholar.id, full_name: scholar.full_name, finalGrade: computeWeightedGrade(items, scholarGrades, categories) };
    });
    return res.status(200).json({ items, categories, matrix });
  }

  if (req.method === 'POST') {
    const { course_id, name, weight } = req.body || {};
    if (!course_id || !name || weight === undefined) {
      return res.status(400).json({ error: 'course_id, name, and weight are required.' });
    }
    const staffUser = await requireCourseStaff(req, res, course_id, sql);
    if (!staffUser) return;
    const { rows } = await sql`
      INSERT INTO grade_categories (course_id, name, weight) VALUES (${course_id}, ${name}, ${weight}) RETURNING *
    `;
    return res.status(201).json({ category: rows[0] });
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
