const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../config/db');
const { imageFileFilter } = require('../middleware/imageUpload');

const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../frontend/assets/uploads/clubs');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `club_${req.params.id}${ext}`);
  }
});
exports.logoUpload = multer({
  storage: logoStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFileFilter
});

exports.uploadLogo = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Nema fajla' });
    const logoUrl = `/assets/uploads/clubs/${req.file.filename}`;
    await db.query('UPDATE clubs SET logo_url = ? WHERE id = ?', [logoUrl, req.params.id]);
    res.json({ message: 'Logo ažuriran', logo_url: logoUrl });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getAll = async (req, res) => {
  try {
    const [clubs] = await db.query(`
      SELECT c.*,
        (SELECT COUNT(*) FROM members WHERE club_id = c.id) as member_count,
        (SELECT COUNT(*) FROM coaches WHERE club_id = c.id) as coach_count,
        (SELECT COUNT(*) FROM users WHERE club_id = c.id AND role = 'admin') as admin_count,
        cs.plan AS sub_plan, cs.status AS sub_status, cs.price AS sub_price,
        cs.billing_cycle AS sub_billing_cycle, cs.trial_ends_at, cs.current_period_end
      FROM clubs c
      LEFT JOIN club_subscriptions cs ON cs.club_id = c.id
      ORDER BY c.name
    `);
    res.json(clubs);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getOne = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM clubs WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Club not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.create = async (req, res) => {
  const { name, primary_color, secondary_color, logo_url } = req.body;
  if (!name) return res.status(400).json({ message: 'Naziv kluba je obavezan' });
  const slug = (req.body.slug || name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  try {
    const [result] = await db.query(
      'INSERT INTO clubs (name, slug, primary_color, secondary_color, logo_url) VALUES (?, ?, ?, ?, ?)',
      [name, slug, primary_color || '#1e293b', secondary_color || '#3b82f6', logo_url || null]
    );
    res.status(201).json({ id: result.insertId, name, slug, primary_color: primary_color || '#1e293b', secondary_color: secondary_color || '#3b82f6' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Klub sa tim imenom već postoji' });
    res.status(500).json({ message: 'Server error' });
  }
};

exports.update = async (req, res) => {
  const { name, slug, primary_color, secondary_color, logo_url, is_active } = req.body;
  try {
    await db.query(
      'UPDATE clubs SET name=COALESCE(?,name), slug=COALESCE(?,slug), primary_color=COALESCE(?,primary_color), secondary_color=COALESCE(?,secondary_color), logo_url=COALESCE(?,logo_url), is_active=COALESCE(?,is_active) WHERE id=?',
      [name || null, slug || null, primary_color || null, secondary_color || null, logo_url || null, is_active ?? null, req.params.id]
    );
    const [rows] = await db.query('SELECT * FROM clubs WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.remove = async (req, res) => {
  const id = req.params.id;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    // Delete in FK-safe order
    await conn.query('DELETE ta FROM training_attendance ta JOIN training_sessions ts ON ta.session_id = ts.id WHERE ts.club_id = ?', [id]);
    await conn.query('DELETE mf FROM membership_fees mf JOIN members m ON mf.member_id = m.id WHERE m.club_id = ?', [id]);
    await conn.query('DELETE FROM appointments WHERE coach_id IN (SELECT id FROM coaches WHERE club_id = ?)', [id]);
    await conn.query('DELETE FROM training_sessions WHERE club_id = ?', [id]);
    await conn.query('DELETE FROM matches WHERE club_id = ?', [id]);
    await conn.query('DELETE FROM members WHERE club_id = ?', [id]);
    await conn.query('DELETE FROM coaches WHERE club_id = ?', [id]);
    await conn.query('DELETE FROM users WHERE club_id = ?', [id]);
    await conn.query('DELETE FROM clubs WHERE id = ?', [id]);
    await conn.commit();
    res.json({ message: 'Klub obrisan' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
};

exports.getAdmins = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, name, email, is_active, created_at FROM users WHERE club_id = ? AND role = 'admin' ORDER BY name",
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createAdmin = async (req, res) => {
  const { name, email, password } = req.body;
  const club_id = parseInt(req.params.id);
  if (!name || !email) return res.status(400).json({ message: 'Ime i email su obavezni' });
  try {
    const [club] = await db.query('SELECT id FROM clubs WHERE id = ?', [club_id]);
    if (!club.length) return res.status(404).json({ message: 'Klub nije pronađen' });
    const isGenerated = !password;
    const tempPassword = password || crypto.randomBytes(9).toString('base64url');
    const password_hash = await bcrypt.hash(tempPassword, 10);
    const [result] = await db.query(
      "INSERT INTO users (name, email, password_hash, role, club_id) VALUES (?, ?, ?, 'admin', ?)",
      [name, email, password_hash, club_id]
    );
    res.status(201).json({ id: result.insertId, name, email, role: 'admin', club_id, temp_password: isGenerated ? tempPassword : undefined });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Email već postoji' });
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteAdmin = async (req, res) => {
  try {
    await db.query("DELETE FROM users WHERE id = ? AND club_id = ? AND role = 'admin'", [req.params.userId, req.params.id]);
    res.json({ message: 'Admin obrisan' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.resetAdminPassword = async (req, res) => {
  try {
    const tempPassword = crypto.randomBytes(9).toString('base64url');
    const hash = await bcrypt.hash(tempPassword, 10);
    const [result] = await db.query("UPDATE users SET password_hash = ? WHERE id = ? AND club_id = ? AND role = 'admin'", [hash, req.params.userId, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Admin nije pronađen' });
    res.json({ message: 'Lozinka resetovana', temp_password: tempPassword });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.accessClub = async (req, res) => {
  const jwt = require('jsonwebtoken');
  try {
    const [clubs] = await db.query(
      `SELECT c.*, COALESCE(cs.plan,'starter') AS plan, cs.status AS sub_status
       FROM clubs c LEFT JOIN club_subscriptions cs ON cs.club_id = c.id
       WHERE c.id = ? LIMIT 1`,
      [req.params.id]
    );
    if (!clubs.length) return res.status(404).json({ message: 'Klub nije pronađen' });
    const club = clubs[0];
    const token = jwt.sign(
      { id: req.user.id, email: req.user.email, role: 'super_admin', name: req.user.name, club_id: club.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );
    res.json({ token, club, user: { id: req.user.id, name: req.user.name, email: req.user.email, role: 'super_admin', club_id: club.id } });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
