import { sql } from '../lib/db.js';
import { getCurrentUser } from '../lib/auth.js';

// Vercel Serverless Function (Node.js runtime)
// Path: /api/generate-lesson-plan
// Purpose: Server-side proxy to Anthropic API so the API key is never exposed to the browser.
//
// REQUIRED SETUP BEFORE DEPLOYMENT:
//   In the Vercel project dashboard -> Settings -> Environment Variables, add:
//     ANTHROPIC_API_KEY = sk-ant-xxxxxxxxxxxx
//   This must be set for Production, Preview, and Development environments.
//   Get a key at https://console.anthropic.com/settings/keys
//
// This function is called by POST from /lesson-plans/ai-generator.html
// It does NOT accept or forward any API key from the client. The key lives only
// in the Vercel environment and is read here via process.env.

const SYSTEM_PROMPT = `You are an expert BleuLearn curriculum designer for AvaBleu House HQ. You create complete, detailed lesson plans that strictly follow the BleuLearn Sovereign Curriculum standard.

ABSOLUTE RULES FOR EVERY LESSON PLAN:
1. NO TEXTBOOKS. Every resource must be a free primary source from a documented public archive (archives.gov, loc.gov, slavevoyages.org, oyez.org, etc.) or a free open educational resource (Khan Academy, PhET, CK-12, Illustrative Mathematics, etc.).
2. EVERY LESSON must include at least one primary source or documented free resource with a specific URL.
3. EVERY LESSON must include a BLEULEARN PAUSE with a specific written prompt.
4. EVERY LESSON must include differentiation for THREE TRACKS: Bridge, Grade-Level, and Gifted.
5. EVERY LESSON must include a specific exit ticket question.
6. For BleuHistory: apply the four-question framework (WHO, WHEN, WHAT, WHY) to every document.
7. For Mathematics: use the CPA (Concrete-Pictorial-Abstract) sequence. Bar models ALWAYS before equations in Grades 1-8.
8. For Language Arts: use the appropriate Discourse Rung specified.
9. The standard NEVER changes. The scaffolding changes.
10. Cross-strand connections must be documented wherever they exist.

FORMAT YOUR LESSON PLAN EXACTLY AS FOLLOWS:

LESSON TITLE: [Title]
GRADE: [Grade] | STRAND: [Strand] | DURATION: [Duration]

DOCUMENTED LEARNING OBJECTIVE:
By the end of this lesson, scholars will be able to [measurable verb] [specific documented content] using [documented evidence standard].

FREE RESOURCES (NO TEXTBOOK):
- [Resource name] -- [URL] -- [What it provides]

VOCABULARY (FRAYER MODEL PRE-TEACH):
- [Word]: Definition | Characteristics | Example | Non-Example

OPENING (5 minutes):
[Specific opening activity. Include what teacher says verbatim.]

INSTRUCTION -- TEACHER SCRIPT AND STEPS:
STEP 1: [Detailed instruction with teacher language]
STEP 2: [Continue...]

SCHOLAR PRACTICE:
[What scholars do. Specific task with specific materials.]

DISCOURSE -- [Rung and Format]:
[Specific question for discussion. Sentence frames if Rung 1-3. Full Harkness topic if Rung 5.]

BLEULEARN PAUSE (3 minutes):
Written prompt: "[Specific metacognition question]"

EXIT TICKET:
Question: "[Specific question scholars answer in writing]"

DIFFERENTIATION:
Bridge Track: [Specific scaffolding]
Grade-Level Track: [Standard implementation]
Gifted Track: [Specific extension]

ASSESSMENT:
[What evidence is collected and how it connects to the quarterly benchmark]

ARCHIVE ASSIGNMENT (if applicable):
[Specific archive, search terms, task, BleuLearn citation format]

CONNECTION TO NEXT LESSON:
[How today sets up the next lesson]

Be specific. Include real archive URLs and real document names. Never use placeholder language like "find a primary source about X."`;

export default async function handler(req, res) {
  // CORS: restrict to same-origin in production. Adjust ALLOWED_ORIGIN for your deployed domain.
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'Server misconfiguration: ANTHROPIC_API_KEY is not set in the Vercel environment. ' +
             'Add it under Project Settings -> Environment Variables before this endpoint can function.'
    });
  }

  const { strand, grade, topic, duration, rung, focus, context, scholar_user_id } = req.body || {};

  if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
    return res.status(400).json({ error: 'A topic or unit title is required.' });
  }

  // OPTIONAL track lookup: if a specific scholar_user_id is passed (a
  // teacher generating a lesson for one scholar, not a whole class), pull
  // their CURRENT, documented track assignment for this strand and feed
  // it into the prompt -- so "differentiation" is grounded in an actual
  // assessment-backed track, not a generic guess. Never required: the
  // generator still works exactly as before if no scholar is specified.
  let trackContext = '';
  if (scholar_user_id && process.env.POSTGRES_URL) {
    try {
      const { rows } = await sql`
        SELECT track, reason FROM track_assignments
        WHERE scholar_user_id = ${scholar_user_id} AND strand = ${strand || ''} AND is_current = true
      `;
      if (rows.length > 0) {
        trackContext = `\n\nThis lesson is being generated for a specific scholar whose documented, assessment-backed track for this strand is "${rows[0].track}" (${rows[0].reason}). Write the lesson at the standard level, but make the differentiation section specifically actionable for a scholar already confirmed at this track -- not generic Bridge/Grade-Level/Gifted boilerplate.`;
      }
    } catch (err) {
      console.error('Non-fatal: could not look up track assignment:', err);
    }
  }

  // Basic input length guards to control cost and avoid abuse
  const safe = (s, max) => (typeof s === 'string' ? s.slice(0, max) : '');
  const userPrompt = `Generate a complete BleuLearn lesson plan for:

Strand: ${safe(strand, 100) || 'Not specified'}
Grade: ${safe(grade, 50) || 'Not specified'}
Topic/Unit: ${safe(topic, 300)}
Duration: ${safe(duration, 50) || '60 minutes'}
Discourse Rung: ${safe(rung, 100) || 'Teacher discretion based on grade band'}
${focus ? 'Specific Focus: ' + safe(focus, 300) : ''}
${context ? 'Additional Context: ' + safe(context, 800) : ''}${trackContext}

Follow the BleuLearn standard exactly. Include specific document names and archive URLs. Do not use textbooks.`;

  try {
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text();
      console.error('Anthropic API error:', anthropicResponse.status, errText);
      return res.status(502).json({
        error: 'The lesson plan generation service returned an error. Please try again.',
        status: anthropicResponse.status
      });
    }

    const data = await anthropicResponse.json();
    const text = (data.content || [])
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    if (!text) {
      return res.status(502).json({ error: 'No content was generated. Please try again.' });
    }

    // Persist this generated plan IF a database is connected AND a teacher/
    // admin is logged in. Neither is required for the generator to work --
    // this is additive persistence, not a hard dependency. If POSTGRES_URL
    // is unset, or no one is logged in, the plan is simply not saved and
    // the generator behaves exactly as it did before this was added.
    let saved = false;
    try {
      const user = getCurrentUser(req);
      if (user && (user.role === 'teacher' || user.role === 'admin') && process.env.POSTGRES_URL) {
        await sql`
          INSERT INTO lesson_plans (created_by, strand, grade_level, topic, content, source)
          VALUES (${user.id}, ${strand || 'Unspecified'}, ${grade || 'Unspecified'}, ${topic}, ${text}, 'ai_generated')
        `;
        saved = true;
      }
    } catch (saveErr) {
      // A failure to SAVE must never fail the generation itself -- the
      // teacher still gets their lesson plan even if persistence breaks.
      console.error('Non-fatal: could not save generated lesson plan:', saveErr);
    }

    return res.status(200).json({ lessonPlan: text, saved });

  } catch (err) {
    console.error('generate-lesson-plan handler error:', err);
    return res.status(500).json({ error: 'Internal server error while generating the lesson plan.' });
  }
}
