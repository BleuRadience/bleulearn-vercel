# BleuLearn Platform — Security Audit and Competitive Feature Review
AvaBleu House HQ | 2026

This audit was triggered by being asked: are there systems better than Moodle, and how did hackers actually exploit Moodle, so the same holes can be closed here. Both questions were researched against real, current sources rather than assumed.

## Part 1: Competitive Landscape (researched, not assumed)

| Platform | Documented strength | What this platform was missing | Status after this pass |
|---|---|---|---|
| Schoology | Badge-based achievement, parent/family portal visibility, social-style engagement | No badges; `family_links` table existed in schema but was never queried by any endpoint — a dead feature | **Closed.** `badges`/`user_badges` tables + `/api/badges`; `family_links` wired into `points.js`, `attendance.js`, `benchmarks.js`, `gradebook.js` read access |
| D2L Brightspace | Predictive at-risk analytics, accessibility-by-default | No risk flagging at all | **Not built.** A rule-based "chronically absent" flag already existed (Part IV.3 of the Master Doc); true predictive analytics is a different, larger scope and is not claimed here |
| Canvas | Mastery Paths (branching by quiz score), SpeedGrader workflow | No branching logic; grading is functional but not a dedicated fast-grading UI | **Not built this pass.** Named here so it isn't silently dropped — the gradebook and quiz-attempt data needed to build this already exists |
| Moodle (for contrast) | Deepest customization, largest plugin ecosystem, most mature self-hosted option | — | This platform deliberately does not attempt plugin-system parity; see DEVELOPER_SETUP.md |

## Part 2: Real Moodle CVEs Researched, and What They Reveal

Four real, recent Moodle security disclosures were used as the basis for this audit, not a generic "best practices" checklist:

- **CVE-2025-26529** — Stored XSS in admin log rendering (`get_description()` output for Safe Exam Browser config values rendered unescaped at `/report/loglive/index.php`), leading to admin account takeover when an admin views the log.
- **CVE-2025-49517** — SQL injection in the session management API, exploitable in some configurations without authentication.
- **CVE-2025-49516** — SSRF: Moodle could be made to issue server-side HTTP requests to internal URLs.
- **CVE-2026-7274 / CVE-2026-7275** — SQL injection in the external-database auth plugin; RCE in the Google Drive repository plugin.

Each was used as a search pattern against this codebase. Two real, exploitable findings came directly from that search — not from generic scanning.

## Part 3: Findings in This Codebase, By Severity

### CRITICAL — Privilege escalation via public signup
**The bug:** `api/auth/signup.js` accepted `role` directly from the request body with zero restriction. Anyone, unauthenticated, could `POST {role:"admin"}` and receive full administrative access immediately. No XSS chain, no auth bypass needed — just a direct request. This is more severe than CVE-2025-26529 (which required tricking an admin into viewing a poisoned log entry); this required nothing.

**The fix:** Self-service signup is now restricted to `scholar` and `family` roles only. Creating `teacher` or `admin` requires either a single-use, time-limited invite code issued by an existing admin (`invite_codes` table, `/api/admin/invite-codes`), or — for the very first admin only — an `INITIAL_ADMIN_SETUP_SECRET` environment variable matched exactly, and only while zero admin accounts exist. That bootstrap path permanently closes itself the moment one admin exists, verified directly: after inserting one admin, `SELECT COUNT(*) FROM users WHERE role='admin'` returns 1, and the code checks `=== 0` before allowing the bootstrap path again.

### HIGH — Stored XSS via unescaped data in innerHTML
**The bug:** `course/index.html` and `gradebook/index.html` built `innerHTML` directly from template literals containing API data — course titles, assignment titles, scholar names, grading feedback, forum content — with no escaping. A course or assignment titled `<img src=x onerror=alert(document.cookie)>` would execute in the browser of every teacher or scholar who viewed that page. This is the identical vulnerability class as CVE-2025-26529: untrusted stored data rendered unescaped in a view other users (including privileged ones) will load.

**The fix:** `escapeHtml()` added to `js/bleulearn.js` and applied to every place user-controlled data is inserted into `innerHTML` across both pages. Verified directly: `escapeHtml('<img src=x onerror=alert(document.cookie)>')` produces a string with no executable `<img` tag remaining.

### MEDIUM — Course-level broken access control (IDOR)
**The bug:** Every course-scoped write endpoint (`assignments.js`, `quizzes.js`, `forums.js`, `course-sections.js`, `gradebook.js`, `enrollments.js`, and grading inside `submissions.js`) checked only the caller's *global* role (`teacher` or `admin`) — never whether that specific teacher was actually enrolled in *that specific course*. Any teacher account could grade, create assignments/quizzes/forums in, or view the full roster of, any other teacher's course, just by knowing its `course_id`.

**The fix:** `requireCourseStaff(req, res, courseId, sql)` added to `lib/auth.js`, checking the `enrollments` table for `role_in_course IN ('teacher','ta')` against that exact course before allowing the action (admins still bypass, by design). Wired into all six endpoints plus the grading path in `submissions.js`, which required looking up the course via the assignment first. Verified directly: a "Teacher A" with zero enrollment in "Teacher B's" course returns no matching enrollment row, which is exactly the condition `requireCourseStaff` checks before responding 403.

### MEDIUM — JWT algorithm not pinned
**The bug:** `jwt.verify(token, secret)` was called with no `algorithms` restriction, meaning the library's default behavior would accept a token claiming any algorithm the token itself specifies — the real-world mechanism behind JWT "algorithm confusion" account-takeover attacks.

**The fix:** Both `signToken()` and `getCurrentUser()` now explicitly pin `algorithms: ['HS256']`. Verified directly: a forged token with header `{"alg":"none"}` and no signature is rejected with `jwt signature is required`, confirming the pin is enforced, not just declared.

### MEDIUM — No login rate limiting
**The bug:** Unlimited login attempts were possible against any account — a direct brute-force and credential-stuffing exposure, especially relevant for a platform holding minors' data.

**The fix:** `login_attempts` table logs every attempt. Login is blocked with HTTP 429 after 5 failures for the same email within a 15-minute window. Verified directly: after 5 logged failures, the query confirming lockout returns true.

### LOW-MEDIUM — CSRF cookie posture
**The fix:** Session cookie `SameSite` upgraded from `Lax` to `Strict`. This application has no legitimate cross-site cookie use case (no external OAuth redirect flow), so the stricter setting is pure improvement with no functional cost.

### Confirmed clean on first audit (not a finding, stated for completeness)
- **SQL injection:** every database call in every endpoint uses the `sql` tagged-template (parameterized) form, except `migrate.js`'s `sql.query()`, which only ever runs the trusted `lib/schema.sql` file read from disk — never user input. Audited via `grep` across the entire `api/` and `lib/` directories.
- **SSRF:** no endpoint accepts a user-supplied URL for server-side fetching. The only outbound server-side request is the hardcoded `https://api.anthropic.com/v1/messages` call in `generate-lesson-plan.js`.

## Part 4: How Every Fix Was Verified

Not by code review alone. An in-memory Postgres engine ran the actual schema (46 statements, all succeeding) and the actual logic:
- Simulated the exact old vulnerable signup logic vs. the new logic for a no-invite-code admin signup attempt: blocked.
- Bootstrapped one admin, confirmed the count-check that closes the bootstrap path forever after.
- Created and then reused an invite code: second use correctly rejected.
- Signed a real HS256 token and verified it; forged an `alg:none` token and confirmed `jwt.verify` with pinned algorithms rejects it.
- Logged 5 failed attempts and confirmed the lockout query returns true on the 6th.
- Ran the actual `escapeHtml()` function against a real XSS payload and confirmed no executable tag survives.
- Created two teachers and one course enrolled to only one of them; confirmed the unenrolled teacher has no matching row in the exact query `requireCourseStaff` runs.
- Created a family link and a badge award end-to-end and confirmed both are queryable exactly as the new endpoints query them.

One real bug was found and fixed *during this verification*, not before it: the first attempt at the rate-limiting and invite-code-expiry SQL used `${number} * interval '1 minute'` syntax that an in-memory test engine rejected as an unsupported operator combination. Rather than assume real Postgres would handle it differently without proof, the fix was changed to the more universally-supported `(${literal})::interval` cast pattern and re-verified.

## Part 5: What This Audit Does Not Cover

- **Infrastructure-level security** (Vercel platform security, DDoS protection, TLS configuration) is Vercel's responsibility, not this codebase's.
- **Dependency vulnerabilities** in `@vercel/postgres`, `bcryptjs`, or `jsonwebtoken` themselves were not independently audited — run `npm audit` periodically as a developer habit, since this document only covers code written for this platform.
- **Social engineering and phishing** are not solvable in code.
- This audit was scoped to the patterns found in real, current Moodle CVEs. It is not a substitute for a professional third-party penetration test before this platform handles real student data at scale.

## Part 6: Second Review Pass — Gaps Found After the First "Complete" Pass

Asked to review this work again specifically for gaps and omissions. Four more real, concrete problems were found by re-reading the actual code rather than trusting the prior summary:

1. **Scholars could submit/attempt/post into courses they were never enrolled in.** `submissions.js`, `quiz-attempts.js`, `forum-posts.js`, and `activity-completions.js` all let any logged-in scholar act against any `assignment_id`/`quiz_id`/`forum_id`/`activity_id` they could guess or find, regardless of enrollment. `forum-posts.js` even had a code comment claiming "anyone enrolled can post" while the actual code never checked that at all. Fixed with a new `requireEnrollment()` helper, wired into all four, each looking up the relevant course first.

2. **The security fix to signup broke signup.** `api/auth/signup.js` was correctly changed to require an invite code or setup secret for `teacher`/`admin` roles — but `login/index.html`'s signup form was never updated with fields to enter either one. The backend was secure; the only UI to use it was not functional for its own stated purpose. Fixed: the form now shows invite-code and setup-secret fields when a privileged role is selected.

3. **`badges` and `family-links` had real, tested APIs and zero UI.** An admin could only use them via raw HTTP requests. Built `/admin-panel/` to actually expose invite-code generation, family-link creation, and badge creation/awarding.

4. **A naming collision, left as-is and documented rather than rushed:** a decorative, purely cosmetic `/badges/` page already existed from the original content build, with a hardcoded "⭐ 0" display unrelated to the real badge system. It was not rewritten in this pass — that's a content/UX task, not a security or completeness gap — but it is noted here so it isn't mistaken for the same thing as the new `/admin-panel/` badge system.

Every fix in this section was re-verified against the in-memory Postgres engine: an enrolled scholar's full submit-grade-gradebook chain still works after adding the gate, and a scholar with no enrollment row for that course is confirmed blocked by the exact query `requireEnrollment` runs.
