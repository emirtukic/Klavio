const db = require('../config/db');
const { notifyTrainingCreated } = require('../services/matchNotificationService');

function selScope(req) {
  if (req.user.role === 'coach' || req.user.role === 'member') {
    const ids = req.user.selection_ids || [];
    // Sessions tied to no selection (whole-club) stay visible to everyone;
    // sessions tied to a selection are only visible to its own members/coaches.
    return ids.length ? { clause: ' AND (ts.selection_id IN (?) OR ts.selection_id IS NULL)', param: ids } : { clause: '', param: null };
  }
  const selId = req.query.selection_id || null;
  return selId ? { clause: ' AND ts.selection_id = ?', param: selId } : { clause: '', param: null };
}

exports.getAll = async (req, res) => {
  try {
    const sel = selScope(req);
    const params = [req.user.club_id];
    if (sel.param) params.push(sel.param);
    const [rows] = await db.query(`
      SELECT ts.*, u.name as coach_name, s.name as selection_name, COUNT(ta.id) as registered_count,
        (SELECT COUNT(*) FROM member_availability ma WHERE ma.event_type='training' AND ma.event_id=ts.id AND ma.status='yes') as rsvp_yes_count
      FROM training_sessions ts
      JOIN coaches c ON ts.coach_id = c.id
      JOIN users u ON c.user_id = u.id
      LEFT JOIN selections s ON ts.selection_id = s.id
      LEFT JOIN training_attendance ta ON ts.id = ta.session_id
      WHERE ts.club_id = ?${sel.clause}
      GROUP BY ts.id
      ORDER BY ts.session_date DESC, ts.start_time
    `, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getOne = async (req, res) => {
  try {
    const [sessions] = await db.query(`
      SELECT ts.*, u.name as coach_name
      FROM training_sessions ts
      JOIN coaches c ON ts.coach_id = c.id
      JOIN users u ON c.user_id = u.id
      WHERE ts.id = ? AND ts.club_id = ?
    `, [req.params.id, req.user.club_id]);
    if (!sessions.length) return res.status(404).json({ message: 'Trening nije pronađen' });

    const [attendance] = await db.query(`
      SELECT ta.*, u.name as member_name
      FROM training_attendance ta
      JOIN members m ON ta.member_id = m.id
      JOIN users u ON m.user_id = u.id
      WHERE ta.session_id = ?
    `, [req.params.id]);
    res.json({ ...sessions[0], attendance });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.create = async (req, res) => {
  const { title, description, location, session_date, start_time, end_time, max_participants, coach_id, selection_id, member_note } = req.body;
  const club_id = req.user.club_id;
  try {
    let coachId = coach_id;
    let selId = req.user.selection_id || selection_id || null;
    if (req.user.role === 'coach') {
      const [coaches] = await db.query('SELECT id, selection_id FROM coaches WHERE user_id = ? AND club_id = ?', [req.user.id, club_id]);
      if (!coaches.length) return res.status(403).json({ message: 'Profil trenera nije pronađen' });
      coachId = coaches[0].id;
      // Let a coach in more than one selection pick which one this session is
      // for; default to their primary selection.
      const ids = req.user.selection_ids || [];
      selId = (selection_id && ids.includes(Number(selection_id))) ? Number(selection_id) : coaches[0].selection_id;
    }
    const [result] = await db.query(
      'INSERT INTO training_sessions (coach_id, title, description, member_note, location, session_date, start_time, end_time, max_participants, club_id, selection_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [coachId, title, description, member_note || null, location, session_date, start_time, end_time, max_participants || 20, club_id, selId]
    );
    notifyTrainingCreated(
      { title, description, location, session_date, start_time, end_time },
      club_id, selId, req.user.id
    ).catch(() => {});
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.update = async (req, res) => {
  const { title, description, member_note, location, session_date, start_time, end_time, max_participants, status, rsvp_locked, attendance_locked } = req.body;
  const params = [title, description, member_note, location, session_date, start_time, end_time, max_participants, status, rsvp_locked, attendance_locked, req.params.id, req.user.club_id];
  const sql = 'UPDATE training_sessions SET title=COALESCE(?,title), description=COALESCE(?,description), member_note=COALESCE(?,member_note), location=COALESCE(?,location), session_date=COALESCE(?,session_date), start_time=COALESCE(?,start_time), end_time=COALESCE(?,end_time), max_participants=COALESCE(?,max_participants), status=COALESCE(?,status), rsvp_locked=COALESCE(?,rsvp_locked), attendance_locked=COALESCE(?,attendance_locked) WHERE id=? AND club_id=?';
  try {
    // A coach can only edit their own sessions, not every team's.
    if (req.user.role === 'coach') {
      const [coaches] = await db.query('SELECT id FROM coaches WHERE user_id = ? AND club_id = ?', [req.user.id, req.user.club_id]);
      const coachId = coaches[0]?.id;
      const [result] = await db.query(sql + ' AND coach_id=?', [...params, coachId]);
      if (!result.affectedRows) return res.status(404).json({ message: 'Trening nije pronađen' });
    } else {
      await db.query(sql, params);
    }
    res.json({ message: 'Trening ažuriran' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.remove = async (req, res) => {
  try {
    // A coach can only delete their own sessions, not every team's.
    if (req.user.role === 'coach') {
      const [coaches] = await db.query('SELECT id FROM coaches WHERE user_id = ? AND club_id = ?', [req.user.id, req.user.club_id]);
      const coachId = coaches[0]?.id;
      const [result] = await db.query('DELETE FROM training_sessions WHERE id = ? AND club_id = ? AND coach_id = ?', [req.params.id, req.user.club_id, coachId]);
      if (!result.affectedRows) return res.status(404).json({ message: 'Trening nije pronađen' });
    } else {
      await db.query('DELETE FROM training_sessions WHERE id = ? AND club_id = ?', [req.params.id, req.user.club_id]);
    }
    res.json({ message: 'Trening obrisan' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.markAttendance = async (req, res) => {
  const { member_id, status } = req.body;
  try {
    const [[session]] = await db.query('SELECT attendance_locked FROM training_sessions WHERE id=? AND club_id=?', [req.params.id, req.user.club_id]);
    if (!session) return res.status(404).json({ message: 'Trening nije pronađen' });
    if (session.attendance_locked) return res.status(403).json({ message: 'Prisustvo je zaključano za ovaj trening.' });
    await db.query(
      'INSERT INTO training_attendance (session_id, member_id, status) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE status=?',
      [req.params.id, member_id, status, status]
    );
    res.json({ message: 'Prisustvo zabilježeno' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getMySchedule = async (req, res) => {
  const club_id = req.user.club_id;
  try {
    let query, params;
    if (req.user.role === 'coach') {
      const [coaches] = await db.query('SELECT id FROM coaches WHERE user_id = ? AND club_id = ?', [req.user.id, club_id]);
      if (!coaches.length) return res.json([]);
      query = `SELECT ts.*, u.name as coach_name, s.name as selection_name, COUNT(ta.id) as registered_count,
          (SELECT COUNT(*) FROM member_availability ma WHERE ma.event_type='training' AND ma.event_id=ts.id AND ma.status='yes') as rsvp_yes_count
        FROM training_sessions ts
        JOIN coaches c ON ts.coach_id = c.id JOIN users u ON c.user_id = u.id
        LEFT JOIN selections s ON ts.selection_id = s.id
        LEFT JOIN training_attendance ta ON ts.id = ta.session_id
        WHERE ts.coach_id = ? AND ts.club_id = ? GROUP BY ts.id ORDER BY ts.session_date, ts.start_time`;
      params = [coaches[0].id, club_id];
    } else {
      // Member: only trainings for the selection(s) they belong to (or
      // whole-club sessions with no selection), not every team's training.
      const sel = selScope(req);
      query = `SELECT ts.*, u.name as coach_name, s.name as selection_name FROM training_sessions ts
        JOIN coaches c ON ts.coach_id = c.id JOIN users u ON c.user_id = u.id
        LEFT JOIN selections s ON ts.selection_id = s.id
        WHERE ts.status='scheduled' AND ts.club_id = ?${sel.clause} ORDER BY ts.session_date, ts.start_time`;
      params = sel.param ? [club_id, sel.param] : [club_id];
    }
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
