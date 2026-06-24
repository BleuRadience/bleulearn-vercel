// GET /api/house-cup -- live standings, aggregating real points_ledger
// data by house. This is the documented "House Points" system from the
// curriculum's own House System operations protocol made real: visible
// to all scholars, points never subtracted (the underlying ledger has no
// delete/update path at all -- this endpoint only ever reads it).
import { sql, requireDb } from '../lib/db.js';
import { getCurrentUser } from '../lib/auth.js';

const HOUSE_INFO = {
  Harriet: { color: '#1A5E3A', motto: 'I never ran my train off the track and I never lost a passenger.', specialty: 'BleuHistory & Primary Source Literacy' },
  Mansa:   { color: '#C9952A', motto: 'Knowledge is the most powerful currency.', specialty: 'Financial Architecture & Cooperative Economics' },
  Esteban: { color: '#2A7F6F', motto: 'The first crossing was ours.', specialty: 'Five Languages & Geography' },
  Pauli:   { color: '#1B2A4A', motto: 'I intend to destroy segregation by positive and embracing methods.', specialty: 'Civics, Rhetoric & Law' }
};

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });
  if (!requireDb(res)) return;
  const user = getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Not logged in.' });

  const { rows } = await sql`
    SELECT u.house, COALESCE(SUM(pl.points), 0) AS total_points, COUNT(DISTINCT u.id) AS scholar_count
    FROM users u
    LEFT JOIN points_ledger pl ON pl.scholar_user_id = u.id
    WHERE u.house IS NOT NULL
    GROUP BY u.house
  `;

  const standings = Object.keys(HOUSE_INFO).map(house => {
    const row = rows.find(r => r.house === house);
    return {
      house,
      ...HOUSE_INFO[house],
      totalPoints: row ? Number(row.total_points) : 0,
      scholarCount: row ? Number(row.scholar_count) : 0
    };
  }).sort((a, b) => b.totalPoints - a.totalPoints);

  return res.status(200).json({ standings, leadingHouse: standings[0]?.house || null });
}
