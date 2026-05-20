const db = require('../config/db');

exports.getLineup = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT ml.*, u.name, m.jersey_number as default_jersey, m.position as default_position, m.status
      FROM match_lineup ml
      JOIN members m ON ml.member_id = m.id
      JOIN users u ON m.user_id = u.id
      WHERE ml.match_id = ? AND ml.club_id = ?
      ORDER BY ml.is_starter DESC, ml.position
    `, [req.params.matchId, req.user.club_id]);
    const [[matchRow]] = await db.query(
      'SELECT formation FROM matches WHERE id = ? AND club_id = ?',
      [req.params.matchId, req.user.club_id]
    );
    res.json({ players: rows, formation: matchRow?.formation || null });
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.saveLineup = async (req, res) => {
  const { players, formation } = req.body;
  const match_id = req.params.matchId;
  if (!Array.isArray(players)) return res.status(400).json({ message: 'players mora biti niz' });
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM match_lineup WHERE match_id=? AND club_id=?', [match_id, req.user.club_id]);
    for (const p of players) {
      await conn.query(
        'INSERT INTO match_lineup (match_id, member_id, club_id, position, is_starter, jersey_number) VALUES (?,?,?,?,?,?)',
        [match_id, p.member_id, req.user.club_id, p.position||null, p.is_starter??true, p.jersey_number||null]
      );
    }
    if (formation) {
      await conn.query('UPDATE matches SET formation=? WHERE id=? AND club_id=?',
        [formation, match_id, req.user.club_id]);
    }
    await conn.commit();
    res.json({ message: 'Postava sačuvana' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally { conn.release(); }
};

exports.removePlayer = async (req, res) => {
  try {
    await db.query('DELETE FROM match_lineup WHERE match_id=? AND member_id=? AND club_id=?',
      [req.params.matchId, req.params.memberId, req.user.club_id]);
    res.json({ message: 'Igrač uklonjen iz postave' });
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};
