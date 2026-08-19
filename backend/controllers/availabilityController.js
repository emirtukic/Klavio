const db = require('../config/db');

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
    const [[member]] = await db.query('SELECT id FROM members WHERE user_id=?', [req.user.id]);
    if (!member) return res.status(404).json({ message: 'Niste član kluba' });
    await db.query(`
      INSERT INTO member_availability (member_id, event_type, event_id, status, note)
      VALUES (?,?,?,?,?)
      ON DUPLICATE KEY UPDATE status=VALUES(status), note=VALUES(note)
    `, [member.id, event_type, event_id, status, note||null]);
    res.json({ message: 'Dostupnost ažurirana' });
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
