const db = require('../config/db');

exports.getAll = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT a.*, u.name as author_name FROM announcements a JOIN users u ON a.author_id = u.id WHERE a.club_id = ? ORDER BY a.pinned DESC, a.created_at DESC`,
      [req.user.club_id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.create = async (req, res) => {
  const { title, content, pinned } = req.body;
  if (!title || !content) return res.status(400).json({ message: 'Naslov i sadržaj su obavezni' });
  try {
    const [result] = await db.query(
      'INSERT INTO announcements (club_id, author_id, title, content, pinned) VALUES (?,?,?,?,?)',
      [req.user.club_id, req.user.id, title, content, pinned ? 1 : 0]
    );
    res.status(201).json({ id: result.insertId, title, content });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.update = async (req, res) => {
  const { title, content, pinned } = req.body;
  try {
    await db.query(
      'UPDATE announcements SET title=COALESCE(?,title), content=COALESCE(?,content), pinned=COALESCE(?,pinned) WHERE id=? AND club_id=?',
      [title||null, content||null, pinned!=null ? (pinned?1:0) : null, req.params.id, req.user.club_id]
    );
    const [rows] = await db.query('SELECT a.*, u.name as author_name FROM announcements a JOIN users u ON a.author_id=u.id WHERE a.id=?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.remove = async (req, res) => {
  try {
    await db.query('DELETE FROM announcements WHERE id=? AND club_id=?', [req.params.id, req.user.club_id]);
    res.json({ message: 'Obavještenje obrisano' });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};
