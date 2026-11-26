const db     = require('../config/db');
const mailer = require('../config/mailer');
const { renderEmail } = require('../config/emailTemplateStore');

const MATCH_TYPE_LABEL = { friendly: 'Prijateljska', league: 'Liga', cup: 'Kup' };
const HOME_AWAY_LABEL  = { home: 'Domaćin', away: 'Gost', neutral: 'Neutralno' };
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

const MAIL_ENABLED = !!(process.env.MAIL_USER && process.env.BREVO_API_KEY);

async function sendEmail(to, subject, html) {
  if (!MAIL_ENABLED || !to) return;
  try {
    await mailer.send({ to, subject, html });
  } catch (_) {}
}

function fmtDate(dt) {
  return new Date(dt).toLocaleString('bs-BA', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

async function insertNotif(userId, clubId, title, message, type, link) {
  await db.query(
    'INSERT INTO notifications (user_id, club_id, title, message, type, link) VALUES (?,?,?,?,?,?)',
    [userId, clubId, title, message, type, link || null]
  );
}

/**
 * Fired immediately when a match is created.
 * Notifies all members and coaches of the match's selection (excluding the creator).
 */
exports.notifyMatchCreated = async (match, clubId, selectionId, creatorUserId) => {
  if (!selectionId) return;
  try {
    const title = '⚽ Nova utakmica zakazana';
    const msg   = `vs ${match.opponent} · ${fmtDate(match.match_date)} · ${match.location || 'TBD'}`;
    const link  = '/pages/matches/list.html';

    const [members] = await db.query(
      `SELECT u.id, u.email FROM members m JOIN users u ON m.user_id = u.id
       WHERE m.club_id = ? AND EXISTS (SELECT 1 FROM member_selections ms WHERE ms.member_id=m.id AND ms.selection_id=?) AND u.is_active = TRUE AND u.id != ?`,
      [clubId, selectionId, creatorUserId]
    );

    const [coaches] = await db.query(
      `SELECT u.id, u.email FROM coaches c JOIN users u ON c.user_id = u.id
       WHERE c.club_id = ? AND EXISTS (SELECT 1 FROM coach_selections cs WHERE cs.coach_id=c.id AND cs.selection_id=?) AND u.is_active = TRUE AND u.id != ?`,
      [clubId, selectionId, creatorUserId]
    );

    const r = await renderEmail('match_created',
      { protivnik: match.opponent, datum: fmtDate(match.match_date), lokacija: match.location || 'TBD', __link: `${APP_URL}${link}` },
      [['Protivnik', match.opponent], ['Datum', fmtDate(match.match_date)], ['Lokacija', match.location || 'TBD']]
    );

    for (const u of [...members, ...coaches]) {
      await insertNotif(u.id, clubId, title, msg, 'info', link);
      if (r.enabled) sendEmail(u.email, r.subject, r.html);
    }
  } catch (err) {
    console.error('[notif] notifyMatchCreated error:', err.message);
  }
};

/**
 * Fired immediately when a training session is created.
 * Notifies all members and coaches of the session's selection (excluding the creator).
 */
exports.notifyTrainingCreated = async (session, clubId, selectionId, creatorUserId) => {
  if (!selectionId) return;
  try {
    const [[sel]] = await db.query('SELECT name FROM selections WHERE id = ?', [selectionId]);
    const selName = sel?.name || 'Selekcija';

    const title = '🏃 Novi trening zakazan';
    const when  = `${fmtDate(session.session_date + 'T' + session.start_time)}`;
    const msg   = `${selName} · ${session.title} · ${when} · ${session.location || 'TBD'}`;
    const link  = '/pages/training/schedule.html';

    const [members] = await db.query(
      `SELECT u.id, u.email FROM members m JOIN users u ON m.user_id = u.id
       WHERE m.club_id = ? AND EXISTS (SELECT 1 FROM member_selections ms WHERE ms.member_id=m.id AND ms.selection_id=?) AND u.is_active = TRUE AND u.id != ?`,
      [clubId, selectionId, creatorUserId]
    );

    const [coaches] = await db.query(
      `SELECT u.id, u.email FROM coaches c JOIN users u ON c.user_id = u.id
       WHERE c.club_id = ? AND EXISTS (SELECT 1 FROM coach_selections cs WHERE cs.coach_id=c.id AND cs.selection_id=?) AND u.is_active = TRUE AND u.id != ?`,
      [clubId, selectionId, creatorUserId]
    );

    const r = await renderEmail('training_created',
      { selekcija: selName, naziv: session.title, datum: `${when} - ${session.end_time || ''}`, lokacija: session.location || 'TBD', opis: session.description || '', __link: `${APP_URL}${link}` },
      [
        ['Selekcija', selName],
        ['Naziv', session.title],
        ['Datum i vrijeme', `${when} - ${session.end_time || ''}`],
        ['Lokacija', session.location || 'TBD'],
        ...(session.description ? [['Opis', session.description]] : []),
      ]
    );

    for (const u of [...members, ...coaches]) {
      await insertNotif(u.id, clubId, title, msg, 'info', link);
      if (r.enabled) sendEmail(u.email, r.subject, r.html);
    }
  } catch (err) {
    console.error('[notif] notifyTrainingCreated error:', err.message);
  }
};

/**
 * Run once a day (cron). Finds every match scheduled for tomorrow
 * and sends role-appropriate reminders.
 */
exports.sendDayBeforeReminders = async () => {
  try {
    const [matches] = await db.query(`
      SELECT m.*, s.name AS selection_name
      FROM matches m
      LEFT JOIN selections s ON m.selection_id = s.id
      WHERE DATE(m.match_date) = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
    `);

    let sent = 0;

    for (const match of matches) {
      const link   = '/pages/matches/list.html';
      const dtStr  = fmtDate(match.match_date);
      const loc    = match.location || 'TBD';
      const selName = match.selection_name || 'Selekcija';

      const r = await renderEmail('match_day_before',
        { protivnik: match.opponent, datum: dtStr, lokacija: loc, domacin_gost: HOME_AWAY_LABEL[match.home_away] || match.home_away, selekcija: selName, __link: `${APP_URL}${link}` },
        [['Protivnik', match.opponent], ['Datum', dtStr], ['Lokacija', loc], ['Domaćin/Gost', HOME_AWAY_LABEL[match.home_away] || match.home_away]]
      );

      // ── Members ──
      if (match.selection_id) {
        const [members] = await db.query(
          `SELECT u.id, u.email FROM members m JOIN users u ON m.user_id = u.id
           WHERE m.club_id = ? AND EXISTS (SELECT 1 FROM member_selections ms WHERE ms.member_id=m.id AND ms.selection_id=?) AND u.is_active = TRUE`,
          [match.club_id, match.selection_id]
        );
        for (const u of members) {
          await insertNotif(u.id, match.club_id,
            '⚽ Utakmica sutra!',
            `vs ${match.opponent} · ${dtStr} · ${loc}`,
            'warning', link);
          if (r.enabled) sendEmail(u.email, r.subject, r.html);
          sent++;
        }

        // ── Coaches ──
        const [coaches] = await db.query(
          `SELECT u.id, u.email FROM coaches c JOIN users u ON c.user_id = u.id
           WHERE c.club_id = ? AND EXISTS (SELECT 1 FROM coach_selections cs WHERE cs.coach_id=c.id AND cs.selection_id=?) AND u.is_active = TRUE`,
          [match.club_id, match.selection_id]
        );
        for (const u of coaches) {
          await insertNotif(u.id, match.club_id,
            '⚽ Utakmica sutra - podsjetnik',
            `${selName} igra sutra: vs ${match.opponent} · ${dtStr} · ${loc}`,
            'warning', link);
          if (r.enabled) sendEmail(u.email, r.subject, r.html);
          sent++;
        }
      }

      // ── Admins of this club ──
      const [admins] = await db.query(
        `SELECT id, email FROM users WHERE club_id = ? AND role = 'admin' AND is_active = TRUE`,
        [match.club_id]
      );
      const adminMsg = `${selName} vs ${match.opponent} · ${dtStr} · ${loc} · ${HOME_AWAY_LABEL[match.home_away] || match.home_away} · ${MATCH_TYPE_LABEL[match.match_type] || match.match_type}`;
      for (const u of admins) {
        await insertNotif(u.id, match.club_id,
          `⚽ Utakmica sutra - ${selName}`,
          adminMsg,
          'warning', link);
        if (r.enabled) sendEmail(u.email, r.subject, r.html);
        sent++;
      }
    }

    console.log(`[cron] Day-before match reminders: ${matches.length} match(es), ${sent} notification(s) sent.`);
  } catch (err) {
    console.error('[cron] sendDayBeforeReminders error:', err.message);
  }
};

/**
 * Every coach of a selection (if any) plus every club admin - deduped.
 * Shared by any notification whose audience is "whoever is responsible
 * for this selection's matches/trainings".
 */
async function getSelectionTaskRecipients(clubId, selectionId) {
  const recipients = [];
  if (selectionId) {
    const [coaches] = await db.query(
      `SELECT u.id, u.email FROM coaches c JOIN users u ON c.user_id = u.id
       WHERE c.club_id = ? AND EXISTS (SELECT 1 FROM coach_selections cs WHERE cs.coach_id=c.id AND cs.selection_id=?) AND u.is_active = TRUE`,
      [clubId, selectionId]
    );
    recipients.push(...coaches);
  }
  const [admins] = await db.query(
    `SELECT id, email FROM users WHERE club_id = ? AND role IN ('admin','super_admin') AND is_active = TRUE`,
    [clubId]
  );
  recipients.push(...admins);
  const seen = new Set();
  return recipients.filter(u => (seen.has(u.id) ? false : seen.add(u.id)));
}

/**
 * Notifies the match's own coach(es) (if it has a selection) plus every
 * club admin about an outstanding task on that match - deduped per user.
 * In-app title/msg are fixed (not admin-editable); the email body comes
 * from the editable `key` template.
 */
async function notifyMatchTask(match, { key, vars, title, msg, link }) {
  const recipients = await getSelectionTaskRecipients(match.club_id, match.selection_id);
  const r = await renderEmail(key, { ...vars, __link: `${APP_URL}${link}` });
  for (const u of recipients) {
    await insertNotif(u.id, match.club_id, title, msg, 'warning', link);
    if (r.enabled) sendEmail(u.email, r.subject, r.html);
  }
}

/**
 * Fired when a member declines (RSVP "no") a training or match and gives a
 * reason - the coach(es) of that selection plus every admin get notified,
 * since otherwise nobody finds out unless they happen to open the RSVP list.
 */
exports.notifyRsvpDecline = async (eventType, event, memberName, note) => {
  try {
    const isTraining = eventType === 'training';
    const title = isTraining ? 'Otkazano prisustvo na treningu' : 'Otkazano prisustvo na utakmicu';
    const whatLabel = isTraining ? `trening "${event.title}"` : `utakmicu vs ${event.opponent}`;
    const when = isTraining
      ? fmtDate(event.session_date + 'T' + event.start_time)
      : fmtDate(event.match_date);
    const msg = `${memberName} neće doći na ${whatLabel} (${when}). Razlog: ${note}`;
    const link = isTraining ? '/pages/training/schedule.html' : '/pages/matches/list.html';

    const recipients = await getSelectionTaskRecipients(event.club_id, event.selection_id);
    const r = await renderEmail('rsvp_decline', { ime: memberName, sta: whatLabel, datum: when, razlog: note, __link: `${APP_URL}${link}` });
    for (const u of recipients) {
      await insertNotif(u.id, event.club_id, title, msg, 'warning', link);
      if (r.enabled) sendEmail(u.email, r.subject, r.html);
    }
  } catch (err) {
    console.error('[notif] notifyRsvpDecline error:', err.message);
  }
};

/**
 * Run every 5 min (cron). Finds matches kicking off within 2 hours that
 * still have no lineup, and nudges the coach(es)/admins - once per match.
 */
exports.checkLineupReminders = async () => {
  try {
    const [matches] = await db.query(`
      SELECT m.* FROM matches m
      WHERE m.lineup_reminder_sent = 0
        AND m.match_date > NOW()
        AND m.match_date <= DATE_ADD(NOW(), INTERVAL 2 HOUR)
        AND NOT EXISTS (SELECT 1 FROM match_lineup ml WHERE ml.match_id = m.id)
    `);
    for (const match of matches) {
      await notifyMatchTask(match, {
        key: 'lineup_reminder',
        vars: { protivnik: match.opponent, datum: fmtDate(match.match_date) },
        title: '📋 Postava nije unesena',
        msg: `Utakmica vs ${match.opponent} počinje za manje od 2 sata - postava nije unesena.`,
        link: '/pages/lineup/index.html',
      });
      await db.query('UPDATE matches SET lineup_reminder_sent = 1 WHERE id = ?', [match.id]);
    }
    if (matches.length) console.log(`[cron] Lineup reminders sent for ${matches.length} match(es).`);
  } catch (err) {
    console.error('[cron] checkLineupReminders error:', err.message);
  }
};

/**
 * Run every 5 min (cron). Finds matches that are 2h/1d past kickoff with
 * no result entered yet, and nudges the coach(es)/admins - once per stage.
 */
exports.checkResultReminders = async () => {
  try {
    const [due2h] = await db.query(`
      SELECT m.* FROM matches m
      WHERE m.result_reminder_2h_sent = 0
        AND m.result = 'pending'
        AND m.match_date <= DATE_SUB(NOW(), INTERVAL 2 HOUR)
    `);
    for (const match of due2h) {
      await notifyMatchTask(match, {
        key: 'result_reminder_2h',
        vars: { protivnik: match.opponent, datum: fmtDate(match.match_date) },
        title: '📝 Unesi rezultat utakmice',
        msg: `Utakmica vs ${match.opponent} je odigrana - unesite rezultat i statistiku igrača.`,
        link: '/pages/matches/list.html',
      });
      await db.query('UPDATE matches SET result_reminder_2h_sent = 1 WHERE id = ?', [match.id]);
    }

    const [due1d] = await db.query(`
      SELECT m.* FROM matches m
      WHERE m.result_reminder_1d_sent = 0
        AND m.result = 'pending'
        AND m.match_date <= DATE_SUB(NOW(), INTERVAL 1 DAY)
    `);
    for (const match of due1d) {
      await notifyMatchTask(match, {
        key: 'result_reminder_1d',
        vars: { protivnik: match.opponent, datum: fmtDate(match.match_date) },
        title: '⏰ Rezultat utakmice i dalje nije unesen',
        msg: `Prošao je dan od utakmice vs ${match.opponent}, a rezultat još nije unesen.`,
        link: '/pages/matches/list.html',
      });
      await db.query('UPDATE matches SET result_reminder_1d_sent = 1 WHERE id = ?', [match.id]);
    }

    if (due2h.length || due1d.length)
      console.log(`[cron] Result reminders: ${due2h.length} at 2h, ${due1d.length} at 1d.`);
  } catch (err) {
    console.error('[cron] checkResultReminders error:', err.message);
  }
};
