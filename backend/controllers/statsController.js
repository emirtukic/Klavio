const db = require('../config/db');

exports.getPlayerStats = async (req, res) => {
  try {
    const memberId = req.params.memberId;
    const [rows] = await db.query(`
      SELECT ps.*, m.match_date, m.opponent, m.result, m.goals_for, m.goals_against
      FROM player_stats ps JOIN matches m ON ps.match_id = m.id
      WHERE ps.member_id = ? AND ps.club_id = ?
      ORDER BY m.match_date DESC
    `, [memberId, req.user.club_id]);
    const totals = rows.reduce((acc, r) => ({
      goals: acc.goals + r.goals,
      assists: acc.assists + r.assists,
      yellow_cards: acc.yellow_cards + r.yellow_cards,
      red_cards: acc.red_cards + r.red_cards,
      minutes_played: acc.minutes_played + r.minutes_played,
      matches: acc.matches + 1
    }), { goals: 0, assists: 0, yellow_cards: 0, red_cards: 0, minutes_played: 0, matches: 0 });
    res.json({ stats: rows, totals });
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.getClubStats = async (req, res) => {
  try {
    const selId = (req.user.role === 'coach' || req.user.role === 'member')
      ? (req.user.selection_id || null)
      : (req.query.selection_id || null);

    if (req.user.role === 'coach' && !selId) {
      return res.json({ topScorers: [], attendance: [], matchResults: [] });
    }
    const mSel = selId ? ' AND m.selection_id = ?' : '';
    const sSel = selId ? ' AND selection_id = ?' : '';

    const scorerParams = [req.user.club_id];
    if (selId) scorerParams.push(selId);
    const [topScorers] = await db.query(`
      SELECT u.name, m.id as member_id, SUM(ps.goals) as goals, SUM(ps.assists) as assists,
             SUM(ps.yellow_cards) as yellow_cards, SUM(ps.red_cards) as red_cards,
             SUM(ps.minutes_played) as minutes_played, COUNT(*) as matches,
             s.name AS selection_name
      FROM player_stats ps
      JOIN members m ON ps.member_id = m.id
      JOIN users u ON m.user_id = u.id
      LEFT JOIN selections s ON m.selection_id = s.id
      WHERE ps.club_id = ?${mSel}
      GROUP BY ps.member_id, s.name
      ORDER BY goals DESC LIMIT 10
    `, scorerParams);

    const attParams = [req.user.club_id];
    if (selId) attParams.push(selId);
    attParams.push(req.user.club_id);
    if (selId) attParams.push(selId);
    attParams.push(req.user.club_id);
    if (selId) attParams.push(selId);
    const [attendance] = await db.query(`
      SELECT u.name, m.id as member_id,
        COUNT(ta.id) as present_count,
        (SELECT COUNT(*) FROM training_sessions WHERE club_id = ?${sSel} AND status != 'cancelled') as total_sessions
      FROM members m
      JOIN users u ON m.user_id = u.id
      LEFT JOIN training_attendance ta ON ta.member_id = m.id AND ta.status = 'present'
        AND ta.session_id IN (SELECT id FROM training_sessions WHERE club_id = ?${sSel})
      WHERE m.club_id = ?${mSel}
      GROUP BY m.id ORDER BY present_count DESC
    `, attParams);

    const matchParams = [req.user.club_id];
    if (selId) matchParams.push(selId);
    const [matchResults] = await db.query(`
      SELECT result, COUNT(*) as count FROM matches WHERE club_id = ?${sSel} AND result != 'pending' GROUP BY result
    `, matchParams);

    res.json({ topScorers, attendance, matchResults });
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.upsertStats = async (req, res) => {
  const { member_id, goals, assists, yellow_cards, red_cards, minutes_played, started } = req.body;
  const match_id = req.params.matchId;
  try {
    await db.query(`
      INSERT INTO player_stats (member_id, match_id, club_id, goals, assists, yellow_cards, red_cards, minutes_played, started)
      VALUES (?,?,?,?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE goals=VALUES(goals), assists=VALUES(assists), yellow_cards=VALUES(yellow_cards),
        red_cards=VALUES(red_cards), minutes_played=VALUES(minutes_played), started=VALUES(started)
    `, [member_id, match_id, req.user.club_id, goals||0, assists||0, yellow_cards||0, red_cards||0, minutes_played||90, started??true]);
    res.json({ message: 'Statistika ažurirana' });
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.getMatchStats = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT ps.*, u.name, m.membership_number, m.jersey_number, m.position
      FROM player_stats ps
      JOIN members m ON ps.member_id = m.id
      JOIN users u ON m.user_id = u.id
      WHERE ps.match_id = ? AND ps.club_id = ?
    `, [req.params.matchId, req.user.club_id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.getOverview = async (req, res) => {
  try {
    const selId = (req.user.role === 'coach' || req.user.role === 'member')
      ? (req.user.selection_id || null)
      : (req.query.selection_id || null);

    if (req.user.role === 'coach' && !selId) {
      return res.json({ matches_played: 0, goals_for: 0, goals_against: 0, wins: 0, draws: 0, losses: 0, win_pct: 0, training_sessions: 0, avg_attendance_pct: 0 });
    }
    const sel = selId ? ' AND selection_id = ?' : '';
    const p = [req.user.club_id];
    if (selId) p.push(selId);

    const [[matches]] = await db.query(
      `SELECT COUNT(*) AS played,
        COALESCE(SUM(goals_for),0) AS goals_for,
        COALESCE(SUM(goals_against),0) AS goals_against,
        COUNT(CASE WHEN result='win'  THEN 1 END) AS wins,
        COUNT(CASE WHEN result='draw' THEN 1 END) AS draws,
        COUNT(CASE WHEN result='loss' THEN 1 END) AS losses
       FROM matches WHERE club_id=?${sel} AND result != 'pending'`, p);

    const [[att]] = await db.query(
      `SELECT COUNT(DISTINCT ts.id) AS sessions,
        COUNT(CASE WHEN ta.status='present' THEN 1 END) AS present_count,
        COUNT(ta.id) AS total_records
       FROM training_sessions ts
       LEFT JOIN training_attendance ta ON ta.session_id = ts.id
       WHERE ts.club_id=?${sel}`, p);

    const played = parseInt(matches.played || 0);
    const wins   = parseInt(matches.wins   || 0);
    const pr     = parseInt(att.present_count || 0);
    const tr     = parseInt(att.total_records || 0);
    res.json({
      matches_played:     played,
      goals_for:          parseInt(matches.goals_for || 0),
      goals_against:      parseInt(matches.goals_against || 0),
      wins,
      draws:              parseInt(matches.draws || 0),
      losses:             parseInt(matches.losses || 0),
      win_pct:            played > 0 ? Math.round(wins / played * 100) : 0,
      training_sessions:  parseInt(att.sessions || 0),
      avg_attendance_pct: tr > 0 ? Math.round(pr / tr * 100) : 0
    });
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};

exports.getAttendanceStats = async (req, res) => {
  try {
    const selId = (req.user.role === 'coach' || req.user.role === 'member')
      ? (req.user.selection_id || null)
      : (req.query.selection_id || null);

    if (req.user.role === 'coach' && !selId) {
      return res.json([]);
    }
    // params order: [subquery: club_id, (selId)], [outer: club_id, (selId)]
    const params = [req.user.club_id];
    if (selId) params.push(selId);
    params.push(req.user.club_id);
    if (selId) params.push(selId);
    const [rows] = await db.query(`
      SELECT m.id, u.name,
        SUM(CASE WHEN ta.status='present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN ta.status='absent' THEN 1 ELSE 0 END) as absent,
        SUM(CASE WHEN ta.status='excused' THEN 1 ELSE 0 END) as excused,
        COUNT(ta.id) as total,
        s.name AS selection_name
      FROM members m
      JOIN users u ON m.user_id = u.id
      LEFT JOIN training_attendance ta ON ta.member_id = m.id
        AND ta.session_id IN (SELECT id FROM training_sessions WHERE club_id = ?${selId ? ' AND selection_id = ?' : ''})
      LEFT JOIN selections s ON m.selection_id = s.id
      WHERE m.club_id = ?${selId ? ' AND m.selection_id = ?' : ''}
      GROUP BY m.id, s.name ORDER BY u.name
    `, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
};
