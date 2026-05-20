const db = require('../config/db');

exports.getAll = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT pd.*, u.name as member_name, uc.name as coach_name, m.position, m.jersey_number
      FROM player_development pd
      JOIN members m ON pd.member_id = m.id
      JOIN users u ON m.user_id = u.id
      JOIN coaches c ON pd.coach_id = c.id
      JOIN users uc ON c.user_id = uc.id
      WHERE pd.club_id = ? ORDER BY pd.updated_at DESC
    `, [req.user.club_id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.getOne = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT pd.*, u.name as member_name FROM player_development pd JOIN members m ON pd.member_id=m.id JOIN users u ON m.user_id=u.id WHERE pd.member_id=? AND pd.club_id=? ORDER BY pd.created_at DESC',
      [req.params.memberId, req.user.club_id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.upsert = async (req, res) => {
  const { member_id, season, goals, strengths, improvements, notes, rating } = req.body;
  if (!member_id || !season) return res.status(400).json({ message: 'Član i sezona su obavezni' });
  try {
    const [[coach]] = await db.query('SELECT id FROM coaches WHERE user_id=?', [req.user.id]);
    if (!coach) return res.status(403).json({ message: 'Samo treneri mogu kreirati planove' });
    await db.query(`
      INSERT INTO player_development (member_id, coach_id, club_id, season, goals, strengths, improvements, notes, rating)
      VALUES (?,?,?,?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE goals=VALUES(goals), strengths=VALUES(strengths), improvements=VALUES(improvements), notes=VALUES(notes), rating=VALUES(rating), coach_id=VALUES(coach_id)
    `, [member_id, coach.id, req.user.club_id, season, goals||null, strengths||null, improvements||null, notes||null, rating||null]);
    res.json({ message: 'Plan ažuriran' });
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.remove = async (req, res) => {
  try {
    await db.query('DELETE FROM player_development WHERE id=? AND club_id=?', [req.params.id, req.user.club_id]);
    res.json({ message: 'Plan obrisan' });
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};
