const db = require('../config/db');

exports.search = async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) return res.json({ members: [], matches: [], coaches: [], announcements: [] });

  const term = `%${q.trim()}%`;
  const clubId = req.user.club_id;

  try {
    const [members] = await db.query(
      `SELECT m.id, u.name, m.position, m.status, s.name AS selection_name
       FROM members m
       JOIN users u ON u.id = m.user_id
       LEFT JOIN selections s ON s.id = m.selection_id
       WHERE m.club_id = ? AND u.name LIKE ?
       LIMIT 8`,
      [clubId, term]
    );

    const [matches] = await db.query(
      `SELECT m.id, m.opponent, m.match_date, m.result, m.goals_for, m.goals_against, s.name AS selection_name
       FROM matches m LEFT JOIN selections s ON s.id = m.selection_id
       WHERE m.club_id = ? AND m.opponent LIKE ?
       ORDER BY m.match_date DESC LIMIT 6`,
      [clubId, term]
    );

    const [coaches] = await db.query(
      `SELECT c.id, u.name, u.email FROM coaches c
       JOIN users u ON c.user_id = u.id
       WHERE c.club_id = ? AND (u.name LIKE ? OR u.email LIKE ?) LIMIT 5`,
      [clubId, term, term]
    );

    const [announcements] = await db.query(
      `SELECT id, title, created_at FROM announcements WHERE club_id = ? AND title LIKE ? ORDER BY created_at DESC LIMIT 5`,
      [clubId, term]
    );


    res.json({ members, matches, coaches, announcements });
  } catch (err) {
    console.error('[search]', err.message);
    res.status(500).json({ message: err.message });
  }
};
