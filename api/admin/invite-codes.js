// POST /api/admin/invite-codes { role: 'teacher'|'admin', expires_in_hours? }  -- admin only
// GET  /api/admin/invite-codes                                                 -- admin only: list unused codes
//
// This is the legitimate path for onboarding new teachers/admins now that
// signup.js no longer accepts a privileged role with no verification.
import { sql, requireDb } from '../../lib/db.js';
import { requireRole } from '../../lib/auth.js';
import { record } from '../../lib/activityLog.js';
import crypto from 'crypto';

export default async function handler(req, res) {
  if (!requireDb(res)) return;
  if (!requireRole(req, res, ['admin'])) return;

  if (req.method === 'POST') {
    const { role, expires_in_hours } = req.body || {};
    if (!['teacher', 'admin', 'case_manager'].includes(role)) {
      return res.status(400).json({ error: "role must be 'teacher', 'admin', or 'case_manager'." });
    }
    const code = crypto.randomBytes(16).toString('hex');
    const hours = Number(expires_in_hours) > 0 ? Number(expires_in_hours) : 72;

    const { rows } = await sql`
      INSERT INTO invite_codes (code, role, created_by, expires_at)
      VALUES (${code}, ${role}, ${req.adminId || null}, now() + (${hours + ' hours'})::interval)
      RETURNING *
    `;
    await record(null, 'invite_code_created', 'invite_codes', { code_id: rows[0].id, role });
    return res.status(201).json({ inviteCode: rows[0] });
  }

  if (req.method === 'GET') {
    const { rows } = await sql`
      SELECT id, code, role, expires_at, used_by, used_at FROM invite_codes
      WHERE used_by IS NULL AND expires_at > now() ORDER BY created_at DESC
    `;
    return res.status(200).json({ inviteCodes: rows });
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
