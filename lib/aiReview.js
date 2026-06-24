// ============================================================================
// lib/aiReview.js -- AI-assisted, bias-aware second opinion on assessments
// AvaBleu House HQ | BleuLearn Sovereign Curriculum | 2026
//
// CORE SAFETY RULE, NON-NEGOTIABLE: this module NEVER writes to
// track_assignments, accommodation_plans, or any other operative table.
// It only ever produces an ai_assessment_reviews row with status
// 'pending_review'. A human teacher or admin must explicitly call
// /api/admin/review-pending to approve or override before anything this
// module says has any effect on a real scholar's placement. If you are
// extending this file and find yourself making it write somewhere else
// directly, stop -- that defeats the entire reason this exists.
//
// BIAS-REDUCTION DESIGN, STATED EXPLICITLY:
// 1. This platform does not collect race, ethnicity, gender, or any other
//    demographic field anywhere in its schema. The AI is never given
//    anything to be biased BY along those lines, because it was never
//    given anything at all.
// 2. The AI is given ONLY: the documented evidence text the human
//    assessor wrote, the relevant scope-and-sequence expectation (if any),
//    and the human's recommended action. It is explicitly instructed to
//    evaluate the evidence against the documented standard, not to guess
//    at anything about who the scholar is.
// 3. The AI is explicitly instructed to flag -- not silently accept -- any
//    assessment where the documented evidence is vague, impressionistic,
//    or not tied to a specific observed work sample, because that
//    pattern (subjective impression standing in for documented evidence)
//    is the actual, well-documented mechanism behind real-world
//    disparities in gifted referral and IEP/discipline referral. Honest
//    note: this is a heuristic, not a guarantee -- an AI model is not
//    immune to bias and this system does not claim it is. It is a second,
//    independent, evidence-anchored read -- not a debiasing oracle.
// ============================================================================

const REVIEW_SYSTEM_PROMPT = `You are an independent, evidence-only academic reviewer for the BleuLearn Sovereign Curriculum. Your job is to give a second opinion on an educational assessment decision -- a placement assessment, an IEP instructional evaluation, or a Gifted Program calibration check-in.

ABSOLUTE RULES:
1. You are given ONLY documented evidence text and a recommended action. You are NEVER given and must NEVER assume anything about the scholar's race, ethnicity, gender, family background, name origin, or any other demographic or identity characteristic. If the text provided to you contains anything that reads like a proxy for identity rather than documented academic evidence (a name, a neighborhood, a family circumstance), do not factor it into your analysis at all and note in bias_risk_flags that irrelevant information was present in what should be a purely evidentiary record.
2. Evaluate whether the documented evidence actually supports the recommended action. Evidence is a SPECIFIC observed behavior, work sample, or test response. "Seems behind," "doesn't seem motivated," "is clearly gifted," or any other impressionistic judgment with no specific observed instance is NOT sufficient evidence -- flag it explicitly in bias_risk_flags.
3. State plainly whether you agree or disagree with the human's recommended action based on the evidence as written. Disagreement is not a failure on your part or the human's -- it is the entire point of a second opinion.
4. Never recommend a final decision. Your output is an analysis for a human to read and decide upon, not a verdict. You are never the last word.

Respond ONLY with valid JSON in this exact shape, no other text:
{
  "ai_agrees_with_human": true or false,
  "ai_analysis": "2-4 sentences evaluating whether the documented evidence supports the recommended action",
  "bias_risk_flags": "specific concerns about vague/impressionistic evidence or irrelevant identity-adjacent information, or null if none found"
}`;

export async function runAiReview({ targetType, documentedEvidence, recommendedAction, scopeSequenceContext }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      ai_agrees_with_human: null,
      ai_analysis: 'AI review unavailable: ANTHROPIC_API_KEY is not configured. A human must review this assessment directly without AI assistance.',
      bias_risk_flags: null,
      aiUnavailable: true
    };
  }

  const userPrompt = `Assessment type: ${targetType}
Documented evidence (written by the human assessor): ${documentedEvidence}
Recommended action: ${recommendedAction}
${scopeSequenceContext ? 'Relevant documented scope-and-sequence expectation: ' + scopeSequenceContext : ''}

Provide your independent evidence-based analysis as instructed.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 500,
        system: REVIEW_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('AI review API error:', response.status, errText);
      return { ai_agrees_with_human: null, ai_analysis: 'AI review service returned an error. A human must review this assessment directly.', bias_risk_flags: null, aiUnavailable: true };
    }

    const data = await response.json();
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');

    let parsed;
    try {
      parsed = JSON.parse(text.trim());
    } catch {
      // Model didn't return clean JSON -- never silently fabricate a
      // structured result from unparseable output.
      return { ai_agrees_with_human: null, ai_analysis: 'AI review returned an unparseable response. A human must review this assessment directly. Raw response: ' + text.slice(0, 300), bias_risk_flags: null, aiUnavailable: true };
    }

    if (typeof parsed.ai_agrees_with_human !== 'boolean' || typeof parsed.ai_analysis !== 'string') {
      return { ai_agrees_with_human: null, ai_analysis: 'AI review response was missing required fields. A human must review this assessment directly.', bias_risk_flags: null, aiUnavailable: true };
    }

    return {
      ai_agrees_with_human: parsed.ai_agrees_with_human,
      ai_analysis: parsed.ai_analysis,
      bias_risk_flags: parsed.bias_risk_flags || null,
      aiUnavailable: false
    };
  } catch (err) {
    console.error('AI review network error:', err);
    return { ai_agrees_with_human: null, ai_analysis: 'AI review failed due to a network error. A human must review this assessment directly.', bias_risk_flags: null, aiUnavailable: true };
  }
}
