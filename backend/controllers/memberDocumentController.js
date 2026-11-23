const path    = require('path');
const multer  = require('multer');
const db      = require('../config/db');
const { uploadToR2, deleteFromR2, keyFromUrl } = require('../config/r2');

// Content-Type is derived from this whitelist server-side, never from the
// client-supplied mimetype - otherwise an upload could claim to be
// "text/html" and, served from the public bucket, run as stored XSS.
const EXT_CONTENT_TYPE = {
  '.pdf':  'application/pdf',
  '.doc':  'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls':  'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.txt':  'text/plain',
  '.csv':  'text/csv',
  '.zip':  'application/zip',
};

exports.upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(EXT_CONTENT_TYPE[ext] ? null : new Error('Tip fajla nije podržan'), !!EXT_CONTENT_TYPE[ext]);
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
    const ext  = path.extname(req.file.originalname).toLowerCase();
    const contentType = EXT_CONTENT_TYPE[ext];
    if (!contentType) return res.status(400).json({ message: 'Tip fajla nije podržan' });
    const safe = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').replace(ext, '');
    const key  = `member-docs/${req.params.memberId}_${Date.now()}_${safe}${ext}`;
    // Force download instead of inline rendering - even if a crafted file
    // slips past the extension whitelist, the browser won't execute it.
    const disposition = `attachment; filename="${safe}${ext}"`;
    const fileUrl = await uploadToR2(key, req.file.buffer, contentType, disposition);
    const name    = req.body.name || req.file.originalname;
    const [result] = await db.query(
      'INSERT INTO member_documents (member_id, club_id, name, file_url, file_size, mime_type, uploaded_by) VALUES (?,?,?,?,?,?,?)',
      [req.params.memberId, req.user.club_id, name, fileUrl, req.file.size, contentType, req.user.id]
    );
    res.status(201).json({ id: result.insertId, name, file_url: fileUrl, file_size: req.file.size, mime_type: contentType, created_at: new Date() });
  } catch (err) {
    console.error('Document upload error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.remove = async (req, res) => {
  try {
    await db.query(ENSURE_TABLE);
    const [[doc]] = await db.query('SELECT * FROM member_documents WHERE id=? AND club_id=?', [req.params.id, req.user.club_id]);
    if (!doc) return res.status(404).json({ message: 'Dokument nije pronađen' });
    const key = keyFromUrl(doc.file_url);
    if (key) await deleteFromR2(key).catch(err => console.error('R2 delete error:', err.message));
    await db.query('DELETE FROM member_documents WHERE id=?', [req.params.id]);
    res.json({ message: 'Dokument obrisan' });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};
