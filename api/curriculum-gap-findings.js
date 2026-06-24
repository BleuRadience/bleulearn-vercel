// POST /api/curriculum-gap-findings
//   { transfer_record_id, strand, prior_school_coverage?, bleulearn_expected_level?,
//     documented_gap, severity?, recommended_action? }
// GET  /api/curriculum-gap-findings?transfer_record_id=4
//
// This is the direct answer to "review of curriculum from the other
// school to see what they lack" -- one row per strand, with a documented,
// named gap, never just a vague "behind" assessment.
import { sql, requireDb } from '../lib/db.js';
import { requireRole, getCurrentUser } from '../lib/auth.js';
import { record } from '../lib/activityLog.js';
import { runAiReview } from '../lib/aiReview.js';

export default async function handler(req, res) {
  if (!requireDb(res)) return;
  if (!requireRole(req, res, ['teacher', 'admin', 'case_manager'])) return;
  const user = getCurrentUser(req);

  if (req.method === 'GET') {
    const { transfer_record_id } = req.query;
    if (!transfer_record_id) return res.status(400).json({ error: 'transfer_record_id is required.' });
    const { rows } = await sql`SELECT * FROM curriculum_gap_findings WHERE transfer_record_id = ${transfer_record_id} ORDER BY strand ASC`;
    return res.status(200).json({ gapFindings: rows });
  }

  if (req.method === 'POST') {
    const { transfer_record_id, strand, prior_school_coverage, bleulearn_expected_level, documented_gap, severity, recommended_action } = req.body || {};
    if (!transfer_record_id || !strand || !documented_gap) {
      return res.status(400).json({ error: 'transfer_record_id, strand, and documented_gap are required.' });
    }
    const validSeverity = ['none', 'minor', 'significant'];

    // Pull the structured scope-and-sequence reference for this strand if
    // one exists -- closes the prior gap where "what BleuLearn expects"
    // was pure free text relying on one teacher's memory of the framework
    // documents, with no system-enforced cross-reference at all.
    const { rows: scopeRows } = await sql`SELECT expected_skill, source_document FROM scope_sequence_references WHERE strand = ${strand} LIMIT 1`;
    const structuredExpectation = scopeRows[0]
      ? `${scopeRows[0].expected_skill} (per ${scopeRows[0].source_document})`
      : (bleulearn_expected_level || null);

    const { rows } = await sql`
      INSERT INTO curriculum_gap_findings
        (transfer_record_id, strand, prior_school_coverage, bleulearn_expected_level, documented_gap, severity, recommended_action, reviewed_by)
      VALUES (${transfer_record_id}, ${strand}, ${prior_school_coverage || null}, ${structuredExpectation},
              ${documented_gap}, ${validSeverity.includes(severity) ? severity : 'minor'}, ${recommended_action || null}, ${user.id})
      RETURNING *
    `;
    const finding = rows[0];

    const aiResult = await runAiReview({
      targetType: 'curriculum_gap_finding',
      documentedEvidence: `Prior school coverage: ${prior_school_coverage || 'not specified'}\nDocumented gap claimed: ${documented_gap}`,
      recommendedAction: `Severity: ${finding.severity}. Recommended action: ${recommended_action || 'none specified'}`,
      scopeSequenceContext: structuredExpectation
    });

    const { rows: reviewRows } = await sql`
      INSERT INTO ai_assessment_reviews (target_type, target_id, ai_analysis, ai_agrees_with_human, bias_risk_flags, status)
      VALUES ('curriculum_gap_finding', ${finding.id}, ${aiResult.ai_analysis}, ${aiResult.ai_agrees_with_human}, ${aiResult.bias_risk_flags}, 'pending_review')
      RETURNING *
    `;

    await record(user.id, 'curriculum_gap_finding_submitted_for_review', 'curriculum_gap_findings', { finding_id: finding.id, strand, severity: finding.severity });
    return res.status(201).json({ gapFinding: finding, aiReview: reviewRows[0] });
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
