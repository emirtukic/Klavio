const db = require('../config/db');

exports.getAll = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT a.*, uc.name as coach_name, um.name as member_name
      FROM appointments a
      JOIN coaches c ON a.coach_id = c.id JOIN users uc ON c.user_id = uc.id
      JOIN members m ON a.member_id = m.id JOIN users um ON m.user_id = um.id
      WHERE c.club_id = ?
      ORDER BY a.appointment_date DESC, a.start_time
    `, [req.user.club_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getMyAppointments = async (req, res) => {
  try {
    let query, params;
    if (req.user.role === 'coach') {
      const [coaches] = await db.query('SELECT id FROM coaches WHERE user_id = ? AND club_id = ?', [req.user.id, req.user.club_id]);
      if (!coaches.length) return res.json([]);
      query = `SELECT a.*, um.name as member_name FROM appointments a
        JOIN members m ON a.member_id = m.id JOIN users um ON m.user_id = um.id
        WHERE a.coach_id = ? ORDER BY a.appointment_date, a.start_time`;
      params = [coaches[0].id];
    } else {
      const [members] = await db.query('SELECT id FROM members WHERE user_id = ? AND club_id = ?', [req.user.id, req.user.club_id]);
      if (!members.length) return res.json([]);
      query = `SELECT a.*, uc.name as coach_name FROM appointments a
        JOIN coaches c ON a.coach_id = c.id JOIN users uc ON c.user_id = uc.id
        WHERE a.member_id = ? ORDER BY a.appointment_date, a.start_time`;
      params = [members[0].id];
    }
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.create = async (req, res) => {
  const { coach_id, title, appointment_date, start_time, end_time, notes } = req.body;
  try {
    let memberId;
    if (req.user.role === 'member') {
      const [members] = await db.query('SELECT id FROM members WHERE user_id = ? AND club_id = ?', [req.user.id, req.user.club_id]);
      if (!members.length) return res.status(403).json({ message: 'Profil člana nije pronađen' });
      memberId = members[0].id;
    } else {
      memberId = req.body.member_id;
    }
    const [result] = await db.query(
      'INSERT INTO appointments (coach_id, member_id, title, appointment_date, start_time, end_time, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [coach_id, memberId, title, appointment_date, start_time, end_time, notes]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

async function loadOwnedAppointment(req, res) {
  const [[appt]] = await db.query(
    `SELECT a.*, c.club_id AS coach_club_id, m.club_id AS member_club_id
     FROM appointments a
     LEFT JOIN coaches c ON a.coach_id = c.id
     LEFT JOIN members m ON a.member_id = m.id
     WHERE a.id = ?`,
    [req.params.id]
  );
  const clubId = appt && (appt.coach_club_id ?? appt.member_club_id);
  if (!appt || clubId !== req.user.club_id) { res.status(404).json({ message: 'Termin nije pronađen' }); return null; }
  if (req.user.role === 'member') {
    const [[m]] = await db.query('SELECT id FROM members WHERE user_id=? AND club_id=?', [req.user.id, req.user.club_id]);
    if (!m || m.id !== appt.member_id) { res.status(403).json({ message: 'Nedozvoljen pristup' }); return null; }
  } else if (req.user.role === 'coach') {
    const [[c]] = await db.query('SELECT id FROM coaches WHERE user_id=? AND club_id=?', [req.user.id, req.user.club_id]);
    if (!c || c.id !== appt.coach_id) { res.status(403).json({ message: 'Nedozvoljen pristup' }); return null; }
  }
  return appt;
}

exports.update = async (req, res) => {
  const { status, title, appointment_date, start_time, end_time, notes } = req.body;
  try {
    const appt = await loadOwnedAppointment(req, res);
    if (!appt) return;
    await db.query(
      'UPDATE appointments SET status=COALESCE(?,status), title=COALESCE(?,title), appointment_date=COALESCE(?,appointment_date), start_time=COALESCE(?,start_time), end_time=COALESCE(?,end_time), notes=COALESCE(?,notes) WHERE id=?',
      [status, title, appointment_date, start_time, end_time, notes, req.params.id]
    );
    res.json({ message: 'Termin ažuriran' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.remove = async (req, res) => {
  try {
    const appt = await loadOwnedAppointment(req, res);
    if (!appt) return;
    await db.query('DELETE FROM appointments WHERE id = ?', [req.params.id]);
    res.json({ message: 'Termin obrisan' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
