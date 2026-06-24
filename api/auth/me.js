// GET /api/auth/me -- returns the current logged-in user (from the session
// cookie) or { user: null } if no one is logged in. The front end calls
// this on page load to decide whether to show login UI or scholar UI.
import { getCurrentUser } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });
  const user = getCurrentUser(req);
  return res.status(200).json({ user });
}
