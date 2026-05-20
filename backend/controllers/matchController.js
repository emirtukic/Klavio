const db = require('../config/db');
const { notifyMatchCreated } = require('../services/matchNotificationService');

function selScope(req) {
  if (req.user.role === 'coach' || req.user.role === 'member') {
    // always restrict; no selection assigned → show nothing
    if (req.user.selection_id)
      return { clause: ' AND selection_id = ?', param: req.user.selection_id };
    return { clause: ' AND 1=0', param: null };
  }
  // Admins may optionally filter by selection via query param
  const selId = req.query.selection_id || null;
  return selId ? { clause: ' AND selection_id = ?', param: selId } : { clause: '', param: null };
}

exports.getAll = async (req, res) => {
  try {
    const sel = selScope(req);
    const params = [req.user.club_id];
    if (sel.param) params.push(sel.param);
    const [rows] = await db.query(
      `SELECT m.*, s.name AS selection_name
       FROM matches m
       LEFT JOIN selections s ON m.selection_id = s.id
       WHERE m.club_id = ?${sel.clause}
       ORDER BY m.match_date DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM matches WHERE id = ? AND club_id = ?', [req.params.id, req.user.club_id]);
    if (!rows.length) return res.status(404).json({ message: 'Utakmica nije pronađena' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.create = async (req, res) => {
  const { opponent, location, match_date, match_type, home_away, notes, selection_id } = req.body;
  // Coaches are locked to their own selection; admins choose freely
  const selId = req.user.role === 'coach'
    ? req.user.selection_id
    : (selection_id || null);
  if (req.user.role === 'coach' && !selId)
    return res.status(400).json({ message: 'Trener mora biti dodijeljen selekciji' });
  try {
    const [result] = await db.query(
      'INSERT INTO matches (opponent, location, match_date, match_type, home_away, notes, club_id, selection_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [opponent, location, match_date, match_type || 'league', home_away || 'home', notes, req.user.club_id, selId]
    );
    notifyMatchCreated(
      { opponent, location, match_date, match_type, home_away },
      req.user.club_id, selId, req.user.id
    ).catch(() => {});
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.update = async (req, res) => {
  const { opponent, location, match_date, match_type, home_away, result, goals_for, goals_against, notes } = req.body;
  const coachClause = (req.user.role === 'coach' && req.user.selection_id) ? ' AND selection_id = ?' : '';
  const params = [opponent, location, match_date, match_type, home_away, result, goals_for, goals_against, notes, req.params.id, req.user.club_id];
  if (coachClause) params.push(req.user.selection_id);
  try {
    await db.query(
      `UPDATE matches SET opponent=COALESCE(?,opponent), location=COALESCE(?,location), match_date=COALESCE(?,match_date), match_type=COALESCE(?,match_type), home_away=COALESCE(?,home_away), result=COALESCE(?,result), goals_for=COALESCE(?,goals_for), goals_against=COALESCE(?,goals_against), notes=COALESCE(?,notes) WHERE id=? AND club_id=?${coachClause}`,
      params
    );
    res.json({ message: 'Utakmica ažurirana' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.remove = async (req, res) => {
  const coachClause = (req.user.role === 'coach' && req.user.selection_id) ? ' AND selection_id = ?' : '';
  const params = [req.params.id, req.user.club_id];
  if (coachClause) params.push(req.user.selection_id);
  try {
    await db.query(`DELETE FROM matches WHERE id = ? AND club_id = ?${coachClause}`, params);
    res.json({ message: 'Utakmica obrisana' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.getStandings = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        s.id, s.name, s.description,
        COUNT(CASE WHEN m.result IN ('win','draw','loss') THEN 1 END) as played,
        COUNT(CASE WHEN m.result = 'win'  THEN 1 END) as wins,
        COUNT(CASE WHEN m.result = 'draw' THEN 1 END) as draws,
        COUNT(CASE WHEN m.result = 'loss' THEN 1 END) as losses,
        COALESCE(SUM(CASE WHEN m.result IN ('win','draw','loss') THEN m.goals_for   ELSE 0 END), 0) as gf,
        COALESCE(SUM(CASE WHEN m.result IN ('win','draw','loss') THEN m.goals_against ELSE 0 END), 0) as ga
      FROM selections s
      LEFT JOIN matches m ON m.selection_id = s.id AND m.club_id = s.club_id
      WHERE s.club_id = ?
      GROUP BY s.id, s.name, s.description
    `, [req.user.club_id]);

    const table = rows.map(r => ({
      ...r,
      gd: Number(r.gf) - Number(r.ga),
      points: Number(r.wins) * 3 + Number(r.draws)
    })).sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);

    res.json(table);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
