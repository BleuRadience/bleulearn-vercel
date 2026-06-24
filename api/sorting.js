// POST /api/sorting { answers: [{questionId, houseWeights: {Harriet:1,Mansa:0,...}}] }
//      Scores a completed Sorting Ceremony and writes the result to the
//      scholar's house field for real -- not a cosmetic display, an
//      actual UPDATE to users.house. Logged to activity_log so there's a
//      documented record of when and how a scholar was sorted, matching
//      this curriculum's own "the document is the standard" principle.
// GET  /api/sorting -- has the current scholar already been sorted?
import { sql, requireDb } from '../lib/db.js';
import { getCurrentUser } from '../lib/auth.js';
import { record } from '../lib/activityLog.js';

const HOUSES = ['Harriet', 'Mansa', 'Esteban', 'Pauli'];

export default async function handler(req, res) {
  if (!requireDb(res)) return;
  const user = getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Not logged in.' });

  if (req.method === 'GET') {
    const { rows } = await sql`SELECT house FROM users WHERE id = ${user.id}`;
    return res.status(200).json({ house: rows[0]?.house || null });
  }

  if (req.method === 'POST') {
    const { tally } = req.body || {};
    if (!tally || typeof tally !== 'object') {
      return res.status(400).json({ error: 'tally object is required, e.g. {"Harriet":3,"Mansa":1,"Esteban":2,"Pauli":0}' });
    }

    // Determine the winning house server-side -- never trust a client to
    // just send "I am House X" directly, or the Sorting Ceremony's results
    // could be spoofed. The actual scoring happens here, from raw tallies.
    let sortedHouse = null, highest = -1;
    for (const h of HOUSES) {
      const score = Number(tally[h]) || 0;
      if (score > highest) { highest = score; sortedHouse = h; }
    }
    if (!sortedHouse) return res.status(400).json({ error: 'Could not determine a house from the provided tally.' });

    const { rows } = await sql`
      UPDATE users SET house = ${sortedHouse} WHERE id = ${user.id} RETURNING house
    `;

    await record(user.id, 'sorted_into_house', 'sorting_ceremony', { house: sortedHouse, tally });
    return res.status(200).json({ house: rows[0].house });
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
