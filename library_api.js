// GET  /api/library          -- the logged-in scholar's real reading record + total points earned from it
// POST /api/library { book_title, book_author?, points_awarded }
//      Records a book as read for real -- writes to books_read AND awards
//      real points via points_ledger, replacing the old cosmetic-only
//      localStorage tracking on the library page.
import { sql, requireDb } from '../lib/db.js';
import { getCurrentUser } from '../lib/auth.js';
import { record } from '../lib/activityLog.js';

export default async function handler(req, res) {
  if (!requireDb(res)) return;
  const user = getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Not logged in.' });

  if (req.method === 'GET') {
    const { rows } = await sql`SELECT * FROM books_read WHERE scholar_user_id = ${user.id} ORDER BY read_at DESC`;
    const totalPoints = rows.reduce((sum, r) => sum + r.points_awarded, 0);
    return res.status(200).json({ booksRead: rows, count: rows.length, totalPoints });
  }

  if (req.method === 'POST') {
    const { book_title, book_author, points_awarded } = req.body || {};
    if (!book_title || !Number.isInteger(points_awarded) || points_awarded <= 0) {
      return res.status(400).json({ error: 'book_title and a positive integer points_awarded are required.' });
    }
    try {
      const { rows } = await sql`
        INSERT INTO books_read (scholar_user_id, book_title, book_author, points_awarded)
        VALUES (${user.id}, ${book_title}, ${book_author || null}, ${points_awarded})
        RETURNING *
      `;
      await sql`
        INSERT INTO points_ledger (scholar_user_id, points, reason, strand)
        VALUES (${user.id}, ${points_awarded}, ${'Read: ' + book_title}, 'Library')
      `;
      await record(user.id, 'book_marked_read', 'books_read', { book_title, points_awarded });
      return res.status(201).json({ bookRead: rows[0] });
    } catch (err) {
      if (err.message && err.message.includes('duplicate')) {
        return res.status(409).json({ error: 'You already marked this book as read.' });
      }
      console.error('Library POST error:', err);
      return res.status(500).json({ error: 'Could not record this book.', detail: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
