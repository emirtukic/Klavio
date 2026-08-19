const db = require('../config/db');

exports.getAll = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT i.*, c.name AS club_name, c.logo_url
      FROM invoices i JOIN clubs c ON c.id = i.club_id
      ORDER BY i.created_at DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.getMine = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM invoices WHERE club_id=? ORDER BY created_at DESC',
      [req.user.club_id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.create = async (req, res) => {
  const { club_id, invoice_number, amount, status, due_date, paid_date, period_start, period_end, notes } = req.body;
  try {
    const [result] = await db.query(
      'INSERT INTO invoices (club_id, invoice_number, amount, status, due_date, paid_date, period_start, period_end, notes) VALUES (?,?,?,?,?,?,?,?,?)',
      [club_id, invoice_number, amount, status || 'unpaid', due_date, paid_date || null, period_start || null, period_end || null, notes || null]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.update = async (req, res) => {
  const { status, paid_date, notes } = req.body;
  try {
    await db.query(
      'UPDATE invoices SET status=COALESCE(?,status), paid_date=COALESCE(?,paid_date), notes=COALESCE(?,notes) WHERE id=?',
      [status, paid_date || null, notes, req.params.id]
    );
    res.json({ message: 'Faktura ažurirana' });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.remove = async (req, res) => {
  try {
    await db.query('DELETE FROM invoices WHERE id=?', [req.params.id]);
    res.json({ message: 'Obrisano' });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};
