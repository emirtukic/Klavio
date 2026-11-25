const db = require('../config/db');

exports.getFinancialReport = async (req, res) => {
  try {
    // "Collected" is sourced from the finances ledger, not membership_fees
    // directly, so it always matches Finansije - including income already
    // received from a member who has since been deleted (membership_fees
    // loses that row on delete, but the payment was real and already
    // happened). "Outstanding" can only ever belong to a currently existing
    // member, so that side still comes from membership_fees.
    const [collectedRows] = await db.query(`
      SELECT DATE_FORMAT(f.date, '%Y-%m') as month, SUM(f.amount) as collected, COUNT(*) as fee_count
      FROM finances f
      WHERE f.club_id = ? AND f.type = 'income' AND f.category = 'Članarine'
      GROUP BY month
    `, [req.user.club_id]);
    const [outstandingRows] = await db.query(`
      SELECT DATE_FORMAT(mf.period_start, '%Y-%m') as month, SUM(mf.amount) as outstanding, COUNT(*) as fee_count
      FROM membership_fees mf
      JOIN members m ON mf.member_id = m.id
      WHERE m.club_id = ? AND mf.status != 'paid'
      GROUP BY month
    `, [req.user.club_id]);

    const monthMap = {};
    collectedRows.forEach(r => {
      monthMap[r.month] = { month: r.month, collected: parseFloat(r.collected), outstanding: 0, total_fees: Number(r.fee_count) };
    });
    outstandingRows.forEach(r => {
      if (!monthMap[r.month]) monthMap[r.month] = { month: r.month, collected: 0, outstanding: 0, total_fees: 0 };
      monthMap[r.month].outstanding = parseFloat(r.outstanding);
      monthMap[r.month].total_fees += Number(r.fee_count);
    });
    const monthly = Object.values(monthMap).sort((a, b) => b.month.localeCompare(a.month)).slice(0, 12);

    const [[collectedSummary]] = await db.query(`
      SELECT COALESCE(SUM(amount),0) as total_collected
      FROM finances WHERE club_id = ? AND type = 'income' AND category = 'Članarine'
    `, [req.user.club_id]);
    const [[overdueSummary]] = await db.query(`
      SELECT
        COALESCE(SUM(CASE WHEN mf.status='overdue' THEN mf.amount ELSE 0 END), 0) as total_overdue,
        COUNT(DISTINCT CASE WHEN mf.status='paid' THEN mf.member_id END) as members_paid,
        COUNT(DISTINCT CASE WHEN mf.status='overdue' THEN mf.member_id END) as members_overdue
      FROM membership_fees mf
      JOIN members m ON mf.member_id = m.id
      WHERE m.club_id = ?
    `, [req.user.club_id]);

    res.json({
      monthly,
      summary: {
        total_collected: parseFloat(collectedSummary.total_collected),
        total_overdue: parseFloat(overdueSummary.total_overdue),
        members_paid: overdueSummary.members_paid,
        members_overdue: overdueSummary.members_overdue,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
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
    res.status(500).json({ message: 'Server error' });
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
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
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
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
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
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
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
    res.status(500).json({ message: 'Server error' });
  }
};
