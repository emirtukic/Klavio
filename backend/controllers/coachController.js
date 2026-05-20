const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../config/db');
const { send: sendMail } = require('../config/mailer');
const { inviteEmailHtml } = require('../config/emailTemplates');

exports.getAll = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT c.*, u.name, u.email, u.is_active
      FROM coaches c JOIN users u ON c.user_id = u.id
      WHERE c.club_id = ?
      ORDER BY u.name
    `, [req.user.club_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT c.*, u.name, u.email
      FROM coaches c JOIN users u ON c.user_id = u.id
      WHERE c.id = ? AND c.club_id = ?
    `, [req.params.id, req.user.club_id]);
    if (!rows.length) return res.status(404).json({ message: 'Trener nije pronađen' });

    const [sessions] = await db.query(
      'SELECT * FROM training_sessions WHERE coach_id = ? AND club_id = ? ORDER BY session_date DESC',
      [req.params.id, req.user.club_id]
    );
    res.json({ ...rows[0], sessions });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.create = async (req, res) => {
  const { name, email, specialization, phone, bio, selection_id } = req.body;
  const club_id = req.user.club_id;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const placeholder = crypto.randomBytes(32).toString('hex');
    const password_hash = await bcrypt.hash(placeholder, 10);
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [userResult] = await conn.query(
      'INSERT INTO users (name, email, password_hash, role, club_id, email_verified, verification_token, verification_expires) VALUES (?, ?, ?, ?, ?, 0, ?, ?)',
      [name, email, password_hash, 'coach', club_id, token, expires]
    );
    const [coachResult] = await conn.query(
      'INSERT INTO coaches (user_id, specialization, phone, bio, club_id, selection_id) VALUES (?, ?, ?, ?, ?, ?)',
      [userResult.insertId, specialization, phone, bio, club_id, selection_id || null]
    );
    await conn.commit();

    // Send welcome email (non-blocking)
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const link = `${appUrl}/set-password.html?token=${token}`;
    const [clubRows] = await db.query('SELECT name FROM clubs WHERE id = ?', [club_id]);
    const clubName = clubRows[0]?.name || 'Klavio';
    sendMail({
      to: email,
      subject: `Dobrodošli u ${clubName} — Aktivirajte nalog`,
      text: `Pozdrav ${name},\n\nAdministrator kluba "${clubName}" je kreirao vaš trenerski nalog na Klavio platformi.\n\nKliknite na link ispod da postavite lozinku i aktivirate nalog:\n\n${link}\n\nLink je valjan 7 dana.\n\n© 2026 Klavio · klavio.app`,
      html: inviteEmailHtml(name, 'coach', clubName, link),
    }).catch(err => console.error('Welcome mail error:', err.message));

    res.status(201).json({ id: coachResult.insertId, user_id: userResult.insertId });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Email već postoji' });
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    conn.release();
  }
};

exports.update = async (req, res) => {
  const { name, email, specialization, phone, bio, is_active } = req.body;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [coaches] = await conn.query('SELECT user_id FROM coaches WHERE id = ? AND club_id = ?', [req.params.id, req.user.club_id]);
    if (!coaches.length) { await conn.rollback(); return res.status(404).json({ message: 'Trener nije pronađen' }); }

    await conn.query(
      'UPDATE users SET name=COALESCE(?,name), email=COALESCE(?,email), is_active=COALESCE(?,is_active) WHERE id=?',
      [name, email, is_active, coaches[0].user_id]
    );
    await conn.query(
      'UPDATE coaches SET specialization=COALESCE(?,specialization), phone=COALESCE(?,phone), bio=COALESCE(?,bio) WHERE id=?',
      [specialization, phone, bio, req.params.id]
    );
    await conn.commit();
    res.json({ message: 'Trener ažuriran' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    conn.release();
  }
};

exports.remove = async (req, res) => {
  try {
    const [coaches] = await db.query('SELECT user_id FROM coaches WHERE id = ? AND club_id = ?', [req.params.id, req.user.club_id]);
    if (!coaches.length) return res.status(404).json({ message: 'Trener nije pronađen' });
    await db.query('DELETE FROM users WHERE id = ?', [coaches[0].user_id]);
    res.json({ message: 'Trener obrisan' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.getSchedule = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM training_sessions WHERE coach_id = ? AND club_id = ? ORDER BY session_date, start_time',
      [req.params.id, req.user.club_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.getMySchedule = async (req, res) => {
  try {
    const [coaches] = await db.query('SELECT id FROM coaches WHERE user_id = ? AND club_id = ?', [req.user.id, req.user.club_id]);
    if (!coaches.length) return res.json([]);
    const [rows] = await db.query(
      'SELECT * FROM training_sessions WHERE coach_id = ? AND club_id = ? ORDER BY session_date, start_time',
      [coaches[0].id, req.user.club_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
