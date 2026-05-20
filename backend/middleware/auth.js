const jwt = require('jsonwebtoken');
const db = require('../config/db');

module.exports = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);

    // Always fetch current selection_id from DB so reassignments take effect immediately
    if (req.user.club_id && (req.user.role === 'coach' || req.user.role === 'member')) {
      const table = req.user.role === 'coach' ? 'coaches' : 'members';
      const [rows] = await db.query(
        `SELECT selection_id FROM ${table} WHERE user_id = ? AND club_id = ?`,
        [req.user.id, req.user.club_id]
      );
      req.user.selection_id = rows[0]?.selection_id ?? null;
    }

    // Check club status and subscription for non-super_admin users
    if (req.user.role !== 'super_admin' && req.user.club_id) {
      const [[club]] = await db.query(`
        SELECT c.is_active, cs.plan, cs.status AS sub_status, cs.current_period_end
        FROM clubs c
        LEFT JOIN club_subscriptions cs ON cs.club_id = c.id
        WHERE c.id = ?
        ORDER BY cs.id DESC
        LIMIT 1
      `, [req.user.club_id]);

      if (club && !club.is_active) {
        return res.status(403).json({ code: 'CLUB_INACTIVE', message: 'Klub je deaktiviran' });
      }

      if (club && club.plan && club.plan !== 'starter') {
        const expired = club.sub_status === 'cancelled' ||
          (club.current_period_end && new Date(club.current_period_end) < new Date());
        if (expired) {
          return res.status(403).json({
            code: 'SUBSCRIPTION_EXPIRED',
            message: 'Pretplata je istekla',
            expired_at: club.current_period_end,
            plan: club.plan
          });
        }
      }
    }

    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
};
