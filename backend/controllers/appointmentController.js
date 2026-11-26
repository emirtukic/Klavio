const db = require('../config/db');
const { createNotification } = require('./notificationController');
const { send: sendMail } = require('../config/mailer');
const { renderEmail } = require('../config/emailTemplateStore');

const MAIL_ENABLED = !!(process.env.MAIL_USER && process.env.BREVO_API_KEY);
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// Notifies whichever side (coach or member) didn't create the appointment -
// otherwise they'd only find out by opening Termini themselves.
async function notifyAppointmentCreated(appointmentId, creatorSide) {
  try {
    const [[appt]] = await db.query(`
      SELECT a.*, c.club_id,
             uc.id as coach_user_id, uc.email as coach_email, uc.name as coach_name,
             um.id as member_user_id, um.email as member_email, um.name as member_name
      FROM appointments a
      JOIN coaches c ON a.coach_id = c.id JOIN users uc ON c.user_id = uc.id
      JOIN members m ON a.member_id = m.id JOIN users um ON m.user_id = um.id
      WHERE a.id = ?
    `, [appointmentId]);
    if (!appt) return;

    const when = `${new Date(appt.appointment_date).toLocaleDateString('bs-BA')} ${appt.start_time}`;
    const title = 'Novi termin zakazan';
    const link = '/pages/appointments/list.html';

    const recipient = creatorSide === 'member'
      ? { userId: appt.coach_user_id, email: appt.coach_email, otherName: appt.member_name }
      : { userId: appt.member_user_id, email: appt.member_email, otherName: appt.coach_name };

    const msg = `Termin "${appt.title}" sa ${recipient.otherName} - ${when}`;
    await createNotification(recipient.userId, appt.club_id, title, msg, 'info', link);

    if (MAIL_ENABLED && recipient.email) {
      const rows = [['Naziv', appt.title], ['Datum i vrijeme', when], ...(appt.notes ? [['Napomena', appt.notes]] : [])];
      try {
        const r = await renderEmail('appointment_created', { naziv: appt.title, osoba: recipient.otherName, datum: when, napomena: appt.notes || '', __link: `${APP_URL}${link}` }, rows);
        if (r.enabled) await sendMail({ to: recipient.email, subject: r.subject, html: r.html });
      } catch (_) {}
    }
  } catch (err) {
    console.error('[notif] notifyAppointmentCreated error:', err.message);
  }
}

exports.getAll = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT a.*, uc.name as coach_name, um.name as member_name
      FROM appointments a
      JOIN coaches c ON a.coach_id = c.id JOIN users uc ON c.user_id = uc.id
      JOIN members m ON a.member_id = m.id JOIN users um ON m.user_id = um.id
      WHERE c.club_id = ?
      ORDER BY a.appointment_date DESC, a.start_time
    `, [req.user.club_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getMyAppointments = async (req, res) => {
  try {
    let query, params;
    if (req.user.role === 'coach') {
      const [coaches] = await db.query('SELECT id FROM coaches WHERE user_id = ? AND club_id = ?', [req.user.id, req.user.club_id]);
      if (!coaches.length) return res.json([]);
      query = `SELECT a.*, um.name as member_name FROM appointments a
        JOIN members m ON a.member_id = m.id JOIN users um ON m.user_id = um.id
        WHERE a.coach_id = ? ORDER BY a.appointment_date, a.start_time`;
      params = [coaches[0].id];
    } else {
      const [members] = await db.query('SELECT id FROM members WHERE user_id = ? AND club_id = ?', [req.user.id, req.user.club_id]);
      if (!members.length) return res.json([]);
      query = `SELECT a.*, uc.name as coach_name FROM appointments a
        JOIN coaches c ON a.coach_id = c.id JOIN users uc ON c.user_id = uc.id
        WHERE a.member_id = ? ORDER BY a.appointment_date, a.start_time`;
      params = [members[0].id];
    }
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.create = async (req, res) => {
  const { coach_id, title, appointment_date, start_time, end_time, notes } = req.body;
  try {
    let memberId;
    if (req.user.role === 'member') {
      const [members] = await db.query('SELECT id FROM members WHERE user_id = ? AND club_id = ?', [req.user.id, req.user.club_id]);
      if (!members.length) return res.status(403).json({ message: 'Profil člana nije pronađen' });
      memberId = members[0].id;
    } else {
      memberId = req.body.member_id;
    }
    const [result] = await db.query(
      'INSERT INTO appointments (coach_id, member_id, title, appointment_date, start_time, end_time, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [coach_id, memberId, title, appointment_date, start_time, end_time, notes]
    );

    notifyAppointmentCreated(result.insertId, req.user.role === 'member' ? 'member' : 'coach').catch(() => {});

    res.status(201).json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

async function loadOwnedAppointment(req, res) {
  const [[appt]] = await db.query(
    `SELECT a.*, c.club_id AS coach_club_id, m.club_id AS member_club_id
     FROM appointments a
     LEFT JOIN coaches c ON a.coach_id = c.id
     LEFT JOIN members m ON a.member_id = m.id
     WHERE a.id = ?`,
    [req.params.id]
  );
  const clubId = appt && (appt.coach_club_id ?? appt.member_club_id);
  if (!appt || clubId !== req.user.club_id) { res.status(404).json({ message: 'Termin nije pronađen' }); return null; }
  if (req.user.role === 'member') {
    const [[m]] = await db.query('SELECT id FROM members WHERE user_id=? AND club_id=?', [req.user.id, req.user.club_id]);
    if (!m || m.id !== appt.member_id) { res.status(403).json({ message: 'Nedozvoljen pristup' }); return null; }
  } else if (req.user.role === 'coach') {
    const [[c]] = await db.query('SELECT id FROM coaches WHERE user_id=? AND club_id=?', [req.user.id, req.user.club_id]);
    if (!c || c.id !== appt.coach_id) { res.status(403).json({ message: 'Nedozvoljen pristup' }); return null; }
  }
  return appt;
}

exports.update = async (req, res) => {
  const { status, title, appointment_date, start_time, end_time, notes } = req.body;
  try {
    const appt = await loadOwnedAppointment(req, res);
    if (!appt) return;
    await db.query(
      'UPDATE appointments SET status=COALESCE(?,status), title=COALESCE(?,title), appointment_date=COALESCE(?,appointment_date), start_time=COALESCE(?,start_time), end_time=COALESCE(?,end_time), notes=COALESCE(?,notes) WHERE id=?',
      [status, title, appointment_date, start_time, end_time, notes, req.params.id]
    );
    res.json({ message: 'Termin ažuriran' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.remove = async (req, res) => {
  try {
    const appt = await loadOwnedAppointment(req, res);
    if (!appt) return;
    await db.query('DELETE FROM appointments WHERE id = ?', [req.params.id]);
    res.json({ message: 'Termin obrisan' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
