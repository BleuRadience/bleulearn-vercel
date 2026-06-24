// ============================================================================
// lib/auth.js -- Authentication helpers
// AvaBleu House HQ | BleuLearn Sovereign Curriculum | 2026
//
// WHAT THIS IS: A real, working, minimal authentication system using
// hashed passwords (bcryptjs) and signed httpOnly JWT cookies
// (jsonwebtoken). It is stateless -- there is no sessions table to manage
// or clean up. A token is valid for 7 days from issue, after which the
// user logs in again.
//
// WHAT THIS IS NOT: This is not a full identity platform. It has no
// password reset flow, no email verification, no multi-factor auth, no
// "forgot password," and no role-based UI gating beyond what each API
// route checks server-side. For a real school launch, evaluate whether a
// dedicated auth provider (Clerk, Auth0, NextAuth) is worth the added
// dependency versus continuing to extend this. What is here is real and
// secure for what it does -- it is just intentionally minimal scope, and
// that scope limit is a documented decision, not an oversight.
//
// REQUIRED ENVIRONMENT VARIABLE:
//   JWT_SECRET = any long random string, e.g. generate with:
//     node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
//   Set this in Vercel Project Settings -> Environment Variables before
//   any login/signup will work. If it is missing, every auth route below
//   returns a clear 500 error naming exactly this, rather than silently
//   issuing an insecure or unverifiable token.
// ============================================================================

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const COOKIE_NAME = 'bleulearn_session';
const TOKEN_TTL = '7d';

export function requireJwtSecret(res) {
  if (!process.env.JWT_SECRET) {
    res.status(500).json({
      error: 'Server misconfiguration: JWT_SECRET is not set.',
      detail: 'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))" ' +
              'and add it in Vercel Project Settings -> Environment Variables.'
    });
    return false;
  }
  return true;
}

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export function signToken(user) {
  // Only non-sensitive fields go in the token. Never put password_hash here.
  // algorithm is pinned explicitly (not left to the library default) so
  // that verify() below can refuse anything signed a different way --
  // this closes the "algorithm confusion" class of JWT attack, where a
  // forged token signed with a different/weaker algorithm (or "none")
  // could otherwise be accepted if verify() doesn't restrict it.
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, full_name: user.full_name },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_TTL, algorithm: 'HS256' }
  );
}

export function setSessionCookie(res, token) {
  const isProd = process.env.VERCEL_ENV === 'production';
  // SameSite=Strict (upgraded from Lax): this app has no legitimate reason
  // to send the session cookie on a cross-site navigation (no external
  // login redirect flow exists here), so the stricter setting is pure
  // upside -- it blocks the cookie from being attached to ANY cross-site
  // request, closing off CSRF on every state-changing endpoint without
  // needing a separate CSRF token system.
  res.setHeader('Set-Cookie',
    `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Strict${isProd ? '; Secure' : ''}`
  );
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict`);
}

// Parses the raw Cookie header -- avoids pulling in a cookie-parsing
// dependency for one field.
function getCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  const match = header.split(';').map(c => c.trim()).find(c => c.startsWith(name + '='));
  return match ? match.slice(name.length + 1) : null;
}

// Returns the decoded user payload from the request's session cookie, or
// null if there is no valid session. Use this at the top of any API route
// that needs to know who is calling it.
export function getCurrentUser(req) {
  const token = getCookie(req, COOKIE_NAME);
  if (!token || !process.env.JWT_SECRET) return null;
  try {
    // algorithms is pinned to exactly what signToken() uses. Without this,
    // jwt.verify() will accept a token signed with ANY algorithm the
    // attacker chooses, which is the actual mechanism behind real-world
    // "JWT algorithm confusion" account takeovers.
    return jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return null; // expired, tampered, or wrong-algorithm token -- treat as logged out, do not throw
  }
}

// Use inside any route that must be restricted to one or more roles.
// Returns true and lets the caller proceed if authorized; otherwise writes
// the 401/403 response itself and returns false so the caller can `return`.
export function requireRole(req, res, allowedRoles) {
  const user = getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: 'Not logged in.' });
    return false;
  }
  if (!allowedRoles.includes(user.role)) {
    res.status(403).json({ error: `This action requires one of these roles: ${allowedRoles.join(', ')}.` });
    return false;
  }
  return true;
}

// Fixes the course-level broken-access-control gap: a global 'teacher' role
// previously let ANY teacher grade, create content in, or view the roster
// of ANY course -- not just courses they actually teach. This checks the
// enrollments table for this specific course_id before allowing the action.
// Admins bypass this check by design (they administer every course).
export async function requireCourseStaff(req, res, courseId, sql) {
  const user = getCurrentUser(req);
  if (!user) { res.status(401).json({ error: 'Not logged in.' }); return null; }
  if (user.role === 'admin') return user;
  if (user.role !== 'teacher' && user.role !== 'family' && user.role !== 'scholar') {
    res.status(403).json({ error: 'Not authorized.' }); return null;
  }
  if (user.role !== 'teacher') { res.status(403).json({ error: 'Only teachers and admins can manage course content.' }); return null; }

  const { rows } = await sql`
    SELECT 1 FROM enrollments WHERE course_id = ${courseId} AND user_id = ${user.id} AND role_in_course IN ('teacher','ta')
  `;
  if (rows.length === 0) {
    res.status(403).json({ error: 'You are not enrolled as a teacher in this course.' });
    return null;
  }
  return user;
}

// Closes a gap found in a later review pass: nothing previously stopped a
// logged-in scholar from submitting an assignment, starting a quiz attempt,
// or posting in a forum belonging to a course they are not enrolled in at
// all. That isn't just an access-control gap -- it pollutes the gradebook
// and roster data with records for scholars who were never actually in the
// class. Admins bypass this (they administer every course). Teachers/TAs
// of the course also pass (they may legitimately test their own content).
export async function requireEnrollment(req, res, courseId, sql) {
  const user = getCurrentUser(req);
  if (!user) { res.status(401).json({ error: 'Not logged in.' }); return null; }
  if (user.role === 'admin') return user;

  const { rows } = await sql`
    SELECT 1 FROM enrollments WHERE course_id = ${courseId} AND user_id = ${user.id}
  `;
  if (rows.length === 0) {
    res.status(403).json({ error: 'You are not enrolled in this course.' });
    return null;
  }
  return user;
}
