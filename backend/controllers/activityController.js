const db = require('../config/db');

// Pre-fetch entity name before DELETE while entity still exists in DB
const ENTITY_LOOKUP = {
  'Član':      async (id) => { const [[r]] = await db.query('SELECT u.name FROM members m JOIN users u ON m.user_id=u.id WHERE m.id=?', [id]); return r?.name; },
  'Utakmica':  async (id) => { const [[r]] = await db.query('SELECT opponent FROM matches WHERE id=?', [id]); return r?.opponent; },
  'Trening':   async (id) => { const [[r]] = await db.query('SELECT title FROM training_sessions WHERE id=?', [id]); return r?.title; },
  'Članarina': async (id) => { const [[r]] = await db.query('SELECT u.name, mf.amount FROM membership_fees mf JOIN members m ON mf.member_id=m.id JOIN users u ON m.user_id=u.id WHERE mf.id=?', [id]); return r ? `${r.name} - ${r.amount} KM` : null; },
  'Finansije': async (id) => { const [[r]] = await db.query('SELECT description, amount FROM finances WHERE id=?', [id]); return r ? `${r.description || ''}${r.amount ? ' - ' + r.amount + ' KM' : ''}`.trim() : null; },
  'Selekcija': async (id) => { const [[r]] = await db.query('SELECT name FROM selections WHERE id=?', [id]); return r?.name; },
  'Trener':    async (id) => { const [[r]] = await db.query('SELECT COALESCE(c.name, u.name) AS name FROM coaches c LEFT JOIN users u ON c.user_id=u.id WHERE c.id=?', [id]); return r?.name; },
  'Obavijest': async (id) => { const [[r]] = await db.query('SELECT title FROM announcements WHERE id=?', [id]); return r?.title; },
};

function buildLogDetails(action, entityType, resBody, reqBody, prefetchedName) {
  if (action === 'delete') {
    return prefetchedName ? `Obrisano: ${prefetchedName}` : 'Obrisano';
  }

  const verb = action === 'create' ? 'Dodano' : 'Ažurirano';

  switch (entityType) {
    case 'Član': {
      const name = prefetchedName || resBody?.name || reqBody?.name || '';
      const email = resBody?.email || reqBody?.email || '';
      return `${verb}: ${name}${email ? ' (' + email + ')' : ''}`;
    }
    case 'Trening': {
      const title = resBody?.title || reqBody?.title || '';
      const date = resBody?.date || reqBody?.date || '';
      return `${verb}: ${title}${date ? ' (' + date + ')' : ''}`;
    }
    case 'Utakmica': {
      const opp = prefetchedName || resBody?.opponent || reqBody?.opponent || '';
      const date = resBody?.date || reqBody?.date || '';
      return `${verb}: vs ${opp}${date ? ' (' + date + ')' : ''}`;
    }
    case 'Članarina': {
      const member = prefetchedName || resBody?.member_name || reqBody?.member_name || '';
      const amount = resBody?.amount || reqBody?.amount || '';
      return `${verb}: ${member}${amount ? ' - ' + amount + ' KM' : ''}`;
    }
    case 'Finansije': {
      const desc = prefetchedName || resBody?.description || reqBody?.description || reqBody?.category || '';
      const amount = resBody?.amount || reqBody?.amount || '';
      return `${verb}: ${desc}${amount ? ' - ' + amount + ' KM' : ''}`;
    }
    case 'Selekcija': {
      const name = prefetchedName || resBody?.name || reqBody?.name || '';
      return `${verb}: ${name}`;
    }
    case 'Trener': {
      const name = prefetchedName || resBody?.name || reqBody?.name || '';
      return `${verb}: ${name}`;
    }
    case 'Obavijest': {
      const title = prefetchedName || resBody?.title || reqBody?.title || '';
      return `${verb}: "${title}"`;
    }
    default: {
      const name = prefetchedName || resBody?.name || resBody?.title || reqBody?.name || reqBody?.title || '';
      return name ? `${verb}: ${name}` : verb;
    }
  }
}

exports.getAllPlatform = async (req, res) => {
  try {
    const { limit = 500 } = req.query;
    const [rows] = await db.query(
      `SELECT al.* FROM activity_log al ORDER BY al.created_at DESC LIMIT ?`,
      [parseInt(limit)]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
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
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.log = (action, entityType) => async (req, res, next) => {
  let prefetchedName = null;

  // Pre-fetch entity name before DELETE while it still exists
  if (action === 'delete' && req.params.id && ENTITY_LOOKUP[entityType]) {
    try { prefetchedName = await ENTITY_LOOKUP[entityType](req.params.id); } catch (_) {}
  }

  const orig = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode < 400 && req.user) {
      const details = buildLogDetails(action, entityType, body, req.body || {}, prefetchedName);
      db.query(
        'INSERT INTO activity_log (club_id, user_id, user_name, action, entity_type, entity_id, details) VALUES (?,?,?,?,?,?,?)',
        [req.user.club_id, req.user.id, req.user.name, action, entityType,
         body?.id || req.params.id || null,
         details.slice(0, 500)]
      ).catch(() => {});
    }
    return orig(body);
  };
  next();
};
