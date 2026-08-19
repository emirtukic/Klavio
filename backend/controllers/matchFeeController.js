const db = require('../config/db');

exports.getAll = async (req, res) => {
  try {
    const { match_id } = req.query;
    let where = 'mf.club_id = ?';
    const params = [req.user.club_id];
    if (match_id) { where += ' AND mf.match_id = ?'; params.push(match_id); }
    const [rows] = await db.query(
      `SELECT mf.*, u.name AS member_name, mt.opponent, mt.match_date
       FROM match_fees mf
       LEFT JOIN members m  ON mf.member_id = m.id
       LEFT JOIN users u    ON m.user_id = u.id
       LEFT JOIN matches mt ON mf.match_id  = mt.id
       WHERE ${where}
       ORDER BY mt.match_date DESC, u.name ASC`,
      params
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.getStats = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
         COUNT(*)                                          AS total_count,
         COALESCE(SUM(amount), 0)                         AS total,
         COALESCE(SUM(CASE WHEN status='paid'    THEN amount ELSE 0 END), 0) AS paid,
         COALESCE(SUM(CASE WHEN status='pending' THEN amount ELSE 0 END), 0) AS pending,
         COALESCE(SUM(CASE WHEN status='overdue' THEN amount ELSE 0 END), 0) AS overdue
       FROM match_fees WHERE club_id = ?`,
      [req.user.club_id]
    );
    const s = rows[0];
    res.json({
      total:   parseFloat(s.total   || 0),
      paid:    parseFloat(s.paid    || 0),
      pending: parseFloat(s.pending || 0),
      overdue: parseFloat(s.overdue || 0),
      total_count: s.total_count || 0
    });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.create = async (req, res) => {
  const { match_id, member_id, member_ids, amount, notes } = req.body;
  if (!match_id || !amount) return res.status(400).json({ message: 'match_id i amount su obavezni' });

  try {
    // Bulk create - array of member IDs
    if (Array.isArray(member_ids) && member_ids.length > 0) {
      const values = member_ids.map(mid => [req.user.club_id, mid, match_id, amount, 'pending', notes || null]);
      await db.query(
        'INSERT INTO match_fees (club_id, member_id, match_id, amount, status, notes) VALUES ?',
        [values]
      );
      return res.status(201).json({ message: `${member_ids.length} naknada kreirano` });
    }

    // Single create
    if (!member_id) return res.status(400).json({ message: 'member_id ili member_ids[] je obavezan' });
    const [result] = await db.query(
      'INSERT INTO match_fees (club_id, member_id, match_id, amount, status, notes) VALUES (?,?,?,?,?,?)',
      [req.user.club_id, member_id, match_id, amount, 'pending', notes || null]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.update = async (req, res) => {
  const { status, paid_date, notes, amount } = req.body;
  try {
    await db.query(
      `UPDATE match_fees
       SET status    = COALESCE(?, status),
           paid_date = COALESCE(?, paid_date),
           notes     = COALESCE(?, notes),
           amount    = COALESCE(?, amount)
       WHERE id = ? AND club_id = ?`,
      [status || null, paid_date || null, notes !== undefined ? notes : null, amount || null, req.params.id, req.user.club_id]
    );
    const [rows] = await db.query('SELECT * FROM match_fees WHERE id = ? AND club_id = ?', [req.params.id, req.user.club_id]);
    if (!rows.length) return res.status(404).json({ message: 'Naknada nije pronađena' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.remove = async (req, res) => {
  try {
    await db.query('DELETE FROM match_fees WHERE id = ? AND club_id = ?', [req.params.id, req.user.club_id]);
    res.json({ message: 'Naknada obrisana' });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};
