const db = require('../config/db');

exports.getAll = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT sn.*, u.name AS created_by_name
      FROM system_notifications sn
      JOIN users u ON u.id = sn.created_by
      ORDER BY sn.created_at DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.getActive = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM system_notifications WHERE is_active=1 ORDER BY created_at DESC LIMIT 5'
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.create = async (req, res) => {
  const { type, title, body } = req.body;
  const TYPE_ICON = { maintenance:'🔧', feature:'✨', pricing:'💰', general:'📢' };
  try {
    const [result] = await db.query(
      'INSERT INTO system_notifications (type, title, body, created_by) VALUES (?,?,?,?)',
      [type || 'general', title, body, req.user.id]
    );
    const icon = TYPE_ICON[type] || '📢';
    const [admins] = await db.query("SELECT id, club_id FROM users WHERE role='admin'");
    for (const admin of admins) {
      await db.query(
        'INSERT INTO notifications (user_id, club_id, title, message, type) VALUES (?,?,?,?,?)',
        [admin.id, admin.club_id, `${icon} ${title}`, body, 'info']
      );
    }
    res.status(201).json({ id: result.insertId });
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.toggle = async (req, res) => {
  try {
    await db.query('UPDATE system_notifications SET is_active = NOT is_active WHERE id=?', [req.params.id]);
    res.json({ message: 'Ažurirano' });
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.remove = async (req, res) => {
  try {
    await db.query('DELETE FROM system_notifications WHERE id=?', [req.params.id]);
    res.json({ message: 'Obrisano' });
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};
