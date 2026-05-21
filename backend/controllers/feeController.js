const db = require('../config/db');

exports.getAll = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT mf.*, u.name as member_name, m.membership_number
      FROM membership_fees mf
      JOIN members m ON mf.member_id = m.id
      JOIN users u ON m.user_id = u.id
      WHERE m.club_id = ?
      ORDER BY mf.due_date DESC
    `, [req.user.club_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.getMemberFees = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM membership_fees WHERE member_id = ? ORDER BY period_start DESC',
      [req.params.memberId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.create = async (req, res) => {
  const { member_id, amount, period_start, period_end, due_date, payment_method, notes } = req.body;
  try {
    const [result] = await db.query(
      'INSERT INTO membership_fees (member_id, amount, period_start, period_end, due_date, payment_method, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [member_id, amount, period_start, period_end, due_date, payment_method, notes, req.user.id]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.update = async (req, res) => {
  const { status, paid_date, payment_method, notes, amount } = req.body;
  try {
    // Fetch current state before update
    const [before] = await db.query(
      'SELECT mf.*, m.club_id, u.name as member_name FROM membership_fees mf JOIN members m ON mf.member_id = m.id JOIN users u ON m.user_id = u.id WHERE mf.id = ?',
      [req.params.id]
    );
    const fee = before[0];

    await db.query(
      'UPDATE membership_fees SET status=COALESCE(?,status), paid_date=COALESCE(?,paid_date), payment_method=COALESCE(?,payment_method), notes=COALESCE(?,notes), amount=COALESCE(?,amount) WHERE id=?',
      [status, paid_date, payment_method, notes, amount, req.params.id]
    );

    // Auto-create finance income entry when marked as paid
    if (status === 'paid' && fee && fee.status !== 'paid') {
      await autoAddIncome(fee, paid_date || new Date().toISOString().slice(0, 10), req.user.id);
    }

    res.json({ message: 'Članarina ažurirana' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.markPaid = async (req, res) => {
  const { payment_method } = req.body;
  try {
    const [before] = await db.query(
      'SELECT mf.*, m.club_id, u.name as member_name FROM membership_fees mf JOIN members m ON mf.member_id = m.id JOIN users u ON m.user_id = u.id WHERE mf.id = ?',
      [req.params.id]
    );
    const fee = before[0];

    await db.query(
      'UPDATE membership_fees SET status="paid", paid_date=CURDATE(), payment_method=? WHERE id=?',
      [payment_method || 'cash', req.params.id]
    );

    if (fee && fee.status !== 'paid') {
      await autoAddIncome(fee, new Date().toISOString().slice(0, 10), req.user.id);
    }

    res.json({ message: 'Označeno kao plaćeno' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

async function autoAddIncome(fee, date, userId) {
  // Avoid duplicates - skip if a finance entry already references this fee
  const [exists] = await db.query(
    "SELECT id FROM finances WHERE club_id = ? AND reference = ? LIMIT 1",
    [fee.club_id, `CLN-${fee.id}`]
  );
  if (exists.length > 0) return;

  const periodStr = fee.period_start
    ? new Date(fee.period_start).toISOString().slice(0, 7)
    : null;
  const description = `Članarina - ${fee.member_name || 'član'}${periodStr ? ` (${periodStr})` : ''}`;

  await db.query(
    'INSERT INTO finances (club_id, type, category, description, amount, date, reference, created_by) VALUES (?,?,?,?,?,?,?,?)',
    [fee.club_id, 'income', 'Članarine', description, fee.amount, date, `CLN-${fee.id}`, userId]
  );
}

exports.remove = async (req, res) => {
  try {
    await db.query('DELETE FROM membership_fees WHERE id = ?', [req.params.id]);
    res.json({ message: 'Članarina obrisana' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.getStats = async (req, res) => {
  try {
    const [stats] = await db.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN mf.status='paid' THEN 1 ELSE 0 END) as paid,
        SUM(CASE WHEN mf.status='pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN mf.status='overdue' THEN 1 ELSE 0 END) as overdue,
        SUM(CASE WHEN mf.status='paid' THEN mf.amount ELSE 0 END) as total_collected,
        SUM(CASE WHEN mf.status!='paid' THEN mf.amount ELSE 0 END) as total_outstanding
      FROM membership_fees mf
      JOIN members m ON mf.member_id = m.id
      WHERE m.club_id = ?
    `, [req.user.club_id]);
    res.json(stats[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
