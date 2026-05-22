const db  = require('../db');
const sse = require('../services/sseManager');

/* ─── helpers ─────────────────────────────────────────────────────── */

// Which event types affect the score
function isGoalEvent(type) {
  return ['goal', 'own_goal', 'penalty'].includes(type);
}

// Re-derive goals_for / goals_against from events
async function recalcScore(matchId) {
  const [[r]] = await db.query(`
    SELECT
      SUM(CASE WHEN event_type IN ('goal','penalty') AND is_opponent = 0 THEN 1 ELSE 0 END) AS gf,
      SUM(CASE WHEN event_type IN ('goal','penalty') AND is_opponent = 1 THEN 1 ELSE 0 END) +
      SUM(CASE WHEN event_type = 'own_goal'                              THEN 1 ELSE 0 END) AS ga
    FROM match_events WHERE match_id = ?`, [matchId]);
  return { gf: r.gf || 0, ga: r.ga || 0 };
}

// Full events list for a match
async function fetchEvents(matchId) {
  const [rows] = await db.query(
    `SELECT * FROM match_events WHERE match_id = ? ORDER BY id ASC`, [matchId]);
  return rows;
}

/* ─── GET /api/live-match/active ──────────────────────────────────── */
async function getActive(req, res) {
  try {
    const { role, club_id, selection_id } = req.user;
    const params = [club_id];
    let selFilter = '';
    if ((role === 'coach' || role === 'member') && selection_id) {
      selFilter = 'AND m.selection_id = ?';
      params.push(selection_id);
    }

    const [rows] = await db.query(`
      SELECT m.id, m.opponent, m.home_away, m.match_type,
             m.goals_for, m.goals_against, m.status, m.started_at,
             m.selection_id, s.name AS selection_name,
             (SELECT e.event_type FROM match_events e
              WHERE e.match_id = m.id ORDER BY e.id DESC LIMIT 1) AS last_event_type,
             (SELECT e.member_name_cache FROM match_events e
              WHERE e.match_id = m.id ORDER BY e.id DESC LIMIT 1) AS last_event_player,
             (SELECT e.minute FROM match_events e
              WHERE e.match_id = m.id ORDER BY e.id DESC LIMIT 1) AS last_event_minute,
             (SELECT e.is_opponent FROM match_events e
              WHERE e.match_id = m.id ORDER BY e.id DESC LIMIT 1) AS last_event_opponent
      FROM matches m
      LEFT JOIN selections s ON s.id = m.selection_id
      WHERE m.club_id = ? AND m.status IN ('live','paused') ${selFilter}
      ORDER BY m.started_at DESC`, params);

    res.json(rows);
  } catch (e) { res.status(500).json({ message: e.message }); }
}

/* ─── GET /api/live-match/:matchId ────────────────────────────────── */
async function getState(req, res) {
  try {
    const { matchId } = req.params;
    const { club_id } = req.user;

    const [[match]] = await db.query(`
      SELECT m.*, s.name AS selection_name
      FROM matches m LEFT JOIN selections s ON s.id = m.selection_id
      WHERE m.id = ? AND m.club_id = ?`, [matchId, club_id]);
    if (!match) return res.status(404).json({ message: 'Utakmica nije pronađena' });

    const events  = await fetchEvents(matchId);
    const players = await loadPlayers(matchId, match.selection_id, club_id);

    res.json({ match, events, players });
  } catch (e) { res.status(500).json({ message: e.message }); }
}

/* ─── GET /api/live-match/:matchId/stream  (SSE) ──────────────────── */
async function stream(req, res) {
  const { matchId } = req.params;
  const { club_id }  = req.user;

  const [[match]] = await db.query(
    `SELECT id, status FROM matches WHERE id = ? AND club_id = ?`, [matchId, club_id]);
  if (!match) return res.status(404).json({ message: 'Not found' });

  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Send initial snapshot
  try {
    const [[m]] = await db.query(`
      SELECT m.*, s.name AS selection_name
      FROM matches m LEFT JOIN selections s ON s.id = m.selection_id
      WHERE m.id = ?`, [matchId]);
    const events = await fetchEvents(matchId);
    res.write(`data: ${JSON.stringify({ type: 'init', match: m, events })}\n\n`);
  } catch (_) {}

  sse.subscribe(matchId, res);

  const hb = setInterval(() => {
    try { res.write(': ping\n\n'); } catch (_) { clearInterval(hb); }
  }, 25000);

  req.on('close', () => { clearInterval(hb); sse.unsubscribe(matchId, res); });
}

/* ─── POST /api/live-match/:matchId/start ─────────────────────────── */
async function startMatch(req, res) {
  try {
    const { matchId } = req.params;
    const { club_id } = req.user;

    const [[m]] = await db.query(
      `SELECT * FROM matches WHERE id = ? AND club_id = ?`, [matchId, club_id]);
    if (!m) return res.status(404).json({ message: 'Utakmica nije pronađena' });
    if (m.status !== 'scheduled')
      return res.status(400).json({ message: 'Utakmica je već aktivna ili završena' });

    await db.query(
      `UPDATE matches SET status='live', started_at=NOW(), goals_for=0, goals_against=0 WHERE id=?`,
      [matchId]);

    const [[updated]] = await db.query(`SELECT * FROM matches WHERE id=?`, [matchId]);
    sse.broadcast(matchId, { type: 'started', match: updated, events: [] });
    res.json({ ok: true, match: updated });
  } catch (e) { res.status(500).json({ message: e.message }); }
}

/* ─── POST /api/live-match/:matchId/pause  (half-time) ────────────── */
async function pauseMatch(req, res) {
  try {
    const { matchId } = req.params;
    const { club_id } = req.user;

    const [[m]] = await db.query(
      `SELECT * FROM matches WHERE id=? AND club_id=?`, [matchId, club_id]);
    if (!m) return res.status(404).json({ message: 'Not found' });

    await db.query(`UPDATE matches SET status='paused' WHERE id=?`, [matchId]);

    await db.query(
      `INSERT INTO match_events (match_id, event_type, minute, score_for, score_against)
       VALUES (?, 'half_time', 45, ?, ?)`,
      [matchId, m.goals_for, m.goals_against]);

    const events = await fetchEvents(matchId);
    sse.broadcast(matchId, { type: 'paused', events,
      score_for: m.goals_for, score_against: m.goals_against });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
}

/* ─── POST /api/live-match/:matchId/resume ────────────────────────── */
async function resumeMatch(req, res) {
  try {
    const { matchId } = req.params;
    const { club_id } = req.user;
    await db.query(`UPDATE matches SET status='live' WHERE id=? AND club_id=?`, [matchId, club_id]);
    sse.broadcast(matchId, { type: 'resumed' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
}

/* ─── POST /api/live-match/:matchId/end ───────────────────────────── */
async function endMatch(req, res) {
  try {
    const { matchId } = req.params;
    const { club_id } = req.user;
    const minute = req.body.minute || 90;

    const [[m]] = await db.query(
      `SELECT * FROM matches WHERE id=? AND club_id=?`, [matchId, club_id]);
    if (!m) return res.status(404).json({ message: 'Not found' });

    let result = 'draw';
    if (m.goals_for > m.goals_against) result = 'win';
    if (m.goals_for < m.goals_against) result = 'loss';

    await db.query(
      `UPDATE matches SET status='finished', result=? WHERE id=?`, [result, matchId]);

    await db.query(
      `INSERT INTO match_events (match_id, event_type, minute, score_for, score_against)
       VALUES (?, 'full_time', ?, ?, ?)`,
      [matchId, minute, m.goals_for, m.goals_against]);

    const events = await fetchEvents(matchId);
    sse.broadcast(matchId, {
      type: 'ended', result,
      score_for: m.goals_for, score_against: m.goals_against, events
    });
    res.json({ ok: true, result });
  } catch (e) { res.status(500).json({ message: e.message }); }
}

/* ─── POST /api/live-match/:matchId/events ────────────────────────── */
async function addEvent(req, res) {
  try {
    const { matchId } = req.params;
    const { club_id } = req.user;
    const {
      event_type, minute = 0, extra_minute = 0,
      member_id, member_id_2, is_opponent = false, notes
    } = req.body;

    const [[m]] = await db.query(
      `SELECT * FROM matches WHERE id=? AND club_id=?`, [matchId, club_id]);
    if (!m) return res.status(404).json({ message: 'Not found' });
    if (!['live','paused'].includes(m.status))
      return res.status(400).json({ message: 'Utakmica nije aktivna' });

    // Cache player names
    let name1 = null, name2 = null;
    if (member_id) {
      const [[mem]] = await db.query(
        `SELECT CONCAT(first_name,' ',last_name) AS n FROM members WHERE id=? AND club_id=?`,
        [member_id, club_id]);
      name1 = mem ? mem.n : null;
    }
    if (member_id_2) {
      const [[mem]] = await db.query(
        `SELECT CONCAT(first_name,' ',last_name) AS n FROM members WHERE id=? AND club_id=?`,
        [member_id_2, club_id]);
      name2 = mem ? mem.n : null;
    }

    // Update score if goal-type event
    let gf = m.goals_for, ga = m.goals_against;
    if (event_type === 'goal' || event_type === 'penalty') {
      if (is_opponent) { ga++; await db.query(`UPDATE matches SET goals_against=goals_against+1 WHERE id=?`, [matchId]); }
      else             { gf++; await db.query(`UPDATE matches SET goals_for=goals_for+1 WHERE id=?`,     [matchId]); }
    } else if (event_type === 'own_goal') {
      ga++; await db.query(`UPDATE matches SET goals_against=goals_against+1 WHERE id=?`, [matchId]);
    }

    const [ins] = await db.query(`
      INSERT INTO match_events
        (match_id, event_type, minute, extra_minute, member_id, member_name_cache,
         member_id_2, member_name_2_cache, is_opponent, score_for, score_against, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [matchId, event_type, minute, extra_minute,
       member_id || null, name1, member_id_2 || null, name2,
       is_opponent ? 1 : 0, gf, ga, notes || null]);

    const [[event]] = await db.query(`SELECT * FROM match_events WHERE id=?`, [ins.insertId]);

    sse.broadcast(matchId, { type: 'event', event, score_for: gf, score_against: ga });
    res.json({ ok: true, event, score_for: gf, score_against: ga });
  } catch (e) { res.status(500).json({ message: e.message }); }
}

/* ─── DELETE /api/live-match/:matchId/events/:eventId ─────────────── */
async function deleteEvent(req, res) {
  try {
    const { matchId, eventId } = req.params;
    const { club_id } = req.user;

    const [[m]] = await db.query(
      `SELECT id FROM matches WHERE id=? AND club_id=?`, [matchId, club_id]);
    if (!m) return res.status(404).json({ message: 'Not found' });

    await db.query(
      `DELETE FROM match_events WHERE id=? AND match_id=?`, [eventId, matchId]);

    // Recalculate score from surviving events
    const { gf, ga } = await recalcScore(matchId);
    await db.query(`UPDATE matches SET goals_for=?, goals_against=? WHERE id=?`, [gf, ga, matchId]);

    const events = await fetchEvents(matchId);
    sse.broadcast(matchId, {
      type: 'event_deleted', eventId: parseInt(eventId),
      events, score_for: gf, score_against: ga
    });
    res.json({ ok: true, score_for: gf, score_against: ga });
  } catch (e) { res.status(500).json({ message: e.message }); }
}

/* ─── helper: load player list for a match ────────────────────────── */
async function loadPlayers(matchId, selectionId, clubId) {
  if (!selectionId) return [];
  const [lineup] = await db.query(`
    SELECT ml.member_id, CONCAT(m.first_name,' ',m.last_name) AS name,
           ml.position, ml.is_starter, ml.jersey_number
    FROM match_lineup ml JOIN members m ON m.id = ml.member_id
    WHERE ml.match_id = ?
    ORDER BY ml.is_starter DESC, m.first_name`, [matchId]);

  if (lineup.length) return lineup;

  const [all] = await db.query(`
    SELECT id AS member_id, CONCAT(first_name,' ',last_name) AS name,
           NULL AS position, 1 AS is_starter, NULL AS jersey_number
    FROM members
    WHERE selection_id=? AND club_id=? AND status='active'
    ORDER BY first_name`, [selectionId, clubId]);
  return all;
}

module.exports = {
  getActive, getState, stream,
  startMatch, pauseMatch, resumeMatch, endMatch,
  addEvent, deleteEvent
};
