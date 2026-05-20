const db = require('../config/db');

exports.getStats = async (req, res) => {
  try {
    const [[counts]] = await db.query(`
      SELECT
        COUNT(*)                                                                   AS total_clubs,
        SUM(c.is_active = 1)                                                      AS active_clubs,
        SUM(c.is_active = 0)                                                      AS inactive_clubs,
        SUM(cs.plan = 'starter')                                                  AS free_clubs,
        SUM(cs.status = 'active')                                                 AS paying_clubs,
        SUM(cs.status = 'overdue')                                                AS overdue_clubs,
        SUM(cs.status = 'cancelled')                                              AS cancelled_clubs,
        COALESCE(SUM(CASE WHEN cs.status='active' AND cs.billing_cycle='monthly' THEN cs.price
                          WHEN cs.status='active' AND cs.billing_cycle='yearly'  THEN cs.price/12
                          ELSE 0 END), 0)                                         AS mrr,
        (SELECT COUNT(*) FROM members)                                             AS total_members,
        (SELECT COUNT(*) FROM coaches)                                             AS total_coaches,
        (SELECT COUNT(*) FROM users WHERE role='admin')                            AS total_admins,
        SUM(CASE WHEN c.created_at >= DATE_FORMAT(NOW(),'%Y-%m-01') THEN 1 ELSE 0 END) AS new_clubs_month
      FROM clubs c
      LEFT JOIN club_subscriptions cs ON cs.club_id = c.id
    `);

    const [byPlan] = await db.query(`
      SELECT cs.plan, COUNT(*) AS count, SUM(cs.price) AS revenue
      FROM club_subscriptions cs
      WHERE cs.status = 'active'
      GROUP BY cs.plan
    `);

    const [revenueByMonth] = await db.query(`
      SELECT DATE_FORMAT(cs.current_period_start,'%Y-%m') AS month, SUM(cs.price) AS revenue
      FROM club_subscriptions cs
      WHERE cs.status='active' AND cs.current_period_start >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY month ORDER BY month
    `);

    const [clubsGrowth] = await db.query(`
      SELECT DATE_FORMAT(created_at,'%Y-%m') AS month, COUNT(*) AS count
      FROM clubs
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY month ORDER BY month
    `);

    const [clubs] = await db.query(`
      SELECT c.id, c.name, c.slug, c.logo_url, c.is_active, c.created_at,
        cs.plan, cs.status AS sub_status, cs.price, cs.billing_cycle,
        cs.trial_ends_at, cs.current_period_end, cs.notes,
        COUNT(DISTINCT CASE WHEN u.role='member' THEN u.id END) AS member_count,
        COUNT(DISTINCT CASE WHEN u.role='coach'  THEN u.id END) AS coach_count,
        COUNT(DISTINCT CASE WHEN u.role='admin'  THEN u.id END) AS admin_count
      FROM clubs c
      LEFT JOIN club_subscriptions cs ON cs.club_id = c.id
      LEFT JOIN users u ON u.club_id = c.id
      GROUP BY c.id ORDER BY c.created_at DESC
    `);

    res.json({
      ...counts,
      mrr: parseFloat(counts.mrr || 0),
      arr: parseFloat(counts.mrr || 0) * 12,
      byPlan,
      revenueByMonth,
      clubsGrowth,
      clubs
    });
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.getSubscription = async (req, res) => {
  try {
    const [[sub]] = await db.query(
      'SELECT cs.*, c.name AS club_name FROM club_subscriptions cs JOIN clubs c ON cs.club_id=c.id WHERE cs.club_id=?',
      [req.params.clubId]
    );
    res.json(sub || null);
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.upsertSubscription = async (req, res) => {
  const { plan, price, billing_cycle, status, trial_ends_at, current_period_start, current_period_end, notes } = req.body;
  const clubId = req.params.clubId;
  try {
    await db.query(`
      INSERT INTO club_subscriptions (club_id, plan, price, billing_cycle, status, trial_ends_at, current_period_start, current_period_end, notes)
      VALUES (?,?,?,?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE
        plan=VALUES(plan), price=VALUES(price), billing_cycle=VALUES(billing_cycle),
        status=VALUES(status), trial_ends_at=VALUES(trial_ends_at),
        current_period_start=VALUES(current_period_start), current_period_end=VALUES(current_period_end),
        notes=VALUES(notes)
    `, [clubId, plan, price, billing_cycle, status, trial_ends_at||null, current_period_start||null, current_period_end||null, notes||null]);
    res.json({ message: 'Pretplata ažurirana' });
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.getMySubscription = async (req, res) => {
  try {
    const [[sub]] = await db.query(
      'SELECT cs.*, c.name AS club_name FROM club_subscriptions cs JOIN clubs c ON cs.club_id=c.id WHERE cs.club_id=?',
      [req.user.club_id]
    );
    res.json(sub || null);
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.getAllSubscriptions = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT cs.*, c.name AS club_name, c.logo_url, c.is_active,
        COUNT(DISTINCT CASE WHEN u.role='member' THEN u.id END) AS member_count
      FROM club_subscriptions cs
      JOIN clubs c ON cs.club_id=c.id
      LEFT JOIN users u ON u.club_id=c.id
      GROUP BY cs.id ORDER BY cs.status, c.name
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};
