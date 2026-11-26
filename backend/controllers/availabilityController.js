const db = require('../config/db');
const { notifyRsvpDecline } = require('../services/matchNotificationService');

exports.getForEvent = async (req, res) => {
  const { event_type, event_id } = req.params;
  try {
    const [rows] = await db.query(`
      SELECT ma.*, u.name
      FROM member_availability ma
      JOIN members m ON ma.member_id = m.id
      JOIN users u ON m.user_id = u.id
      WHERE ma.event_type=? AND ma.event_id=? AND m.club_id=?
      ORDER BY ma.status, u.name
    `, [event_type, event_id, req.user.club_id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.setAvailability = async (req, res) => {
  const { event_type, event_id } = req.params;
  const { status, note } = req.body;
  try {
    // Find the member record for the current user
    const [[member]] = await db.query(
      'SELECT m.id, m.club_id, u.name FROM members m JOIN users u ON m.user_id=u.id WHERE m.user_id=?',
      [req.user.id]
    );
    if (!member) return res.status(404).json({ message: 'Niste član kluba' });
    if (event_type === 'training') {
      const [[session]] = await db.query('SELECT rsvp_locked FROM training_sessions WHERE id=? AND club_id=?', [event_id, member.club_id]);
      if (session && session.rsvp_locked) return res.status(403).json({ message: 'RSVP je zaključan za ovaj trening.' });
    }
    await db.query(`
      INSERT INTO member_availability (member_id, event_type, event_id, status, note)
      VALUES (?,?,?,?,?)
      ON DUPLICATE KEY UPDATE status=VALUES(status), note=VALUES(note)
    `, [member.id, event_type, event_id, status, note||null]);
    res.json({ message: 'Dostupnost ažurirana' });

    // Decline + reason -> let the coach(es)/admin know, instead of leaving
    // them to stumble onto it by opening the RSVP list themselves.
    // event_type is validated against this exact allowlist before it's ever
    // used to pick a table name below - never interpolate it unchecked.
    const EVENT_TABLES = { training: 'training_sessions', match: 'matches', tournament: 'tournaments' };
    if (status === 'no' && note && EVENT_TABLES[event_type]) {
      (async () => {
        const table = EVENT_TABLES[event_type];
        const [[event]] = await db.query(`SELECT * FROM ${table} WHERE id=? AND club_id=?`, [event_id, member.club_id]);
        if (event) await notifyRsvpDecline(event_type, event, member.name, note);
      })().catch(() => {});
    }
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.getMyAvailability = async (req, res) => {
  try {
    const [[member]] = await db.query('SELECT id FROM members WHERE user_id=?', [req.user.id]);
    if (!member) return res.json([]);
    const [rows] = await db.query('SELECT * FROM member_availability WHERE member_id=? ORDER BY updated_at DESC', [member.id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};
