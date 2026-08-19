const db = require('../config/db');

exports.getAll = async (req, res) => {
  if (!req.user.club_id) return res.status(400).json({ message: 'Club context required' });
  try {
    const [rows] = await db.query(`
      SELECT s.*,
        (SELECT COUNT(*) FROM members WHERE selection_id = s.id) as member_count,
        (SELECT COUNT(*) FROM coaches WHERE selection_id = s.id) as coach_count,
        (SELECT COUNT(*) FROM training_sessions WHERE selection_id = s.id) as training_count,
        (SELECT COUNT(*) FROM matches WHERE selection_id = s.id) as match_count,
        (SELECT COUNT(*) FROM matches WHERE selection_id = s.id AND result = 'win') as win_count
      FROM selections s
      WHERE s.club_id = ?
      ORDER BY s.name
    `, [req.user.club_id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.getOne = async (req, res) => {
  if (!req.user.club_id) return res.status(400).json({ message: 'Club context required' });
  try {
    const [[sel]] = await db.query(`
      SELECT s.*,
        (SELECT COUNT(*) FROM members WHERE selection_id = s.id) as member_count,
        (SELECT COUNT(*) FROM coaches WHERE selection_id = s.id) as coach_count,
        (SELECT COUNT(*) FROM training_sessions WHERE selection_id = s.id) as training_count,
        (SELECT COUNT(*) FROM matches WHERE selection_id = s.id) as match_count,
        (SELECT COUNT(*) FROM matches WHERE selection_id = s.id AND result = 'win') as win_count,
        (SELECT COUNT(*) FROM matches WHERE selection_id = s.id AND result = 'draw') as draw_count,
        (SELECT COUNT(*) FROM matches WHERE selection_id = s.id AND result = 'loss') as loss_count
      FROM selections s
      WHERE s.id = ? AND s.club_id = ?
    `, [req.params.id, req.user.club_id]);
    if (!sel) return res.status(404).json({ message: 'Selekcija nije pronađena' });
    res.json(sel);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.create = async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ message: 'Naziv selekcije je obavezan' });
  try {
    const [result] = await db.query(
      'INSERT INTO selections (club_id, name, description) VALUES (?, ?, ?)',
      [req.user.club_id, name, description || null]
    );
    res.status(201).json({ id: result.insertId, name, description: description || null, member_count: 0, coach_count: 0 });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.update = async (req, res) => {
  const { name, description } = req.body;
  try {
    await db.query(
      'UPDATE selections SET name=COALESCE(?,name), description=COALESCE(?,description) WHERE id=? AND club_id=?',
      [name || null, description !== undefined ? description : null, req.params.id, req.user.club_id]
    );
    res.json({ message: 'Selekcija ažurirana' });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.remove = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('UPDATE members SET selection_id=NULL WHERE selection_id=? AND club_id=?', [req.params.id, req.user.club_id]);
    await conn.query('UPDATE coaches SET selection_id=NULL WHERE selection_id=? AND club_id=?', [req.params.id, req.user.club_id]);
    await conn.query('UPDATE training_sessions SET selection_id=NULL WHERE selection_id=? AND club_id=?', [req.params.id, req.user.club_id]);
    await conn.query('UPDATE matches SET selection_id=NULL WHERE selection_id=? AND club_id=?', [req.params.id, req.user.club_id]);
    await conn.query('DELETE FROM selections WHERE id=? AND club_id=?', [req.params.id, req.user.club_id]);
    await conn.commit();
    res.json({ message: 'Selekcija obrisana' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: 'Server error' });
  } finally { conn.release(); }
};

exports.getMembers = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT m.id, m.membership_number, m.status, u.name, u.email
      FROM members m JOIN users u ON m.user_id = u.id
      WHERE m.selection_id = ? AND m.club_id = ?
      ORDER BY u.name
    `, [req.params.id, req.user.club_id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.getCoaches = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT c.id, c.specialization, c.phone, u.name, u.email
      FROM coaches c JOIN users u ON c.user_id = u.id
      WHERE c.selection_id = ? AND c.club_id = ?
      ORDER BY u.name
    `, [req.params.id, req.user.club_id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.assignMember = async (req, res) => {
  try {
    await db.query('UPDATE members SET selection_id=? WHERE id=? AND club_id=?', [req.params.id, req.body.member_id, req.user.club_id]);
    res.json({ message: 'Član dodat u selekciju' });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.removeMember = async (req, res) => {
  try {
    await db.query('UPDATE members SET selection_id=NULL WHERE id=? AND club_id=?', [req.params.memberId, req.user.club_id]);
    res.json({ message: 'Član uklonjen iz selekcije' });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.assignCoach = async (req, res) => {
  try {
    await db.query('UPDATE coaches SET selection_id=? WHERE id=? AND club_id=?', [req.params.id, req.body.coach_id, req.user.club_id]);
    res.json({ message: 'Trener dodat u selekciju' });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.removeCoach = async (req, res) => {
  try {
    await db.query('UPDATE coaches SET selection_id=NULL WHERE id=? AND club_id=?', [req.params.coachId, req.user.club_id]);
    res.json({ message: 'Trener uklonjen iz selekcije' });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};
