// POST /api/auth/login -- { email, password }
//
// SECURITY: locks out an email after 5 failed attempts within 15 minutes,
// closing the brute-force/credential-stuffing hole that existed here
// before (no attempt limiting at all). Every attempt, success or failure,
// is recorded in login_attempts. The lockout is keyed by email, not IP,
// so it can't be bypassed by an attacker rotating source IPs -- the
// tradeoff is that it could be used to lock a real user out by an
// attacker who only knows their email; that is the standard, accepted
// tradeoff for this kind of protection and is why the lockout window is
// short (15 minutes) rather than long.
import { sql, requireDb } from '../../lib/db.js';
import { verifyPassword, signToken, setSessionCookie, requireJwtSecret } from '../../lib/auth.js';

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  if (!requireDb(res)) return;
  if (!requireJwtSecret(res)) return;

  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required.' });
  }

  try {
    // WINDOW_MINUTES is a hardcoded constant in this file, never user input,
    // so building this fragment with a plain template literal carries no
    // injection risk -- the only untrusted value here (email) still goes
    // through the parameterized ${email} binding below.
    const windowLiteral = `${WINDOW_MINUTES} minutes`;
    const { rows: recentAttempts } = await sql`
      SELECT COUNT(*) AS n FROM login_attempts
      WHERE email = ${email} AND succeeded = false AND attempted_at > now() - (${windowLiteral})::interval
    `;
    if (Number(recentAttempts[0].n) >= MAX_ATTEMPTS) {
      return res.status(429).json({ error: `Too many failed login attempts. Try again in ${WINDOW_MINUTES} minutes.` });
    }

    const { rows } = await sql`SELECT * FROM users WHERE email = ${email}`;
    const user = rows[0];
    const valid = user ? await verifyPassword(password, user.password_hash) : false;

    await sql`INSERT INTO login_attempts (email, succeeded) VALUES (${email}, ${valid})`;

    if (!valid) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }

    const token = signToken(user);
    setSessionCookie(res, token);
    return res.status(200).json({
      user: { id: user.id, email: user.email, role: user.role, full_name: user.full_name, grade_level: user.grade_level, house: user.house }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed.', detail: err.message });
  }
}
