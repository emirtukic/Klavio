const db = require('../config/db');

function parseRange(query) {
  const now = new Date();
  let from = query.from;
  let to   = query.to;
  if (!from || !to) {
    const preset = query.preset || '6m';
    to = now.toISOString().slice(0, 10);
    const map = { '7d': 7, '30d': 30, '3m': 90, '6m': 180, '1y': 365, '2y': 730 };
    const days = map[preset] || 180;
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    from = d.toISOString().slice(0, 10);
  }
  return { from, to };
}

exports.summary = async (req, res) => {
  const { from, to } = parseRange(req.query);
  try {
    const [[inv]] = await db.query(`
      SELECT
        COALESCE(SUM(CASE WHEN status='paid' THEN amount ELSE 0 END), 0)   AS total_paid,
        COALESCE(SUM(CASE WHEN status='unpaid' THEN amount ELSE 0 END), 0)  AS total_unpaid,
        COUNT(*)                                                              AS total_invoices,
        COUNT(CASE WHEN status='paid' THEN 1 END)                           AS paid_invoices,
        COALESCE(AVG(CASE WHEN status='paid' THEN amount END), 0)           AS avg_invoice
      FROM invoices
      WHERE created_at BETWEEN ? AND DATE_ADD(?, INTERVAL 1 DAY)
    `, [from, to]);

    const [[clubs]] = await db.query(`
      SELECT
        COUNT(*) AS total,
        SUM(is_active=1) AS active,
        SUM(is_active=0) AS inactive
      FROM clubs
      WHERE created_at BETWEEN ? AND DATE_ADD(?, INTERVAL 1 DAY)
    `, [from, to]);

    const [[members]] = await db.query(`
      SELECT COUNT(*) AS total
      FROM members
      WHERE join_date BETWEEN ? AND DATE_ADD(?, INTERVAL 1 DAY)
    `, [from, to]);

    res.json({
      revenue: {
        total_paid:    parseFloat(inv.total_paid    || 0),
        total_unpaid:  parseFloat(inv.total_unpaid  || 0),
        total_invoices: parseInt(inv.total_invoices || 0),
        paid_invoices:  parseInt(inv.paid_invoices  || 0),
        avg_invoice:   parseFloat(inv.avg_invoice   || 0),
      },
      clubs: {
        total:    parseInt(clubs.total    || 0),
        active:   parseInt(clubs.active   || 0),
        inactive: parseInt(clubs.inactive || 0),
      },
      new_members: parseInt(members.total || 0),
    });
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.revenue = async (req, res) => {
  const { from, to } = parseRange(req.query);
  try {
    const [rows] = await db.query(`
      SELECT
        DATE_FORMAT(period_start, '%Y-%m') AS month,
        SUM(CASE WHEN status='paid'   THEN amount ELSE 0 END) AS paid,
        SUM(CASE WHEN status='unpaid' THEN amount ELSE 0 END) AS unpaid,
        COUNT(*) AS invoice_count
      FROM invoices
      WHERE period_start BETWEEN ? AND DATE_ADD(?, INTERVAL 1 DAY)
      GROUP BY month
      ORDER BY month
    `, [from, to]);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.clubsGrowth = async (req, res) => {
  const { from, to } = parseRange(req.query);
  try {
    const [rows] = await db.query(`
      SELECT
        DATE_FORMAT(created_at, '%Y-%m') AS month,
        COUNT(*) AS new_clubs,
        SUM(is_active=1) AS active
      FROM clubs
      WHERE created_at BETWEEN ? AND DATE_ADD(?, INTERVAL 1 DAY)
      GROUP BY month
      ORDER BY month
    `, [from, to]);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.subscriptions = async (req, res) => {
  try {
    const [byPlan] = await db.query(`
      SELECT plan, status, COUNT(*) AS count, SUM(price) AS total_price
      FROM club_subscriptions
      GROUP BY plan, status
      ORDER BY plan, status
    `);

    const [byStatus] = await db.query(`
      SELECT status, COUNT(*) AS count, COALESCE(SUM(price),0) AS total_price
      FROM club_subscriptions
      GROUP BY status
    `);

    const [byCycle] = await db.query(`
      SELECT billing_cycle, COUNT(*) AS count, COALESCE(SUM(price),0) AS total_price
      FROM club_subscriptions
      WHERE status='active'
      GROUP BY billing_cycle
    `);

    res.json({ byPlan, byStatus, byCycle });
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.topClubs = async (req, res) => {
  const limit  = parseInt(req.query.limit  || 10);
  const sortBy = req.query.sort_by || 'members';
  const { from, to } = parseRange(req.query);

  const orderClause = sortBy === 'revenue'
    ? 'club_revenue DESC'
    : 'member_count DESC';

  try {
    const [rows] = await db.query(`
      SELECT
        c.id, c.name, c.logo_url, c.created_at, c.is_active,
        cs.plan, cs.status AS sub_status, cs.price, cs.billing_cycle,
        COUNT(DISTINCT m.id)                                             AS member_count,
        COUNT(DISTINCT co.id)                                            AS coach_count,
        COALESCE(SUM(CASE WHEN i.status='paid' THEN i.amount ELSE 0 END), 0) AS club_revenue,
        COUNT(DISTINCT i.id)                                             AS invoice_count
      FROM clubs c
      LEFT JOIN club_subscriptions cs ON cs.club_id = c.id
      LEFT JOIN members m  ON m.club_id = c.id
      LEFT JOIN coaches co ON co.club_id = c.id
      LEFT JOIN invoices i ON i.club_id = c.id AND i.created_at BETWEEN ? AND DATE_ADD(?, INTERVAL 1 DAY)
      GROUP BY c.id
      ORDER BY ${orderClause}
      LIMIT ?
    `, [from, to, limit]);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.membersGrowth = async (req, res) => {
  const { from, to } = parseRange(req.query);
  try {
    const [rows] = await db.query(`
      SELECT
        DATE_FORMAT(join_date, '%Y-%m') AS month,
        COUNT(*) AS new_members
      FROM members
      WHERE join_date BETWEEN ? AND DATE_ADD(?, INTERVAL 1 DAY)
      GROUP BY month
      ORDER BY month
    `, [from, to]);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.formsStats = async (req, res) => {
  const { from, to } = parseRange(req.query);
  try {
    // Total fills in period
    const [[totals]] = await db.query(`
      SELECT COUNT(*) AS total_fills,
             COUNT(DISTINCT club_id) AS clubs_using
      FROM form_history
      WHERE filled_at BETWEEN ? AND DATE_ADD(?, INTERVAL 1 DAY)
    `, [from, to]);

    // Fills per form type
    const [byType] = await db.query(`
      SELECT form_type, form_name, COUNT(*) AS fills
      FROM form_history
      WHERE filled_at BETWEEN ? AND DATE_ADD(?, INTERVAL 1 DAY)
      GROUP BY form_type, form_name
      ORDER BY fills DESC
    `, [from, to]);

    // Fills per club (top 10)
    const [byClub] = await db.query(`
      SELECT fh.club_id, c.name AS club_name, COUNT(*) AS fills
      FROM form_history fh
      JOIN clubs c ON c.id = fh.club_id
      WHERE fh.filled_at BETWEEN ? AND DATE_ADD(?, INTERVAL 1 DAY)
      GROUP BY fh.club_id, c.name
      ORDER BY fills DESC
      LIMIT 10
    `, [from, to]);

    // Monthly trend
    const [monthly] = await db.query(`
      SELECT DATE_FORMAT(filled_at, '%Y-%m') AS month, COUNT(*) AS fills
      FROM form_history
      WHERE filled_at BETWEEN ? AND DATE_ADD(?, INTERVAL 1 DAY)
      GROUP BY month
      ORDER BY month ASC
    `, [from, to]);

    // All-time total and unique clubs
    const [[allTime]] = await db.query(`
      SELECT COUNT(*) AS total_fills, COUNT(DISTINCT club_id) AS clubs_ever
      FROM form_history
    `);

    res.json({
      period: { total_fills: +totals.total_fills, clubs_using: +totals.clubs_using },
      all_time: { total_fills: +allTime.total_fills, clubs_ever: +allTime.clubs_ever },
      by_type: byType.map(r => ({ form_type: r.form_type, form_name: r.form_name, fills: +r.fills })),
      by_club: byClub.map(r => ({ club_id: r.club_id, club_name: r.club_name, fills: +r.fills })),
      monthly: monthly.map(r => ({ month: r.month, fills: +r.fills })),
    });
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.platformHealth = async (req, res) => {
  try {
    const [[clubs]]   = await db.query('SELECT COUNT(*) AS total, COALESCE(SUM(is_active),0) AS active FROM clubs');
    const [[members]] = await db.query('SELECT COUNT(*) AS total FROM members');
    const [[coaches]] = await db.query('SELECT COUNT(*) AS total FROM coaches');
    const [[subs]]    = await db.query(`
      SELECT
        COUNT(*) AS active_count,
        COALESCE(SUM(CASE WHEN billing_cycle='monthly' THEN price ELSE price/12 END), 0) AS mrr
      FROM club_subscriptions WHERE status = 'active'
    `);
    const [[health]]  = await db.query(`
      SELECT
        COUNT(CASE WHEN status='active'    THEN 1 END) AS active,
        COUNT(CASE WHEN status='overdue'   THEN 1 END) AS overdue,
        COUNT(CASE WHEN status='cancelled' THEN 1 END) AS cancelled,
        COUNT(*) AS total
      FROM club_subscriptions
    `);
    const [[invoiceTotals]] = await db.query(`
      SELECT
        COALESCE(SUM(CASE WHEN status='paid'    THEN amount ELSE 0 END), 0) AS total_paid,
        COALESCE(SUM(CASE WHEN status='unpaid'  THEN amount ELSE 0 END), 0) AS total_unpaid,
        COALESCE(SUM(CASE WHEN status='overdue' THEN amount ELSE 0 END), 0) AS total_overdue,
        COUNT(*) AS total
      FROM invoices
    `);
    res.json({
      clubs:   { total: +clubs.total,   active: +clubs.active },
      members: +members.total,
      coaches: +coaches.total,
      subscriptions: { active: +subs.active_count, mrr: parseFloat(subs.mrr || 0), health },
      invoices: {
        total_paid:    parseFloat(invoiceTotals.total_paid    || 0),
        total_unpaid:  parseFloat(invoiceTotals.total_unpaid  || 0),
        total_overdue: parseFloat(invoiceTotals.total_overdue || 0),
        total: +invoiceTotals.total
      }
    });
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};
