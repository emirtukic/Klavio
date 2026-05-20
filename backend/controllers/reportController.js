const db = require('../config/db');

exports.getFinancialReport = async (req, res) => {
  try {
    const [monthly] = await db.query(`
      SELECT
        DATE_FORMAT(mf.period_start, '%Y-%m') as month,
        SUM(CASE WHEN mf.status='paid' THEN mf.amount ELSE 0 END) as collected,
        SUM(CASE WHEN mf.status!='paid' THEN mf.amount ELSE 0 END) as outstanding,
        COUNT(*) as total_fees
      FROM membership_fees mf
      JOIN members m ON mf.member_id = m.id
      WHERE m.club_id = ?
      GROUP BY month ORDER BY month DESC LIMIT 12
    `, [req.user.club_id]);
    const [summary] = await db.query(`
      SELECT
        SUM(CASE WHEN mf.status='paid' THEN mf.amount ELSE 0 END) as total_collected,
        SUM(CASE WHEN mf.status='overdue' THEN mf.amount ELSE 0 END) as total_overdue,
        COUNT(DISTINCT CASE WHEN mf.status='paid' THEN mf.member_id END) as members_paid,
        COUNT(DISTINCT CASE WHEN mf.status='overdue' THEN mf.member_id END) as members_overdue
      FROM membership_fees mf
      JOIN members m ON mf.member_id = m.id
      WHERE m.club_id = ?
    `, [req.user.club_id]);
    res.json({ monthly, summary: summary[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.getAttendanceReport = async (req, res) => {
  try {
    const [stats] = await db.query(`
      SELECT ts.title, ts.session_date,
        COUNT(ta.id) as total_attendees,
        SUM(CASE WHEN ta.status='present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN ta.status='absent' THEN 1 ELSE 0 END) as absent,
        SUM(CASE WHEN ta.status='excused' THEN 1 ELSE 0 END) as excused
      FROM training_sessions ts
      LEFT JOIN training_attendance ta ON ts.id = ta.session_id
      WHERE ts.club_id = ?
      GROUP BY ts.id ORDER BY ts.session_date DESC LIMIT 20
    `, [req.user.club_id]);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.getSelectionStats = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT s.id, s.name,
        COUNT(DISTINCT m.id) AS member_count,
        COALESCE(SUM(CASE WHEN mf.status='paid'             THEN mf.amount ELSE 0 END), 0) AS collected,
        COALESCE(SUM(CASE WHEN mf.status IN ('unpaid','overdue') THEN mf.amount ELSE 0 END), 0) AS outstanding
      FROM selections s
      LEFT JOIN members m  ON m.selection_id = s.id AND m.club_id = s.club_id
      LEFT JOIN membership_fees mf ON mf.member_id = m.id
      WHERE s.club_id = ?
      GROUP BY s.id, s.name ORDER BY s.name
    `, [req.user.club_id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.getTopDebtors = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT u.name, m.membership_number, sel.name AS selection_name,
        COALESCE(SUM(mf.amount), 0) AS total_owed,
        COUNT(mf.id) AS fee_count
      FROM members m
      JOIN users u ON m.user_id = u.id
      LEFT JOIN selections sel ON m.selection_id = sel.id
      JOIN membership_fees mf ON mf.member_id = m.id
      WHERE m.club_id = ? AND mf.status IN ('unpaid', 'overdue')
      GROUP BY m.id ORDER BY total_owed DESC LIMIT 10
    `, [req.user.club_id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.getMembersGrowth = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT DATE_FORMAT(m.join_date, '%Y-%m') AS month, COUNT(*) AS new_members
      FROM members m
      WHERE m.club_id = ? AND m.join_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
      GROUP BY month ORDER BY month
    `, [req.user.club_id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.getMemberReport = async (req, res) => {
  try {
    const [stats] = await db.query(`
      SELECT COUNT(*) as total_members,
        SUM(CASE WHEN m.status='active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN m.status='inactive' THEN 1 ELSE 0 END) as inactive,
        SUM(CASE WHEN m.status='suspended' THEN 1 ELSE 0 END) as suspended
      FROM members m
      WHERE m.club_id = ?
    `, [req.user.club_id]);
    const [recentJoins] = await db.query(`
      SELECT u.name, m.join_date, m.status, m.membership_number
      FROM members m JOIN users u ON m.user_id = u.id
      WHERE m.club_id = ?
      ORDER BY m.join_date DESC LIMIT 10
    `, [req.user.club_id]);
    res.json({ stats: stats[0], recentJoins });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
