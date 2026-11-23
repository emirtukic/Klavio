const multer = require('multer');
const db = require('../config/db');
const { imageFileFilter } = require('../middleware/imageUpload');
const { uploadToR2, deleteFromR2, keyFromUrl } = require('../config/r2');
const { detectImageType } = require('../utils/fileSignature');

exports.upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: imageFileFilter
});

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
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.uploadPhoto = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Nema fajla' });
    const { title, event_type, event_id } = req.body;
    const type = detectImageType(req.file.buffer);
    if (!type) return res.status(400).json({ message: 'Fajl nije validna slika' });
    const filename = `gallery_${Date.now()}_${Math.random().toString(36).slice(2, 7)}${type.ext}`;
    const url = await uploadToR2(`gallery/${filename}`, req.file.buffer, type.mime);
    const [r] = await db.query(
      'INSERT INTO gallery (club_id, uploaded_by, filename, url, title, event_type, event_id) VALUES (?,?,?,?,?,?,?)',
      [req.user.club_id, req.user.id, filename, url, title||null, event_type||'other', event_id||null]
    );
    res.status(201).json({ id: r.insertId, url, title });
  } catch (err) {
    console.error('Gallery upload error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.remove = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM gallery WHERE id=? AND club_id=?', [req.params.id, req.user.club_id]);
    if (!rows.length) return res.status(404).json({ message: 'Slika nije pronađena' });
    const key = keyFromUrl(rows[0].url) || `gallery/${rows[0].filename}`;
    await deleteFromR2(key).catch(err => console.error('R2 delete error:', err.message));
    await db.query('DELETE FROM gallery WHERE id=?', [req.params.id]);
    res.json({ message: 'Slika obrisana' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
