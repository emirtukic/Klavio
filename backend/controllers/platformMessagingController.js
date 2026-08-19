const db = require('../config/db');

const WITH_REPLIES = `
  (SELECT COUNT(*) FROM platform_message_replies r WHERE r.message_id = pm.id) AS reply_count,
  (SELECT MAX(r.created_at) FROM platform_message_replies r WHERE r.message_id = pm.id) AS last_reply_at,
  (SELECT u2.role FROM platform_message_replies r JOIN users u2 ON u2.id = r.user_id
   WHERE r.message_id = pm.id ORDER BY r.created_at DESC LIMIT 1) AS last_reply_role`;

exports.getAll = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT pm.*, u.name AS sent_by_name, c.name AS club_name, ${WITH_REPLIES}
      FROM platform_messages pm
      JOIN users u ON u.id = pm.sent_by
      LEFT JOIN clubs c ON c.id = pm.club_id
      ORDER BY COALESCE(
        (SELECT MAX(r.created_at) FROM platform_message_replies r WHERE r.message_id = pm.id),
        pm.created_at
      ) DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.getMine = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT pm.*, u.name AS sent_by_name, ${WITH_REPLIES}
      FROM platform_messages pm
      JOIN users u ON u.id = pm.sent_by
      WHERE pm.club_id = ? OR pm.type = 'broadcast'
      ORDER BY COALESCE(
        (SELECT MAX(r.created_at) FROM platform_message_replies r WHERE r.message_id = pm.id),
        pm.created_at
      ) DESC
    `, [req.user.club_id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.getReplies = async (req, res) => {
  try {
    const [msg] = await db.query(`
      SELECT pm.*, u.name AS sent_by_name, c.name AS club_name
      FROM platform_messages pm
      JOIN users u ON u.id = pm.sent_by
      LEFT JOIN clubs c ON c.id = pm.club_id
      WHERE pm.id = ?
    `, [req.params.id]);
    if (!msg.length) return res.status(404).json({ message: 'Poruka nije pronađena' });
    const [replies] = await db.query(`
      SELECT r.*, u.name AS user_name, u.role AS user_role
      FROM platform_message_replies r
      JOIN users u ON u.id = r.user_id
      WHERE r.message_id = ? ORDER BY r.created_at ASC
    `, [req.params.id]);
    res.json({ message: msg[0], replies });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.addReply = async (req, res) => {
  const { body } = req.body;
  if (!body || !body.trim()) return res.status(400).json({ message: 'Unesite poruku' });
  const isStaff = req.user.role === 'super_admin';
  try {
    await db.query(
      'INSERT INTO platform_message_replies (message_id, user_id, body) VALUES (?,?,?)',
      [req.params.id, req.user.id, body.trim()]
    );
    const [msg] = await db.query('SELECT club_id, subject FROM platform_messages WHERE id=?', [req.params.id]);
    if (msg.length) {
      if (isStaff && msg[0].club_id) {
        // Notify admin(s) of this club
        const [admins] = await db.query("SELECT id FROM users WHERE role='admin' AND club_id=?", [msg[0].club_id]);
        for (const admin of admins) {
          await db.query(
            'INSERT INTO notifications (user_id, club_id, title, message, type) VALUES (?,?,?,?,?)',
            [admin.id, msg[0].club_id, `💬 Odgovor: ${msg[0].subject}`, body.trim().slice(0, 200), 'info']
          );
        }
      }
    }
    res.json({ message: 'Odgovor poslan' });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.send = async (req, res) => {
  const { type, subject, body, club_id } = req.body;
  try {
    const [result] = await db.query(
      'INSERT INTO platform_messages (type, subject, body, club_id, sent_by) VALUES (?,?,?,?,?)',
      [type, subject, body, club_id || null, req.user.id]
    );
    if (type === 'broadcast') {
      const [admins] = await db.query("SELECT id, club_id FROM users WHERE role='admin'");
      for (const admin of admins) {
        await db.query(
          'INSERT INTO notifications (user_id, club_id, title, message, type) VALUES (?,?,?,?,?)',
          [admin.id, admin.club_id, `📢 ${subject}`, body, 'info']
        );
      }
    } else if (club_id) {
      const [admins] = await db.query("SELECT id FROM users WHERE role='admin' AND club_id=?", [club_id]);
      for (const admin of admins) {
        await db.query(
          'INSERT INTO notifications (user_id, club_id, title, message, type) VALUES (?,?,?,?,?)',
          [admin.id, club_id, `💬 ${subject}`, body, 'info']
        );
      }
    }
    res.json({ message: 'Poruka poslana', id: result.insertId });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.remove = async (req, res) => {
  try {
    await db.query('DELETE FROM platform_messages WHERE id=?', [req.params.id]);
    res.json({ message: 'Obrisano' });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};
