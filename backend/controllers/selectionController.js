const db = require('../config/db');

exports.getAll = async (req, res) => {
  if (!req.user.club_id) return res.status(400).json({ message: 'Club context required' });
  try {
    const [rows] = await db.query(`
      SELECT s.*,
        (SELECT COUNT(*) FROM member_selections WHERE selection_id = s.id) as member_count,
        (SELECT COUNT(*) FROM coach_selections WHERE selection_id = s.id) as coach_count,
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
        (SELECT COUNT(*) FROM member_selections WHERE selection_id = s.id) as member_count,
        (SELECT COUNT(*) FROM coach_selections WHERE selection_id = s.id) as coach_count,
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

// Selections the current coach/member belongs to (primary + additional) -
// used by frontend dropdowns to let someone in >1 selection pick which one
// a new match/training/equipment item is for, or filter stats by one at a time.
exports.getMine = async (req, res) => {
  try {
    const ids = req.user.selection_ids || [];
    if (!ids.length) return res.json([]);
    const [rows] = await db.query(
      `SELECT id, name FROM selections WHERE id IN (?) AND club_id = ? ORDER BY name`,
      [ids, req.user.club_id]
    );
    res.json(rows);
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
    await conn.query('DELETE ms FROM member_selections ms JOIN members m ON m.id=ms.member_id WHERE ms.selection_id=? AND m.club_id=?', [req.params.id, req.user.club_id]);
    await conn.query('DELETE cs FROM coach_selections cs JOIN coaches c ON c.id=cs.coach_id WHERE cs.selection_id=? AND c.club_id=?', [req.params.id, req.user.club_id]);
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
      JOIN member_selections ms ON ms.member_id = m.id
      WHERE ms.selection_id = ? AND m.club_id = ?
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
      JOIN coach_selections cs ON cs.coach_id = c.id
      WHERE cs.selection_id = ? AND c.club_id = ?
      ORDER BY u.name
    `, [req.params.id, req.user.club_id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.assignMember = async (req, res) => {
  try {
    const [members] = await db.query('SELECT selection_id FROM members WHERE id=? AND club_id=?', [req.body.member_id, req.user.club_id]);
    if (!members.length) return res.status(404).json({ message: 'Član nije pronađen' });
    await db.query('INSERT IGNORE INTO member_selections (member_id, selection_id) VALUES (?, ?)', [req.body.member_id, req.params.id]);
    if (!members[0].selection_id) {
      await db.query('UPDATE members SET selection_id=? WHERE id=? AND club_id=?', [req.params.id, req.body.member_id, req.user.club_id]);
    }
    res.json({ message: 'Član dodat u selekciju' });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.removeMember = async (req, res) => {
  try {
    await db.query('DELETE ms FROM member_selections ms JOIN members m ON m.id=ms.member_id WHERE ms.member_id=? AND ms.selection_id=? AND m.club_id=?', [req.params.memberId, req.params.id, req.user.club_id]);
    const [members] = await db.query('SELECT selection_id FROM members WHERE id=? AND club_id=?', [req.params.memberId, req.user.club_id]);
    if (members.length && String(members[0].selection_id) === String(req.params.id)) {
      const [remaining] = await db.query('SELECT selection_id FROM member_selections WHERE member_id=? LIMIT 1', [req.params.memberId]);
      await db.query('UPDATE members SET selection_id=? WHERE id=? AND club_id=?', [remaining[0]?.selection_id ?? null, req.params.memberId, req.user.club_id]);
    }
    res.json({ message: 'Član uklonjen iz selekcije' });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.assignCoach = async (req, res) => {
  try {
    const [coaches] = await db.query('SELECT selection_id FROM coaches WHERE id=? AND club_id=?', [req.body.coach_id, req.user.club_id]);
    if (!coaches.length) return res.status(404).json({ message: 'Trener nije pronađen' });
    await db.query('INSERT IGNORE INTO coach_selections (coach_id, selection_id) VALUES (?, ?)', [req.body.coach_id, req.params.id]);
    if (!coaches[0].selection_id) {
      await db.query('UPDATE coaches SET selection_id=? WHERE id=? AND club_id=?', [req.params.id, req.body.coach_id, req.user.club_id]);
    }
    res.json({ message: 'Trener dodat u selekciju' });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.removeCoach = async (req, res) => {
  try {
    await db.query('DELETE cs FROM coach_selections cs JOIN coaches c ON c.id=cs.coach_id WHERE cs.coach_id=? AND cs.selection_id=? AND c.club_id=?', [req.params.coachId, req.params.id, req.user.club_id]);
    const [coaches] = await db.query('SELECT selection_id FROM coaches WHERE id=? AND club_id=?', [req.params.coachId, req.user.club_id]);
    if (coaches.length && String(coaches[0].selection_id) === String(req.params.id)) {
      const [remaining] = await db.query('SELECT selection_id FROM coach_selections WHERE coach_id=? LIMIT 1', [req.params.coachId]);
      await db.query('UPDATE coaches SET selection_id=? WHERE id=? AND club_id=?', [remaining[0]?.selection_id ?? null, req.params.coachId, req.user.club_id]);
    }
    res.json({ message: 'Trener uklonjen iz selekcije' });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};
