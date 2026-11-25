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
        `SELECT id, selection_id FROM ${table} WHERE user_id = ? AND club_id = ?`,
        [req.user.id, req.user.club_id]
      );
      // The member/coach row is gone (account deleted) - the old token should
      // stop working immediately instead of limping along with no selection.
      if (!rows.length) return res.status(401).json({ message: 'Nalog više ne postoji' });
      req.user.selection_id = rows[0]?.selection_id ?? null;

      // selection_ids = primary + any additional selections this person was
      // assigned to - used by read sites that decide what they're allowed to
      // see, kept separate from the untouched single selection_id above so
      // every existing single-selection read site is unaffected.
      req.user.selection_ids = [];
      if (rows[0]) {
        const joinTable = req.user.role === 'coach' ? 'coach_selections' : 'member_selections';
        const idCol = req.user.role === 'coach' ? 'coach_id' : 'member_id';
        const [joined] = await db.query(
          `SELECT selection_id FROM ${joinTable} WHERE ${idCol} = ?`,
          [rows[0].id]
        );
        req.user.selection_ids = [...new Set(
          [req.user.selection_id, ...joined.map(j => j.selection_id)].filter(Boolean)
        )];
      }
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

      // Expose the club's current plan so route-level plan gating (requirePlan)
      // doesn't need a second DB round-trip per request.
      req.user.plan = club?.plan || 'starter';
    }

    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
};
