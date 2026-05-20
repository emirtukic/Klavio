const db = require('../config/db');

exports.getAll = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT st.*, c.name AS club_name, u.name AS created_by_name,
        (SELECT COUNT(*) FROM support_ticket_replies r WHERE r.ticket_id = st.id) AS reply_count,
        (SELECT MAX(r.created_at) FROM support_ticket_replies r WHERE r.ticket_id = st.id) AS last_reply_at
      FROM support_tickets st
      JOIN clubs c ON c.id = st.club_id
      JOIN users u ON u.id = st.created_by
      ORDER BY st.updated_at DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.getMine = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT st.*,
        (SELECT COUNT(*) FROM support_ticket_replies r WHERE r.ticket_id = st.id) AS reply_count,
        (SELECT MAX(r.created_at) FROM support_ticket_replies r WHERE r.ticket_id = st.id) AS last_reply_at
      FROM support_tickets st
      WHERE st.club_id = ?
      ORDER BY st.updated_at DESC
    `, [req.user.club_id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.create = async (req, res) => {
  const { subject, body, priority } = req.body;
  try {
    const [result] = await db.query(
      'INSERT INTO support_tickets (club_id, created_by, subject, priority) VALUES (?,?,?,?)',
      [req.user.club_id, req.user.id, subject, priority || 'medium']
    );
    if (body) {
      await db.query(
        'INSERT INTO support_ticket_replies (ticket_id, user_id, body, is_staff) VALUES (?,?,?,0)',
        [result.insertId, req.user.id, body]
      );
    }
    res.status(201).json({ id: result.insertId });
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.getReplies = async (req, res) => {
  try {
    const [ticket] = await db.query('SELECT * FROM support_tickets WHERE id=?', [req.params.id]);
    if (!ticket.length) return res.status(404).json({ message: 'Ticket nije pronađen' });
    const [replies] = await db.query(`
      SELECT r.*, u.name AS user_name FROM support_ticket_replies r
      JOIN users u ON u.id = r.user_id
      WHERE r.ticket_id = ? ORDER BY r.created_at ASC
    `, [req.params.id]);
    res.json({ ticket: ticket[0], replies });
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.reply = async (req, res) => {
  const { body } = req.body;
  const isStaff = req.user.role === 'super_admin';
  try {
    await db.query(
      'INSERT INTO support_ticket_replies (ticket_id, user_id, body, is_staff) VALUES (?,?,?,?)',
      [req.params.id, req.user.id, body, isStaff ? 1 : 0]
    );
    const newStatus = isStaff ? 'in_progress' : 'open';
    await db.query(
      "UPDATE support_tickets SET status=?, updated_at=NOW() WHERE id=? AND status NOT IN ('resolved','closed')",
      [newStatus, req.params.id]
    );
    // Notify admin when staff replies
    if (isStaff) {
      const [ticket] = await db.query('SELECT club_id, subject, created_by FROM support_tickets WHERE id=?', [req.params.id]);
      if (ticket.length) {
        await db.query(
          'INSERT INTO notifications (user_id, club_id, title, message, type) VALUES (?,?,?,?,?)',
          [ticket[0].created_by, ticket[0].club_id, `💬 Odgovor na tiket: ${ticket[0].subject}`, body.slice(0, 200), 'info']
        );
      }
    }
    res.json({ message: 'Odgovor poslan' });
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.updateStatus = async (req, res) => {
  const { status } = req.body;
  try {
    await db.query('UPDATE support_tickets SET status=?, updated_at=NOW() WHERE id=?', [status, req.params.id]);
    res.json({ message: 'Status ažuriran' });
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};
