const db = require('../config/db');

exports.getAllPlatform = async (req, res) => {
  try {
    const { limit = 500 } = req.query;
    const [rows] = await db.query(
      `SELECT al.* FROM activity_log al ORDER BY al.created_at DESC LIMIT ?`,
      [parseInt(limit)]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.getAll = async (req, res) => {
  try {
    const { from, to, user_name, entity_type, limit = 200 } = req.query;
    let where = 'club_id = ?';
    const params = [req.user.club_id];
    if (from)        { where += ' AND DATE(created_at) >= ?'; params.push(from); }
    if (to)          { where += ' AND DATE(created_at) <= ?'; params.push(to); }
    if (user_name)   { where += ' AND user_name LIKE ?'; params.push(`%${user_name}%`); }
    if (entity_type) { where += ' AND entity_type = ?'; params.push(entity_type); }
    const [rows] = await db.query(
      `SELECT * FROM activity_log WHERE ${where} ORDER BY created_at DESC LIMIT ?`,
      [...params, parseInt(limit)]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

// Middleware to log an action — call after successful operations
exports.log = (action, entityType) => async (req, res, next) => {
  // This is a post-response hook — attach to routes
  const orig = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode < 400 && req.user) {
      db.query(
        'INSERT INTO activity_log (club_id, user_id, user_name, action, entity_type, entity_id, details) VALUES (?,?,?,?,?,?,?)',
        [req.user.club_id, req.user.id, req.user.name, action, entityType, body?.id || req.params.id || null, JSON.stringify(body).slice(0, 500)]
      ).catch(() => {});
    }
    return orig(body);
  };
  next();
};
