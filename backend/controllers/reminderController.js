const db = require('../config/db');
const { createNotification } = require('./notificationController');
const { send: sendMail } = require('../config/mailer');
const { renderEmail } = require('../config/emailTemplateStore');

const MAIL_ENABLED = !!(process.env.MAIL_USER && process.env.BREVO_API_KEY);
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// A coach may only send/trigger reminders for members of their own selection(s).
async function memberInCoachScope(req, memberId) {
  if (req.user.role !== 'coach') return true;
  const ids = req.user.selection_ids || [];
  if (!ids.length) return false;
  const [rows] = await db.query(
    'SELECT 1 FROM member_selections WHERE member_id=? AND selection_id IN (?) LIMIT 1',
    [memberId, ids]
  );
  return rows.length > 0;
}

async function sendReminderEmail(toEmail, name, clubName, amount, dueDateStr, isOverdue) {
  if (!MAIL_ENABLED || !toEmail) return;
  try {
    const amountStr = Number(amount).toFixed(2);
    const key = isOverdue ? 'fee_reminder_overdue' : 'fee_reminder_upcoming';
    const r = await renderEmail(key, { ime: name, klub: clubName, iznos: amountStr, rok: dueDateStr, __link: `${APP_URL}/pages/my-fees/index.html` },
      [['Iznos', `${amountStr} KM`], ['Rok uplate', dueDateStr]]);
    if (r.enabled) await sendMail({ to: toEmail, subject: r.subject, html: r.html });
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
    if (!(await memberInCoachScope(req, fee.member_id))) return res.status(404).json({ message: 'Članarina nije pronađena' });

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
    const ids = req.user.selection_ids || [];
    const coachFilter = req.user.role === 'coach'
      ? (ids.length ? ' AND EXISTS (SELECT 1 FROM member_selections ms WHERE ms.member_id=m.id AND ms.selection_id IN (?))' : ' AND 1=0')
      : '';
    const scopeParams = req.user.role === 'coach' && ids.length ? [ids] : [];

    // Find overdue fees (due_date < today, status = pending)
    const [overdue] = await db.query(`
      SELECT mf.*, u.id as user_id, u.name as member_name, u.email as member_email, m.club_id
      FROM membership_fees mf
      JOIN members m ON mf.member_id = m.id
      JOIN users u ON m.user_id = u.id
      WHERE mf.status = 'pending' AND mf.due_date < CURDATE() AND m.club_id = ?${coachFilter}
    `, [club_id, ...scopeParams]);

    // Update them to overdue
    if (overdue.length) {
      await db.query(
        `UPDATE membership_fees mf JOIN members m ON mf.member_id = m.id
         SET mf.status='overdue'
         WHERE mf.status='pending' AND mf.due_date < CURDATE() AND m.club_id = ?${coachFilter}`,
        [club_id, ...scopeParams]
      );
    }

    // Find fees due in next 7 days
    const [upcoming] = await db.query(`
      SELECT mf.*, u.id as user_id, u.name as member_name, u.email as member_email
      FROM membership_fees mf
      JOIN members m ON mf.member_id = m.id
      JOIN users u ON m.user_id = u.id
      WHERE mf.status = 'pending' AND mf.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY) AND m.club_id = ?${coachFilter}
    `, [club_id, ...scopeParams]);

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
