const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../config/db');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../frontend/assets/uploads/gallery');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `gallery_${Date.now()}_${Math.random().toString(36).slice(2, 7)}${ext}`);
  }
});
exports.upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith('image/')) });

exports.getAll = async (req, res) => {
  try {
    const { event_type, event_id } = req.query;
    let where = 'g.club_id = ?';
    const params = [req.user.club_id];
    if (event_type) { where += ' AND g.event_type = ?'; params.push(event_type); }
    if (event_id)   { where += ' AND g.event_id = ?'; params.push(event_id); }
    const [rows] = await db.query(
      `SELECT g.*, u.name as uploaded_by_name FROM gallery g JOIN users u ON g.uploaded_by = u.id WHERE ${where} ORDER BY g.created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.uploadPhoto = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Nema fajla' });
    const { title, event_type, event_id } = req.body;
    const url = `/assets/uploads/gallery/${req.file.filename}`;
    const [r] = await db.query(
      'INSERT INTO gallery (club_id, uploaded_by, filename, url, title, event_type, event_id) VALUES (?,?,?,?,?,?,?)',
      [req.user.club_id, req.user.id, req.file.filename, url, title||null, event_type||'other', event_id||null]
    );
    res.status(201).json({ id: r.insertId, url, title });
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.remove = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM gallery WHERE id=? AND club_id=?', [req.params.id, req.user.club_id]);
    if (!rows.length) return res.status(404).json({ message: 'Slika nije pronađena' });
    const filePath = path.join(__dirname, '../../frontend/assets/uploads/gallery', rows[0].filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await db.query('DELETE FROM gallery WHERE id=?', [req.params.id]);
    res.json({ message: 'Slika obrisana' });
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};
