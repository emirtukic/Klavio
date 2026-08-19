const db  = require('../config/db');
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

/* ─── shared: finish a match (manual end + auto-end reuse this) ───── */
async function finishMatch(matchId, clubId, minute = 90) {
  const [[m]] = await db.query(
    `SELECT * FROM matches WHERE id=? AND club_id=?`, [matchId, clubId]);
  if (!m || m.status === 'finished') return null;

  let result = 'draw';
  if (m.goals_for > m.goals_against) result = 'win';
  if (m.goals_for < m.goals_against) result = 'loss';

  const [upd] = await db.query(
    `UPDATE matches SET status='finished', result=? WHERE id=? AND status != 'finished'`,
    [result, matchId]);
  if (!upd.affectedRows) return null; // another call already finished it

  await db.query(
    `INSERT INTO match_events (match_id, event_type, minute, score_for, score_against)
     VALUES (?, 'full_time', ?, ?, ?)`,
    [matchId, minute, m.goals_for, m.goals_against]);

  const events = await fetchEvents(matchId);
  sse.broadcast(matchId, {
    type: 'ended', result,
    score_for: m.goals_for, score_against: m.goals_against, events
  });

  // Auto-generate player_stats from match_events
  let statsErr = null;
  try {
    await autoStats(matchId, clubId);
  } catch (err) {
    statsErr = err.message;
    console.error('[autoStats] Failed for match', matchId, ':', err.message);
  }

  return { result, statsErr };
}

/* ─── POST /api/live-match/:matchId/end ───────────────────────────── */
async function endMatch(req, res) {
  try {
    const { matchId } = req.params;
    const { club_id } = req.user;
    const minute = req.body.minute || 90;

    const outcome = await finishMatch(matchId, club_id, minute);
    if (!outcome) return res.status(404).json({ message: 'Not found' });

    res.json({ ok: true, result: outcome.result, statsErr: outcome.statsErr });
  } catch (e) { res.status(500).json({ message: e.message }); }
}

/* ─── auto-end matches nobody closed out ────────────────────────────
   started_at is wall-clock, not "playing time" - it keeps ticking through
   half-time and stoppage time. 90 min of regulation + ~15 min half-time
   break + stoppage time routinely adds up to 110-120 real minutes, so a
   flat 90-minute cutoff would auto-end matches that are still genuinely
   in progress. 150 min gives real matches plenty of room while still
   catching ones that were simply forgotten (the bug this was written for
   involved a match stuck for months). */
async function autoEndStaleMatches() {
  try {
    const [stale] = await db.query(`
      SELECT id, club_id FROM matches
      WHERE status IN ('live','paused')
        AND started_at IS NOT NULL
        AND started_at <= (NOW() - INTERVAL 150 MINUTE)
    `);
    for (const { id, club_id } of stale) {
      try {
        console.log(`[autoEndStale] Auto-ending stale match ${id} (club ${club_id})`);
        await finishMatch(id, club_id, 90);
      } catch (e) {
        console.error(`[autoEndStale] Failed to end match ${id}:`, e.message);
      }
    }
  } catch (e) {
    console.error('[autoEndStale] Failed:', e.message);
  }
}

/* ─── POST /api/live-match/:matchId/events ────────────────────────── */
async function addEvent(req, res) {
  try {
    const { matchId } = req.params;
    const { club_id } = req.user;
    const {
      event_type, minute = 0, extra_minute = 0,
      member_id, member_id_2, is_opponent = false, notes, member_name
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
        `SELECT u.name AS n FROM members m JOIN users u ON u.id = m.user_id WHERE m.id=? AND m.club_id=?`,
        [member_id, club_id]);
      name1 = mem ? mem.n : null;
    } else if (member_name) {
      name1 = String(member_name).trim().slice(0, 100) || null;
    }
    if (member_id_2) {
      const [[mem]] = await db.query(
        `SELECT u.name AS n FROM members m JOIN users u ON u.id = m.user_id WHERE m.id=? AND m.club_id=?`,
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

/* ─── helper: auto-generate player_stats from match_events ────────── */
async function autoStats(matchId, clubId) {
  console.log(`[autoStats] Running for match=${matchId} club=${clubId}`);
  const [events] = await db.query(
    `SELECT * FROM match_events WHERE match_id = ? AND is_opponent = 0`, [matchId]);

  const statsMap = {};

  for (const e of events) {
    if (!e.member_id) continue;
    if (!statsMap[e.member_id]) statsMap[e.member_id] = { goals: 0, yellow_cards: 0, red_cards: 0, started: 0, subbed_off_at: null, subbed_on_at: null };
    const s = statsMap[e.member_id];
    if (e.event_type === 'goal' || e.event_type === 'penalty') s.goals++;
    if (e.event_type === 'yellow_card') s.yellow_cards++;
    if (e.event_type === 'red_card')    s.red_cards++;
    if (e.event_type === 'substitution') s.subbed_off_at = e.minute;
    if (e.event_type === 'substitution' && e.member_id_2) {
      if (!statsMap[e.member_id_2]) statsMap[e.member_id_2] = { goals: 0, yellow_cards: 0, red_cards: 0, started: 0, subbed_off_at: null, subbed_on_at: null };
      statsMap[e.member_id_2].subbed_on_at = e.minute;
    }
  }

  // Mark starters from lineup if exists
  const [lineup] = await db.query(`SELECT member_id, is_starter FROM match_lineup WHERE match_id = ?`, [matchId]);
  for (const l of lineup) {
    if (!statsMap[l.member_id]) statsMap[l.member_id] = { goals: 0, yellow_cards: 0, red_cards: 0, started: 0, subbed_off_at: null, subbed_on_at: null };
    if (l.is_starter) statsMap[l.member_id].started = 1;
  }

  const entries = Object.entries(statsMap);
  console.log(`[autoStats] Upserting stats for ${entries.length} player(s)`);
  for (const [memberId, s] of entries) {
    let mins = 90;
    if (s.subbed_off_at !== null) mins = s.subbed_off_at;
    else if (s.subbed_on_at !== null) mins = Math.max(1, 90 - s.subbed_on_at);

    await db.query(`
      INSERT INTO player_stats (member_id, match_id, club_id, goals, assists, yellow_cards, red_cards, minutes_played, started)
      VALUES (?,?,?,?,0,?,?,?,?)
      ON DUPLICATE KEY UPDATE
        goals=VALUES(goals), yellow_cards=VALUES(yellow_cards),
        red_cards=VALUES(red_cards), minutes_played=VALUES(minutes_played), started=VALUES(started)
    `, [memberId, matchId, clubId, s.goals, s.yellow_cards, s.red_cards, mins, s.started]);
  }
  console.log(`[autoStats] Done for match=${matchId}`);
}

/* ─── helper: load player list for a match ────────────────────────── */
async function loadPlayers(matchId, selectionId, clubId) {
  if (!selectionId) return [];
  const [lineup] = await db.query(`
    SELECT ml.member_id, u.name,
           ml.position, ml.is_starter, ml.jersey_number
    FROM match_lineup ml
    JOIN members m ON m.id = ml.member_id
    JOIN users u ON u.id = m.user_id
    WHERE ml.match_id = ?
    ORDER BY ml.is_starter DESC, u.name`, [matchId]);

  if (lineup.length) return lineup;

  const [all] = await db.query(`
    SELECT m.id AS member_id, u.name,
           NULL AS position, 1 AS is_starter, NULL AS jersey_number
    FROM members m JOIN users u ON u.id = m.user_id
    WHERE m.selection_id=? AND m.club_id=? AND m.status='active'
    ORDER BY u.name`, [selectionId, clubId]);
  return all;
}

module.exports = {
  getActive, getState, stream,
  startMatch, pauseMatch, resumeMatch, endMatch,
  addEvent, deleteEvent, autoEndStaleMatches
};
