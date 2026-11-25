const db = require('../config/db');
const { createNotification } = require('./notificationController');
const { send: sendMail } = require('../config/mailer');
const { feeReminderEmailHtml } = require('../config/emailTemplates');

const MAIL_ENABLED = !!(process.env.MAIL_USER && process.env.BREVO_API_KEY);

async function sendReminderEmail(toEmail, name, clubName, amount, dueDateStr, isOverdue) {
  if (!MAIL_ENABLED || !toEmail) return;
  try {
    await sendMail({
      to: toEmail,
      subject: isOverdue ? 'Članarina je zakašnjela' : 'Podsjetnik: članarina uskoro dospijeva',
      html: feeReminderEmailHtml(name, clubName, amount, dueDateStr, isOverdue),
    });
  } catch (_) {}
}

exports.sendFeeReminder = async (req, res) => {
  try {
    const { feeId } = req.params;
    const club_id = req.user.club_id;
    const [[fee]] = await db.query(`
      SELECT mf.*, u.id as user_id, u.name as member_name, u.email as member_email
      FROM membership_fees mf
      JOIN members m ON mf.member_id = m.id
      JOIN users u ON m.user_id = u.id
      WHERE mf.id = ? AND m.club_id = ?
    `, [feeId, club_id]);
    if (!fee) return res.status(404).json({ message: 'Članarina nije pronađena' });

    const due = fee.due_date ? new Date(fee.due_date).toLocaleDateString('bs-BA') : '-';
    const isOverdue = fee.status === 'overdue';
    await createNotification(
      fee.user_id, club_id,
      isOverdue ? 'Članarina zakašnjela' : 'Podsjetnik: članarina',
      `${isOverdue ? 'Vaša članarina' : 'Podsjetnik'} od ${fee.amount} KM (rok uplate: ${due}) ${isOverdue ? 'je zakašnjela' : 'uskoro dospijeva'}.`,
      isOverdue ? 'danger' : 'warning',
      '/pages/fees/list.html'
    );
    const [[club]] = await db.query('SELECT name FROM clubs WHERE id = ?', [club_id]);
    await sendReminderEmail(fee.member_email, fee.member_name, club?.name || 'Klavio', fee.amount, due, isOverdue);
    res.json({ message: `Podsjetnik poslan za ${fee.member_name}` });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Check for overdue or upcoming fees and create notifications
exports.checkFees = async (req, res) => {
  try {
    const club_id = req.user.club_id;

    // Find overdue fees (due_date < today, status = pending)
    const [overdue] = await db.query(`
      SELECT mf.*, u.id as user_id, u.name as member_name, u.email as member_email, m.club_id
      FROM membership_fees mf
      JOIN members m ON mf.member_id = m.id
      JOIN users u ON m.user_id = u.id
      WHERE mf.status = 'pending' AND mf.due_date < CURDATE() AND m.club_id = ?
    `, [club_id]);

    // Update them to overdue
    if (overdue.length) {
      await db.query(`UPDATE membership_fees SET status='overdue' WHERE status='pending' AND due_date < CURDATE() AND member_id IN (SELECT id FROM members WHERE club_id = ?)`, [club_id]);
    }

    // Find fees due in next 7 days
    const [upcoming] = await db.query(`
      SELECT mf.*, u.id as user_id, u.name as member_name, u.email as member_email
      FROM membership_fees mf
      JOIN members m ON mf.member_id = m.id
      JOIN users u ON m.user_id = u.id
      WHERE mf.status = 'pending' AND mf.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY) AND m.club_id = ?
    `, [club_id]);

    let notifsSent = 0;
    const [[club]] = await db.query('SELECT name FROM clubs WHERE id = ?', [club_id]);
    const clubName = club?.name || 'Klavio';

    // Send overdue notifications to affected users
    for (const fee of overdue) {
      const due = fee.due_date ? new Date(fee.due_date).toLocaleDateString('bs-BA') : '-';
      await createNotification(fee.user_id, club_id,
        'Članarina zakašnjela',
        `Vaša članarina od ${fee.amount} KM (rok uplate: ${due}) je zakašnjela.`,
        'danger',
        '/pages/fees/list.html'
      );
      await sendReminderEmail(fee.member_email, fee.member_name, clubName, fee.amount, due, true);
      notifsSent++;
    }

    // Send upcoming reminders
    for (const fee of upcoming) {
      const due = fee.due_date ? new Date(fee.due_date).toLocaleDateString('bs-BA') : '-';
      await createNotification(fee.user_id, club_id,
        'Podsjetnik: članarina uskoro dospijeva',
        `Vaša članarina od ${fee.amount} KM dospijeva ${due}.`,
        'warning',
        '/pages/fees/list.html'
      );
      await sendReminderEmail(fee.member_email, fee.member_name, clubName, fee.amount, due, false);
      notifsSent++;
    }

    res.json({
      message: `Provjera završena. Zakašnjelih: ${overdue.length}, Uskoro: ${upcoming.length}. Obavijesti poslane: ${notifsSent}` ,
      overdue: overdue.length,
      upcoming: upcoming.length,
      notifsSent
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
