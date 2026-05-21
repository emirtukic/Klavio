const db = require('../config/db');

exports.getAll = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const [[{ count }]] = await db.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id=? AND is_read=FALSE',
      [req.user.id]
    );
    res.json({ count });
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.markRead = async (req, res) => {
  try {
    await db.query('UPDATE notifications SET is_read=TRUE WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    res.json({ message: 'Označeno kao pročitano' });
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.markAllRead = async (req, res) => {
  try {
    await db.query('UPDATE notifications SET is_read=TRUE WHERE user_id=?', [req.user.id]);
    res.json({ message: 'Sve označeno kao pročitano' });
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.remove = async (req, res) => {
  try {
    await db.query('DELETE FROM notifications WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    res.json({ message: 'Obrisano' });
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

// Internal helper - called from other controllers
exports.createNotification = async (userId, clubId, title, message, type = 'info', link = null) => {
  try {
    await db.query(
      'INSERT INTO notifications (user_id, club_id, title, message, type, link) VALUES (?,?,?,?,?,?)',
      [userId, clubId, title, message, type, link]
    );
  } catch (_) {}
};

// Notify all club members/users
exports.notifyClub = async (req, res) => {
  const { title, message, type, roles, link } = req.body;
  if (!title || !message) return res.status(400).json({ message: 'Naslov i poruka su obavezni' });
  try {
    let whereRole = '';
    const params = [req.user.club_id];
    if (roles && roles.length) {
      whereRole = ` AND role IN (${roles.map(() => '?').join(',')})`;
      params.push(...roles);
    }
    const [users] = await db.query(`SELECT id FROM users WHERE club_id=? AND is_active=TRUE${whereRole}`, params);
    for (const u of users) {
      await db.query('INSERT INTO notifications (user_id, club_id, title, message, type, link) VALUES (?,?,?,?,?,?)',
        [u.id, req.user.club_id, title, message, type || 'info', link || null]);
    }
    res.json({ message: `Obavijest poslana ${users.length} korisnika` });
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};
