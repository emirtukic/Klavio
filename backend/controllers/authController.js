const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const crypto = require('crypto');
const db = require('../config/db');
const { send: sendMail } = require('../config/mailer');
const { verifyEmailHtml, inviteEmailHtml } = require('../config/emailTemplates');

const avatarStorage = multer.diskStorage({
  destination: path.join(__dirname, '../../frontend/assets/uploads/avatars'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `user_${req.user.id}${ext}`);
  }
});
exports.avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, file.mimetype.startsWith('image/'));
  }
});

exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ? AND is_active = TRUE', [email]);
    if (!rows.length) return res.status(401).json({ message: 'Pogrešan email ili lozinka' });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ message: 'Pogrešan email ili lozinka' });
    if (user.email_verified === 0) return res.status(403).json({ message: 'Molimo potvrdite vašu e-mail adresu. Provjerite inbox.' });

    // Fetch club branding + subscription plan for non-super_admin users
    let club = null;
    if (user.club_id) {
      const [clubRows] = await db.query(
        `SELECT c.*, COALESCE(cs.plan, 'starter') AS plan, cs.status AS sub_status
         FROM clubs c LEFT JOIN club_subscriptions cs ON cs.club_id = c.id
         WHERE c.id = ?`,
        [user.club_id]
      );
      club = clubRows[0] || null;
    }

    // Fetch selection for coaches
    let selectionId = null;
    let selection = null;
    if (user.role === 'coach' && user.club_id) {
      const [coachRows] = await db.query(
        'SELECT c.selection_id, s.name as selection_name FROM coaches c LEFT JOIN selections s ON c.selection_id = s.id WHERE c.user_id = ? AND c.club_id = ?',
        [user.id, user.club_id]
      );
      if (coachRows.length && coachRows[0].selection_id) {
        selectionId = coachRows[0].selection_id;
        selection = { id: selectionId, name: coachRows[0].selection_name };
      }
    }

    if (user.role === 'member' && user.club_id) {
      const [memberRows] = await db.query(
        'SELECT m.selection_id, s.name as selection_name FROM members m LEFT JOIN selections s ON m.selection_id = s.id WHERE m.user_id = ? AND m.club_id = ?',
        [user.id, user.club_id]
      );
      if (memberRows.length && memberRows[0].selection_id) {
        selectionId = memberRows[0].selection_id;
        selection = { id: selectionId, name: memberRows[0].selection_name };
      }
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name, club_id: user.club_id || null, selection_id: selectionId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, club_id: user.club_id || null, avatar_url: user.avatar_url || null },
      club,
      selection
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.register = async (req, res) => {
  const { club_name, club_city, admin_name, email, password } = req.body;
  if (!club_name || !admin_name || !email || !password)
    return res.status(400).json({ message: 'Popunite sva obavezna polja' });
  if (password.length < 8)
    return res.status(400).json({ message: 'Lozinka mora imati najmanje 8 karaktera' });
  try {
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) return res.status(400).json({ message: 'Email već postoji' });

    const slug = club_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const [clubResult] = await db.query(
      'INSERT INTO clubs (name, slug, city, is_active) VALUES (?, ?, ?, 1)',
      [club_name, slug + '-' + Date.now(), club_city || null]
    );
    const clubId = clubResult.insertId;

    const password_hash = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.query(
      'INSERT INTO users (name, email, password_hash, role, club_id, is_active, email_verified, verification_token, verification_expires) VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?)',
      [admin_name, email, password_hash, 'admin', clubId, verificationToken, verificationExpires]
    );

    await db.query(
      `INSERT INTO club_subscriptions (club_id, plan, status, price, billing_cycle)
       VALUES (?, 'starter', 'active', 0, 'monthly')
       ON DUPLICATE KEY UPDATE plan='starter', status='active'`,
      [clubId]
    );

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const verifyLink = `${appUrl}/api/auth/verify-email?token=${verificationToken}`;

    try {
      await sendMail({
        to: email,
        subject: 'Potvrdite vašu e-mail adresu – Klavio',
        text: [
          `Dobrodošli u Klavio, ${admin_name}!`,
          '',
          `Vaš klub "${club_name}" je uspješno kreiran.`,
          'Potvrdite e-mail adresu klikom na link ispod:',
          '',
          verifyLink,
          '',
          'Link je valjan 24 sata.',
          'Ako niste kreirali ovaj račun, možete ignorisati ovaj e-mail.',
          '',
          '© 2026 Klavio · klavio.app',
        ].join('\n'),
        html: verifyEmailHtml(admin_name, club_name, verifyLink),
      });
    } catch (mailErr) {
      console.error('Mail send error:', mailErr.message);
    }

    res.status(201).json({
      message: 'Klub kreiran! Provjerite vaš e-mail inbox za link potvrde.',
      email,
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Email već postoji' });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.verifyEmail = async (req, res) => {
  const { token } = req.query;
  if (!token) return res.redirect('/verify-email.html?error=invalid');
  try {
    const [rows] = await db.query(
      'SELECT id FROM users WHERE verification_token = ? AND verification_expires > NOW() AND email_verified = 0',
      [token]
    );
    if (!rows.length) return res.redirect('/verify-email.html?error=expired');
    await db.query(
      'UPDATE users SET email_verified = 1, verification_token = NULL, verification_expires = NULL WHERE id = ?',
      [rows[0].id]
    );
    res.redirect('/verify-email.html?success=1');
  } catch (err) {
    res.redirect('/verify-email.html?error=server');
  }
};

exports.createUser = async (req, res) => {
  const { name, email, role } = req.body;
  const club_id = req.user.role === 'super_admin' ? (req.body.club_id || null) : req.user.club_id;
  if (!name || !email || !role)
    return res.status(400).json({ message: 'Popunite sva obavezna polja' });
  try {
    const placeholder = crypto.randomBytes(32).toString('hex');
    const password_hash = await bcrypt.hash(placeholder, 10);
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [result] = await db.query(
      'INSERT INTO users (name, email, password_hash, role, club_id, email_verified, verification_token, verification_expires) VALUES (?, ?, ?, ?, ?, 0, ?, ?)',
      [name, email, password_hash, role, club_id, token, expires]
    );

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const setPasswordLink = `${appUrl}/set-password.html?token=${token}`;

    let clubName = 'Klavio';
    if (club_id) {
      const [clubRows] = await db.query('SELECT name FROM clubs WHERE id = ?', [club_id]);
      clubName = clubRows[0]?.name || 'Klavio';
    }

    try {
      await sendMail({
        to: email,
        subject: `Dobrodošli u ${clubName} — Postavite vašu lozinku`,
        text: [
          `Pozdrav ${name},`,
          '',
          `Administrator kluba "${clubName}" je kreirao vaš nalog na Klavio platformi.`,
          '',
          'Kliknite na link ispod da postavite lozinku i aktivirate nalog:',
          '',
          setPasswordLink,
          '',
          'Link je valjan 7 dana.',
          'Ako niste očekivali ovaj e-mail, možete ga ignorisati.',
          '',
          '© 2026 Klavio · klavio.app',
        ].join('\n'),
        html: inviteEmailHtml(name, role, clubName, setPasswordLink),
      });
    } catch (mailErr) {
      console.error('Welcome mail error:', mailErr.message);
    }

    res.status(201).json({ id: result.insertId, name, email, role, club_id });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Email već postoji' });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, email, role, club_id, phone, avatar_url, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Korisnik nije pronađen' });
    const user = rows[0];
    if (user.club_id) {
      const [clubRows] = await db.query('SELECT name FROM clubs WHERE id = ?', [user.club_id]);
      user.club_name = clubRows[0]?.name || null;
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  const { name, phone, email } = req.body;
  try {
    if (!name || !name.trim()) return res.status(400).json({ message: 'Ime je obavezno' });
    if (email && email !== req.user.email) {
      const [exists] = await db.query('SELECT id FROM users WHERE email = ? AND id != ?', [email, req.user.id]);
      if (exists.length) return res.status(400).json({ message: 'Email već koristi drugi korisnik' });
    }
    await db.query(
      'UPDATE users SET name = ?, phone = ?, email = COALESCE(?, email) WHERE id = ?',
      [name.trim(), phone || null, email || null, req.user.id]
    );
    const [rows] = await db.query(
      'SELECT id, name, email, role, club_id, phone, avatar_url FROM users WHERE id = ?',
      [req.user.id]
    );
    res.json({ message: 'Profil ažuriran', user: rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Nema fajla' });
    const avatarUrl = `/assets/uploads/avatars/${req.file.filename}`;
    await db.query('UPDATE users SET avatar_url = ? WHERE id = ?', [avatarUrl, req.user.id]);
    res.json({ message: 'Avatar ažuriran', avatar_url: avatarUrl });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  try {
    const [rows] = await db.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!valid) return res.status(400).json({ message: 'Trenutna lozinka nije ispravna' });
    const hash = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
    res.json({ message: 'Lozinka uspješno promijenjena' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.updateClubBranding = async (req, res) => {
  const { name, primary_color, secondary_color } = req.body;
  const clubId = req.user.club_id;
  if (!clubId) return res.status(403).json({ message: 'Nema kluba' });
  try {
    await db.query(
      'UPDATE clubs SET name=COALESCE(?,name), primary_color=COALESCE(?,primary_color), secondary_color=COALESCE(?,secondary_color) WHERE id=?',
      [name || null, primary_color || null, secondary_color || null, clubId]
    );
    const [rows] = await db.query('SELECT * FROM clubs WHERE id = ?', [clubId]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.validateSetPasswordToken = async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ message: 'Token nije naveden' });
  try {
    const [rows] = await db.query(
      'SELECT name, email FROM users WHERE verification_token = ? AND verification_expires > NOW() AND email_verified = 0',
      [token]
    );
    if (!rows.length) return res.status(404).json({ message: 'Link nije validan ili je istekao' });
    res.json({ name: rows[0].name, email: rows[0].email });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.setPassword = async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ message: 'Token i lozinka su obavezni' });
  if (password.length < 8) return res.status(400).json({ message: 'Lozinka mora imati najmanje 8 karaktera' });
  try {
    const [rows] = await db.query(
      'SELECT id FROM users WHERE verification_token = ? AND verification_expires > NOW() AND email_verified = 0',
      [token]
    );
    if (!rows.length) return res.status(400).json({ message: 'Link nije validan ili je istekao' });
    const hash = await bcrypt.hash(password, 10);
    await db.query(
      'UPDATE users SET password_hash = ?, email_verified = 1, verification_token = NULL, verification_expires = NULL WHERE id = ?',
      [hash, rows[0].id]
    );
    res.json({ message: 'Lozinka je uspješno postavljena. Možete se prijaviti.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
