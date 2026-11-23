const db = require('../config/db');
const { assertClubOwned } = require('../utils/clubScope');
const { send: sendMail } = require('../config/mailer');
const { newTicketNotificationHtml, ticketReplyEmailHtml } = require('../config/emailTemplates');

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
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
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
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
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

    // Notify Klavio team by email (non-blocking)
    const [clubRows] = await db.query('SELECT name FROM clubs WHERE id = ?', [req.user.club_id]);
    const clubName = clubRows[0]?.name || 'Klub';
    sendMail({
      to: process.env.MAIL_USER || 'info@klavioclub.com',
      subject: `Novi support tiket: ${subject}`,
      text: `Novi tiket od ${req.user.name} (${clubName}): ${subject}\n\n${body || ''}`,
      html: newTicketNotificationHtml(clubName, req.user.name, subject, body),
    }).catch(err => console.error('New ticket notification mail error:', err.message));

    res.status(201).json({ id: result.insertId });
  } catch (err) { console.error('Support ticket create error:', err.message); res.status(500).json({ message: 'Server error' }); }
};

exports.getReplies = async (req, res) => {
  try {
    const isStaff = req.user.role === 'super_admin';
    const [ticket] = isStaff
      ? await db.query('SELECT * FROM support_tickets WHERE id=?', [req.params.id])
      : await db.query('SELECT * FROM support_tickets WHERE id=? AND club_id=?', [req.params.id, req.user.club_id]);
    if (!ticket.length) return res.status(404).json({ message: 'Ticket nije pronađen' });
    const [replies] = await db.query(`
      SELECT r.*, u.name AS user_name FROM support_ticket_replies r
      JOIN users u ON u.id = r.user_id
      WHERE r.ticket_id = ? ORDER BY r.created_at ASC
    `, [req.params.id]);
    res.json({ ticket: ticket[0], replies });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.reply = async (req, res) => {
  const { body } = req.body;
  const isStaff = req.user.role === 'super_admin';
  try {
    const exists = isStaff
      ? (await db.query('SELECT id FROM support_tickets WHERE id=?', [req.params.id]))[0].length > 0
      : await assertClubOwned('support_tickets', req.params.id, req.user.club_id);
    if (!exists) return res.status(404).json({ message: 'Ticket nije pronađen' });
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
      const [ticket] = await db.query(
        `SELECT st.club_id, st.subject, st.created_by, u.name AS user_name, u.email AS user_email
         FROM support_tickets st JOIN users u ON u.id = st.created_by WHERE st.id=?`,
        [req.params.id]
      );
      if (ticket.length) {
        await db.query(
          'INSERT INTO notifications (user_id, club_id, title, message, type) VALUES (?,?,?,?,?)',
          [ticket[0].created_by, ticket[0].club_id, `💬 Odgovor na tiket: ${ticket[0].subject}`, body.slice(0, 200), 'info']
        );
        sendMail({
          to: ticket[0].user_email,
          subject: `Odgovor na tiket: ${ticket[0].subject}`,
          text: `Pozdrav ${ticket[0].user_name},\n\nStigao je odgovor na vaš tiket "${ticket[0].subject}":\n\n${body}`,
          html: ticketReplyEmailHtml(ticket[0].user_name, ticket[0].subject, body),
        }).catch(err => console.error('Ticket reply notification mail error:', err.message));
      }
    }
    res.json({ message: 'Odgovor poslan' });
  } catch (err) { console.error('Support ticket reply error:', err.message); res.status(500).json({ message: 'Server error' }); }
};

exports.updateStatus = async (req, res) => {
  const { status } = req.body;
  try {
    await db.query('UPDATE support_tickets SET status=?, updated_at=NOW() WHERE id=?', [status, req.params.id]);
    res.json({ message: 'Status ažuriran' });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};
