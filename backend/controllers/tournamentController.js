const db = require('../config/db');
const { createNotification } = require('./notificationController');
const { send: sendMail } = require('../config/mailer');
const { renderEmail } = require('../config/emailTemplateStore');
const { notifyMatchCreated } = require('../services/matchNotificationService');

const MAIL_ENABLED = !!(process.env.MAIL_USER && process.env.BREVO_API_KEY);
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('bs-BA') : '-';
}

async function getTournamentSelectionIds(tournamentId) {
  const [rows] = await db.query('SELECT selection_id FROM tournament_selections WHERE tournament_id=?', [tournamentId]);
  return rows.map(r => r.selection_id);
}

// A coach may only act on a tournament that includes at least one of their own selections.
async function tournamentInCoachScope(req, tournamentId) {
  if (req.user.role !== 'coach') return true;
  const ids = req.user.selection_ids || [];
  if (!ids.length) return false;
  const [rows] = await db.query(
    `SELECT 1 FROM tournament_selections ts
     JOIN tournaments t ON t.id = ts.tournament_id
     WHERE ts.tournament_id=? AND t.club_id=? AND ts.selection_id IN (?) LIMIT 1`,
    [tournamentId, req.user.club_id, ids]
  );
  return rows.length > 0;
}

exports.getAll = async (req, res) => {
  try {
    const ids = req.user.selection_ids || [];
    const coachFilter = req.user.role === 'coach'
      ? (ids.length ? ' AND EXISTS (SELECT 1 FROM tournament_selections ts WHERE ts.tournament_id=t.id AND ts.selection_id IN (?))' : ' AND 1=0')
      : '';
    const params = [req.user.club_id];
    if (req.user.role === 'coach' && ids.length) params.push(ids);
    const [rows] = await db.query(`
      SELECT t.*,
        (SELECT GROUP_CONCAT(s.name ORDER BY s.name SEPARATOR ', ') FROM tournament_selections ts JOIN selections s ON s.id=ts.selection_id WHERE ts.tournament_id=t.id) as selection_names,
        (SELECT COUNT(*) FROM matches m WHERE m.tournament_id=t.id) as match_count,
        (SELECT COUNT(*) FROM member_availability ma WHERE ma.event_type='tournament' AND ma.event_id=t.id) as invited_count,
        (SELECT COUNT(*) FROM member_availability ma WHERE ma.event_type='tournament' AND ma.event_id=t.id AND ma.status='yes') as confirmed_count
      FROM tournaments t
      WHERE t.club_id = ?${coachFilter}
      ORDER BY t.date_start DESC
    `, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getMine = async (req, res) => {
  try {
    const [[member]] = await db.query('SELECT id FROM members WHERE user_id=? AND club_id=?', [req.user.id, req.user.club_id]);
    if (!member) return res.json([]);
    const [rows] = await db.query(`
      SELECT t.*,
        (SELECT GROUP_CONCAT(s.name ORDER BY s.name SEPARATOR ', ') FROM tournament_selections ts JOIN selections s ON s.id=ts.selection_id WHERE ts.tournament_id=t.id) as selection_names,
        ma.status as rsvp_status, ma.note as rsvp_note,
        tef.status as fee_status, tef.amount as fee_amount
      FROM member_availability ma
      JOIN tournaments t ON t.id = ma.event_id AND ma.event_type = 'tournament'
      LEFT JOIN tournament_entry_fees tef ON tef.tournament_id = t.id AND tef.member_id = ma.member_id
      WHERE ma.member_id = ?
      ORDER BY t.date_start DESC
    `, [member.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getOne = async (req, res) => {
  try {
    const [[tournament]] = await db.query('SELECT * FROM tournaments WHERE id = ? AND club_id = ?', [req.params.id, req.user.club_id]);
    if (!tournament) return res.status(404).json({ message: 'Turnir nije pronađen' });

    if (req.user.role === 'member') {
      const [[member]] = await db.query('SELECT id FROM members WHERE user_id=? AND club_id=?', [req.user.id, req.user.club_id]);
      const [[invited]] = member ? await db.query(
        `SELECT 1 FROM member_availability WHERE event_type='tournament' AND event_id=? AND member_id=? LIMIT 1`,
        [tournament.id, member.id]
      ) : [[null]];
      if (!invited) return res.status(404).json({ message: 'Turnir nije pronađen' });
    } else if (!(await tournamentInCoachScope(req, tournament.id))) {
      return res.status(404).json({ message: 'Turnir nije pronađen' });
    }

    const [selections] = await db.query(
      'SELECT s.id, s.name FROM tournament_selections ts JOIN selections s ON s.id = ts.selection_id WHERE ts.tournament_id=? ORDER BY s.name',
      [tournament.id]
    );
    const [matches] = await db.query(
      'SELECT m.*, s.name as selection_name FROM matches m LEFT JOIN selections s ON s.id = m.selection_id WHERE m.tournament_id=? ORDER BY m.match_date',
      [tournament.id]
    );
    const [invited] = await db.query(`
      SELECT m.id as member_id, u.name as member_name,
        ma.status as rsvp_status, ma.note as rsvp_note,
        tef.id as fee_id, tef.amount as fee_amount, tef.status as fee_status, tef.paid_date
      FROM member_availability ma
      JOIN members m ON m.id = ma.member_id
      JOIN users u ON u.id = m.user_id
      LEFT JOIN tournament_entry_fees tef ON tef.tournament_id = ma.event_id AND tef.member_id = ma.member_id
      WHERE ma.event_type = 'tournament' AND ma.event_id = ?
      ORDER BY u.name
    `, [tournament.id]);

    res.json({ ...tournament, selections, matches, invited });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Club-wide "who paid their kotizacija" list, across every tournament -
// the per-tournament detail page already shows this one tournament at a
// time; this is the consolidated view for Finansije.
exports.getFeesOverview = async (req, res) => {
  try {
    const ids = req.user.selection_ids || [];
    const coachFilter = req.user.role === 'coach'
      ? (ids.length ? ' AND EXISTS (SELECT 1 FROM tournament_selections ts WHERE ts.tournament_id=t.id AND ts.selection_id IN (?))' : ' AND 1=0')
      : '';
    const params = [req.user.club_id];
    if (req.user.role === 'coach' && ids.length) params.push(ids);
    const [rows] = await db.query(`
      SELECT tef.id, tef.tournament_id, t.name as tournament_name, t.date_start,
        tef.member_id, u.name as member_name,
        tef.amount, tef.status, tef.paid_date
      FROM tournament_entry_fees tef
      JOIN tournaments t ON t.id = tef.tournament_id
      JOIN members m ON m.id = tef.member_id
      JOIN users u ON u.id = m.user_id
      WHERE t.club_id = ?${coachFilter}
      ORDER BY t.date_start DESC, u.name
    `, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

// One member's kotizacija history across every tournament - the member
// profile page's "Kotizacije" tab.
exports.getMemberFees = async (req, res) => {
  try {
    const memberId = req.params.memberId;
    const [[member]] = await db.query('SELECT id FROM members WHERE id=? AND club_id=?', [memberId, req.user.club_id]);
    if (!member) return res.status(404).json({ message: 'Član nije pronađen' });
    const [rows] = await db.query(`
      SELECT tef.id, tef.tournament_id, t.name as tournament_name, t.date_start,
        tef.amount, tef.status, tef.paid_date
      FROM tournament_entry_fees tef
      JOIN tournaments t ON t.id = tef.tournament_id
      WHERE tef.member_id = ? AND t.club_id = ?
      ORDER BY t.date_start DESC
    `, [memberId, req.user.club_id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.create = async (req, res) => {
  const { selection_ids, name, location, date_start, date_end, entry_fee_amount } = req.body;
  if (!name || !date_start || !date_end) return res.status(400).json({ message: 'Naziv i period su obavezni' });

  let selIds = (Array.isArray(selection_ids) ? selection_ids : []).map(Number).filter(Boolean);
  if (req.user.role === 'coach') {
    const ids = req.user.selection_ids || [];
    selIds = selIds.length ? selIds.filter(id => ids.includes(id)) : ids;
    if (!selIds.length) return res.status(400).json({ message: 'Trener mora biti dodijeljen selekciji' });
  } else if (!selIds.length) {
    return res.status(400).json({ message: 'Odaberite bar jednu selekciju' });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO tournaments (club_id, name, location, date_start, date_end, entry_fee_amount, created_by) VALUES (?,?,?,?,?,?,?)`,
      [req.user.club_id, name, location || null, date_start, date_end, entry_fee_amount || null, req.user.id]
    );
    const tournamentId = result.insertId;

    await db.query(
      'INSERT INTO tournament_selections (tournament_id, selection_id) VALUES ?',
      [selIds.map(id => [tournamentId, id])]
    );

    res.status(201).json({ id: tournamentId });
  } catch (err) {
    console.error('Tournament create error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.addMatch = async (req, res) => {
  const { selection_id, opponent, location, match_date, match_type, home_away, notes } = req.body;
  if (!opponent || !match_date) return res.status(400).json({ message: 'Protivnik i datum/vrijeme su obavezni' });
  try {
    const [[tournament]] = await db.query('SELECT * FROM tournaments WHERE id=? AND club_id=?', [req.params.id, req.user.club_id]);
    if (!tournament) return res.status(404).json({ message: 'Turnir nije pronađen' });
    if (!(await tournamentInCoachScope(req, tournament.id))) return res.status(404).json({ message: 'Turnir nije pronađen' });

    const tournamentSelIds = await getTournamentSelectionIds(tournament.id);
    const selId = Number(selection_id);
    if (!selId || !tournamentSelIds.includes(selId)) {
      return res.status(400).json({ message: 'Selekcija mora biti jedna od selekcija ovog turnira' });
    }
    if (req.user.role === 'coach' && !(req.user.selection_ids || []).includes(selId)) {
      return res.status(403).json({ message: 'Nemate pristup ovoj selekciji' });
    }

    const matchType = ['friendly', 'league', 'cup'].includes(match_type) ? match_type : 'cup';
    const homeAway = ['home', 'away', 'neutral'].includes(home_away) ? home_away : 'neutral';

    const [result] = await db.query(
      'INSERT INTO matches (club_id, selection_id, tournament_id, opponent, location, match_date, match_type, home_away, notes) VALUES (?,?,?,?,?,?,?,?,?)',
      [req.user.club_id, selId, tournament.id, opponent, location || tournament.location || null, match_date, matchType, homeAway, notes || null]
    );

    notifyMatchCreated(
      { opponent, location: location || tournament.location, match_date, match_type: matchType, home_away: homeAway },
      req.user.club_id, selId, req.user.id
    ).catch(() => {});

    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error('Tournament addMatch error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.removeMatch = async (req, res) => {
  try {
    if (!(await tournamentInCoachScope(req, req.params.id))) return res.status(404).json({ message: 'Turnir nije pronađen' });
    await db.query(
      `DELETE m FROM matches m JOIN tournaments t ON t.id = m.tournament_id
       WHERE m.id=? AND m.tournament_id=? AND t.club_id=?`,
      [req.params.matchId, req.params.id, req.user.club_id]
    );
    res.json({ message: 'Utakmica obrisana' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.invite = async (req, res) => {
  const { member_ids } = req.body;
  const ids = Array.isArray(member_ids) ? member_ids.map(Number).filter(Boolean) : [];
  if (!ids.length) return res.status(400).json({ message: 'Izaberite bar jednog igrača' });
  try {
    const [[tournament]] = await db.query('SELECT * FROM tournaments WHERE id=? AND club_id=?', [req.params.id, req.user.club_id]);
    if (!tournament) return res.status(404).json({ message: 'Turnir nije pronađen' });
    if (!(await tournamentInCoachScope(req, tournament.id))) return res.status(404).json({ message: 'Turnir nije pronađen' });

    const [[{ selection_names }]] = await db.query(
      `SELECT GROUP_CONCAT(s.name ORDER BY s.name SEPARATOR ', ') as selection_names FROM tournament_selections ts JOIN selections s ON s.id=ts.selection_id WHERE ts.tournament_id=?`,
      [tournament.id]
    );

    const [members] = await db.query(
      'SELECT m.id, u.id as user_id, u.name, u.email FROM members m JOIN users u ON m.user_id=u.id WHERE m.id IN (?) AND m.club_id=?',
      [ids, req.user.club_id]
    );

    for (const m of members) {
      const [availResult] = await db.query(
        `INSERT IGNORE INTO member_availability (member_id, event_type, event_id, status) VALUES (?, 'tournament', ?, 'pending')`,
        [m.id, tournament.id]
      );
      const newlyInvited = availResult.affectedRows > 0;

      let feeCreated = false;
      if (tournament.entry_fee_amount) {
        const [feeResult] = await db.query(
          'INSERT IGNORE INTO tournament_entry_fees (tournament_id, member_id, amount) VALUES (?,?,?)',
          [tournament.id, m.id, tournament.entry_fee_amount]
        );
        feeCreated = feeResult.affectedRows > 0;
      }

      if (!newlyInvited) continue;

      const link = '/pages/tournaments/my.html';
      const title = 'Pozvani ste na turnir';
      const msg = `Pozvani ste na turnir "${tournament.name}" (${fmtDate(tournament.date_start)} - ${fmtDate(tournament.date_end)}).`;
      await createNotification(m.user_id, req.user.club_id, title, msg, 'info', link);

      if (MAIL_ENABLED && m.email) {
        try {
          const r = await renderEmail('tournament_invite', {
            ime: m.name, turnir: tournament.name, selekcija: selection_names || '-',
            datum_od: fmtDate(tournament.date_start), datum_do: fmtDate(tournament.date_end),
            lokacija: tournament.location || '-', __link: `${APP_URL}${link}`,
          });
          if (r.enabled) await sendMail({ to: m.email, subject: r.subject, html: r.html });
        } catch (_) {}
      }

      if (feeCreated) {
        const feeTitle = 'Kotizacija za turnir';
        const feeMsg = `Kotizacija za turnir "${tournament.name}" iznosi ${tournament.entry_fee_amount} KM.`;
        await createNotification(m.user_id, req.user.club_id, feeTitle, feeMsg, 'info', link);
        if (MAIL_ENABLED && m.email) {
          try {
            const r = await renderEmail('tournament_fee_created', { turnir: tournament.name, iznos: tournament.entry_fee_amount, __link: `${APP_URL}${link}` });
            if (r.enabled) await sendMail({ to: m.email, subject: r.subject, html: r.html });
          } catch (_) {}
        }
      }
    }

    res.json({ message: 'Pozivnice poslane' });
  } catch (err) {
    console.error('Tournament invite error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

async function autoAddTournamentIncome(fee, tournamentName, date, userId, clubId) {
  const [exists] = await db.query(
    'SELECT id FROM finances WHERE club_id=? AND reference=? LIMIT 1',
    [clubId, `TRN-${fee.id}`]
  );
  if (exists.length > 0) return;
  const description = `Kotizacija - ${fee.member_name || 'član'} (${tournamentName})`;
  await db.query(
    'INSERT INTO finances (club_id, type, category, description, amount, date, reference, created_by) VALUES (?,?,?,?,?,?,?,?)',
    [clubId, 'income', 'Kotizacije', description, fee.amount, date, `TRN-${fee.id}`, userId]
  );
}

exports.markFeePaid = async (req, res) => {
  try {
    const [[fee]] = await db.query(`
      SELECT tef.*, t.name as tournament_name, u.id as user_id, u.name as member_name, u.email
      FROM tournament_entry_fees tef
      JOIN tournaments t ON t.id = tef.tournament_id
      JOIN members m ON m.id = tef.member_id
      JOIN users u ON u.id = m.user_id
      WHERE tef.id = ? AND tef.tournament_id = ? AND t.club_id = ?
    `, [req.params.feeId, req.params.id, req.user.club_id]);
    if (!fee) return res.status(404).json({ message: 'Kotizacija nije pronađena' });
    if (!(await tournamentInCoachScope(req, fee.tournament_id))) return res.status(404).json({ message: 'Kotizacija nije pronađena' });

    if (fee.status !== 'paid') {
      const today = new Date().toISOString().slice(0, 10);
      await db.query(
        `UPDATE tournament_entry_fees SET status='paid', paid_date=?, payment_method=? WHERE id=?`,
        [today, req.body.payment_method || 'cash', fee.id]
      );
      await autoAddTournamentIncome(fee, fee.tournament_name, today, req.user.id, req.user.club_id);

      const link = '/pages/tournaments/my.html';
      await createNotification(fee.user_id, req.user.club_id, 'Kotizacija plaćena', `Vaša kotizacija od ${fee.amount} KM za turnir "${fee.tournament_name}" je zabilježena kao plaćena.`, 'success', link);
      if (MAIL_ENABLED && fee.email) {
        try {
          const r = await renderEmail('tournament_fee_paid', { turnir: fee.tournament_name, iznos: fee.amount, __link: `${APP_URL}${link}` });
          if (r.enabled) await sendMail({ to: fee.email, subject: r.subject, html: r.html });
        } catch (_) {}
      }
    }

    res.json({ message: 'Kotizacija označena kao plaćena' });
  } catch (err) {
    console.error('Tournament markFeePaid error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.remove = async (req, res) => {
  try {
    const [[tournament]] = await db.query('SELECT id FROM tournaments WHERE id=? AND club_id=?', [req.params.id, req.user.club_id]);
    if (!tournament) return res.status(404).json({ message: 'Turnir nije pronađen' });
    if (!(await tournamentInCoachScope(req, tournament.id))) return res.status(404).json({ message: 'Turnir nije pronađen' });

    // Finances rows for already-paid kotizacija are intentionally left alone -
    // same precedent as a membership fee's finances entry surviving after the
    // member who paid it is deleted (reference/description are plain text,
    // not a live join, so they just keep showing as historical income).
    await db.query(`DELETE FROM member_availability WHERE event_type='tournament' AND event_id=?`, [tournament.id]);
    await db.query('DELETE FROM tournaments WHERE id=? AND club_id=?', [tournament.id, req.user.club_id]);
    // tournament_selections/tournament_entry_fees CASCADE-delete with the tournament row.
    res.json({ message: 'Turnir obrisan' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
