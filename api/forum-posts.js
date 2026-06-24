// POST /api/forum-posts { forum_id, body, parent_post_id? }  -- anyone enrolled can post/reply
// Posting a top-level thread also notifies the forum's creator (typically
// the teacher), matching Moodle's forum subscription notifications in spirit
// without building a full subscription-preferences system.
import { sql, requireDb } from '../lib/db.js';
import { getCurrentUser, requireEnrollment } from '../lib/auth.js';
import { record } from '../lib/activityLog.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  if (!requireDb(res)) return;
  const user = getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Not logged in.' });

  const { forum_id, body, parent_post_id } = req.body || {};
  if (!forum_id || !body) return res.status(400).json({ error: 'forum_id and body are required.' });

  const { rows: forumLookup } = await sql`SELECT course_id FROM forums WHERE id = ${forum_id}`;
  if (forumLookup.length === 0) return res.status(404).json({ error: 'Forum not found.' });
  if (!(await requireEnrollment(req, res, forumLookup[0].course_id, sql))) return;

  try {
    const { rows } = await sql`
      INSERT INTO forum_posts (forum_id, parent_post_id, author_id, body)
      VALUES (${forum_id}, ${parent_post_id || null}, ${user.id}, ${body})
      RETURNING *
    `;

    if (!parent_post_id) {
      const { rows: forumRows } = await sql`SELECT created_by, title FROM forums WHERE id = ${forum_id}`;
      if (forumRows.length > 0 && forumRows[0].created_by !== user.id) {
        await sql`
          INSERT INTO notifications (user_id, type, message, link)
          VALUES (${forumRows[0].created_by}, 'forum_post', ${'New post in "' + forumRows[0].title + '"'}, ${'/api/forums?id=' + forum_id})
        `;
      }
    }

    await record(user.id, 'forum_post_created', 'forum_posts', { forum_id, post_id: rows[0].id });
    return res.status(201).json({ post: rows[0] });
  } catch (err) {
    console.error('Forum posts error:', err);
    return res.status(500).json({ error: 'Could not post.', detail: err.message });
  }
}
