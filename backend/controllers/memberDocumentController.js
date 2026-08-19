const path    = require('path');
const fs      = require('fs');
const multer  = require('multer');
const db      = require('../config/db');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../frontend/assets/uploads/member-docs');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').replace(ext, '');
    cb(null, `${req.params.memberId}_${Date.now()}_${safe}${ext}`);
  }
});

exports.upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf','.doc','.docx','.xls','.xlsx','.png','.jpg','.jpeg','.gif','.webp','.txt','.csv','.zip'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(allowed.includes(ext) ? null : new Error('Tip fajla nije podržan'), allowed.includes(ext));
  }
});

const ENSURE_TABLE = `CREATE TABLE IF NOT EXISTS member_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  member_id INT NOT NULL,
  club_id INT NOT NULL,
  name VARCHAR(255),
  file_url VARCHAR(500),
  file_size INT,
  mime_type VARCHAR(100),
  uploaded_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (member_id), INDEX (club_id)
)`;

exports.getAll = async (req, res) => {
  try {
    await db.query(ENSURE_TABLE);
    const [rows] = await db.query(
      `SELECT d.*, u.name AS uploaded_by_name
       FROM member_documents d LEFT JOIN users u ON d.uploaded_by = u.id
       WHERE d.member_id = ? AND d.club_id = ? ORDER BY d.created_at DESC`,
      [req.params.memberId, req.user.club_id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.create = async (req, res) => {
  try {
    await db.query(ENSURE_TABLE);
    if (!req.file) return res.status(400).json({ message: 'Fajl nije pronađen' });
    const fileUrl = `/assets/uploads/member-docs/${req.file.filename}`;
    const name    = req.body.name || req.file.originalname;
    const [result] = await db.query(
      'INSERT INTO member_documents (member_id, club_id, name, file_url, file_size, mime_type, uploaded_by) VALUES (?,?,?,?,?,?,?)',
      [req.params.memberId, req.user.club_id, name, fileUrl, req.file.size, req.file.mimetype, req.user.id]
    );
    res.status(201).json({ id: result.insertId, name, file_url: fileUrl, file_size: req.file.size, mime_type: req.file.mimetype, created_at: new Date() });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.remove = async (req, res) => {
  try {
    await db.query(ENSURE_TABLE);
    const [[doc]] = await db.query('SELECT * FROM member_documents WHERE id=? AND club_id=?', [req.params.id, req.user.club_id]);
    if (!doc) return res.status(404).json({ message: 'Dokument nije pronađen' });
    const filePath = path.join(__dirname, '../../frontend', doc.file_url);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await db.query('DELETE FROM member_documents WHERE id=?', [req.params.id]);
    res.json({ message: 'Dokument obrisan' });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};
