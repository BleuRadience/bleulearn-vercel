// POST /api/auth/signup -- { email, password, full_name, role, grade_level?, house?, invite_code?, setup_secret? }
//
// SECURITY: Self-service signup may ONLY create 'scholar' or 'family'
// accounts. Creating 'teacher' or 'admin' requires ONE of:
//   (a) a valid, unused, unexpired invite code (see invite_codes table,
//       issued by an existing admin through /api/admin/invite-codes), or
//   (b) for the very first admin only: the environment variable
//       INITIAL_ADMIN_SETUP_SECRET, matched exactly, AND zero admin users
//       currently exist in the database. This path closes itself
//       permanently the moment one admin account exists.
//
// Before this fix, role was accepted directly from the request body with
// no restriction at all -- anyone could POST {role:'admin'} and receive
// full administrative access with zero authentication. That was found
// and is now closed. See SECURITY_AUDIT.md.
import { sql, requireDb } from '../../lib/db.js';
import { hashPassword, signToken, setSessionCookie, requireJwtSecret } from '../../lib/auth.js';

const SELF_SERVICE_ROLES = ['scholar', 'family'];
const PRIVILEGED_ROLES = ['teacher', 'admin', 'case_manager'];
const VALID_HOUSES = ['Harriet', 'Mansa', 'Esteban', 'Pauli'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  if (!requireDb(res)) return;
  if (!requireJwtSecret(res)) return;

  const { email, password, full_name, role, grade_level, house, invite_code, setup_secret } = req.body || {};

  if (!email || !password || !full_name || !role) {
    return res.status(400).json({ error: 'email, password, full_name, and role are all required.' });
  }
  if (![...SELF_SERVICE_ROLES, ...PRIVILEGED_ROLES].includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${[...SELF_SERVICE_ROLES, ...PRIVILEGED_ROLES].join(', ')}` });
  }
  if (house && !VALID_HOUSES.includes(house)) {
    return res.status(400).json({ error: `house must be one of: ${VALID_HOUSES.join(', ')}` });
  }
  // Input length caps -- avoids both oversized-payload abuse and (for
  // password) excess bcrypt hashing cost on absurdly long input.
  if (password.length < 8 || password.length > 200) {
    return res.status(400).json({ error: 'Password must be between 8 and 200 characters.' });
  }
  if (email.length > 255 || full_name.length > 200) {
    return res.status(400).json({ error: 'Email or name is too long.' });
  }

  try {
    let inviteCodeRow = null;

    if (PRIVILEGED_ROLES.includes(role)) {
      // Path (b): one-time bootstrap for the very first admin.
      if (role === 'admin' && setup_secret && process.env.INITIAL_ADMIN_SETUP_SECRET) {
        const { rows: adminCount } = await sql`SELECT COUNT(*) AS n FROM users WHERE role = 'admin'`;
        if (Number(adminCount[0].n) === 0 && setup_secret === process.env.INITIAL_ADMIN_SETUP_SECRET) {
          // Bootstrap path approved -- skip invite code requirement below.
        } else {
          return res.status(403).json({ error: 'Initial admin setup is not available: either an admin already exists, or the setup secret is incorrect.' });
        }
      } else {
        // Path (a): require a valid invite code matching this exact role.
        if (!invite_code) {
          return res.status(403).json({ error: `Creating a "${role}" account requires an invite code from an existing administrator. Self-service signup only allows: ${SELF_SERVICE_ROLES.join(', ')}.` });
        }
        const { rows: codeRows } = await sql`
          SELECT * FROM invite_codes WHERE code = ${invite_code} AND role = ${role} AND used_by IS NULL AND expires_at > now()
        `;
        if (codeRows.length === 0) {
          return res.status(403).json({ error: 'That invite code is invalid, already used, or expired.' });
        }
        inviteCodeRow = codeRows[0];
      }
    }

    const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const password_hash = await hashPassword(password);
    const { rows } = await sql`
      INSERT INTO users (email, password_hash, role, full_name, grade_level, house)
      VALUES (${email}, ${password_hash}, ${role}, ${full_name}, ${grade_level || null}, ${house || null})
      RETURNING id, email, role, full_name, grade_level, house
    `;
    const user = rows[0];

    if (inviteCodeRow) {
      await sql`UPDATE invite_codes SET used_by = ${user.id}, used_at = now() WHERE id = ${inviteCodeRow.id}`;
    }

    const token = signToken(user);
    setSessionCookie(res, token);
    return res.status(201).json({ user });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ error: 'Could not create account.', detail: err.message });
  }
}
