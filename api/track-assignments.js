// GET /api/track-assignments?scholar_user_id=3            -- this scholar's current track per strand
// GET /api/track-assignments?scholar_user_id=3&strand=Math -- one strand only
//
// This is the operative record a teacher (or the AI lesson generator)
// should check before differentiating for a specific scholar. Read-only
// here by design -- the only way to CHANGE a track is through a new
// placement_assessments or gifted_calibration_checkins row, so every
// track change always has documented evidence behind it. There is no
// endpoint to directly edit a track_assignments row.
import { sql, requireDb } from '../lib/db.js';
import { getCurrentUser } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });
  if (!requireDb(res)) return;
  const user = getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Not logged in.' });

  const { scholar_user_id, strand } = req.query;
  if (!scholar_user_id) return res.status(400).json({ error: 'scholar_user_id is required.' });

  if (user.role === 'scholar' && String(user.id) !== String(scholar_user_id)) {
    return res.status(403).json({ error: 'You can only view your own track assignments.' });
  }
  if (user.role === 'family') {
    const { rows: linkRows } = await sql`SELECT 1 FROM family_links WHERE family_user_id = ${user.id} AND scholar_user_id = ${scholar_user_id}`;
    if (linkRows.length === 0) return res.status(403).json({ error: 'You are not linked to this scholar.' });
  }

  const { rows } = strand
    ? await sql`SELECT * FROM track_assignments WHERE scholar_user_id = ${scholar_user_id} AND strand = ${strand} AND is_current = true`
    : await sql`SELECT * FROM track_assignments WHERE scholar_user_id = ${scholar_user_id} AND is_current = true ORDER BY strand ASC`;

  return res.status(200).json({ tracks: rows });
}
