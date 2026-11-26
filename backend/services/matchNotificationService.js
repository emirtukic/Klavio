const db     = require('../config/db');
const mailer = require('../config/mailer');

const MATCH_TYPE_LABEL = { friendly: 'Prijateljska', league: 'Liga', cup: 'Kup' };
const HOME_AWAY_LABEL  = { home: 'Domaćin', away: 'Gost', neutral: 'Neutralno' };

const MAIL_ENABLED = !!(process.env.MAIL_USER && process.env.BREVO_API_KEY);

function matchEmailHtml(subject, details) {
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:10px;border:1px solid #e2e8f0;overflow:hidden;">
      <div style="background:#1e3a5f;padding:20px 24px;">
        <img src="https://klavioclub.com/assets/img/favicon-192.png" alt="Klavio" style="height:32px;width:32px;" onerror="this.style.display='none'">
        <h2 style="color:#fff;margin:12px 0 0;font-size:1.1rem;">⚽ ${subject}</h2>
      </div>
      <div style="padding:20px 24px;color:#1e293b;font-size:0.95rem;line-height:1.6;">
        ${details}
      </div>
      <div style="padding:12px 24px;background:#f8fafc;font-size:0.78rem;color:#94a3b8;border-top:1px solid #e2e8f0;">
        Klavio - Platforma za upravljanje sportskim klubom
      </div>
    </div>`;
}

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

    const emailHtml = matchEmailHtml(title,
      `<p><strong>Protivnik:</strong> ${match.opponent}</p>
       <p><strong>Datum:</strong> ${fmtDate(match.match_date)}</p>
       <p><strong>Lokacija:</strong> ${match.location || 'TBD'}</p>
       <p style="margin-top:16px;"><a href="${process.env.APP_URL || 'http://localhost:3000'}/pages/matches/list.html" style="background:#3b82f6;color:#fff;padding:8px 18px;border-radius:6px;text-decoration:none;font-weight:600;">Pogledaj raspored</a></p>`
    );

    for (const u of [...members, ...coaches]) {
      await insertNotif(u.id, clubId, title, msg, 'info', link);
      sendEmail(u.email, title, emailHtml);
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

    const emailHtml = matchEmailHtml(title,
      `<p><strong>Selekcija:</strong> ${selName}</p>
       <p><strong>Naziv:</strong> ${session.title}</p>
       <p><strong>Datum i vrijeme:</strong> ${when} - ${session.end_time || ''}</p>
       <p><strong>Lokacija:</strong> ${session.location || 'TBD'}</p>
       ${session.description ? `<p><strong>Opis:</strong> ${session.description}</p>` : ''}
       <p style="margin-top:16px;"><a href="${process.env.APP_URL || 'http://localhost:3000'}/pages/training/schedule.html" style="background:#3b82f6;color:#fff;padding:8px 18px;border-radius:6px;text-decoration:none;font-weight:600;">Pogledaj raspored</a></p>`
    );

    for (const u of [...members, ...coaches]) {
      await insertNotif(u.id, clubId, title, msg, 'info', link);
      sendEmail(u.email, title, emailHtml);
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

      const matchEmailBody = (intro) =>
        matchEmailHtml('Utakmica sutra - podsjetnik',
          `<p>${intro}</p>
           <p><strong>Protivnik:</strong> ${match.opponent}</p>
           <p><strong>Datum:</strong> ${dtStr}</p>
           <p><strong>Lokacija:</strong> ${loc}</p>
           <p><strong>Domaćin/Gost:</strong> ${HOME_AWAY_LABEL[match.home_away] || match.home_away}</p>
           <p style="margin-top:16px;"><a href="${process.env.APP_URL || 'http://localhost:3000'}/pages/matches/list.html" style="background:#3b82f6;color:#fff;padding:8px 18px;border-radius:6px;text-decoration:none;font-weight:600;">Pogledaj detalje</a></p>`
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
          sendEmail(u.email, `⚽ Utakmica sutra! vs ${match.opponent}`, matchEmailBody(`Imaš utakmicu sutra (${selName}).`));
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
          sendEmail(u.email, `⚽ Utakmica sutra - ${selName}`, matchEmailBody(`${selName} igra sutra.`));
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
        sendEmail(u.email, `⚽ Utakmica sutra - ${selName} vs ${match.opponent}`, matchEmailBody(`${selName} igra sutra (vaš klub).`));
        sent++;
      }
    }

    console.log(`[cron] Day-before match reminders: ${matches.length} match(es), ${sent} notification(s) sent.`);
  } catch (err) {
    console.error('[cron] sendDayBeforeReminders error:', err.message);
  }
};

/**
 * Notifies the match's own coach(es) (if it has a selection) plus every
 * club admin about an outstanding task on that match - deduped per user.
 */
async function notifyMatchTask(match, { title, msg, emailSubject, emailIntro, link }) {
  const recipients = [];
  if (match.selection_id) {
    const [coaches] = await db.query(
      `SELECT u.id, u.email FROM coaches c JOIN users u ON c.user_id = u.id
       WHERE c.club_id = ? AND EXISTS (SELECT 1 FROM coach_selections cs WHERE cs.coach_id=c.id AND cs.selection_id=?) AND u.is_active = TRUE`,
      [match.club_id, match.selection_id]
    );
    recipients.push(...coaches);
  }
  const [admins] = await db.query(
    `SELECT id, email FROM users WHERE club_id = ? AND role IN ('admin','super_admin') AND is_active = TRUE`,
    [match.club_id]
  );
  recipients.push(...admins);

  const emailHtml = matchEmailHtml(emailSubject,
    `<p>${emailIntro}</p>
     <p style="margin-top:16px;"><a href="${process.env.APP_URL || 'http://localhost:3000'}${link}" style="background:#3b82f6;color:#fff;padding:8px 18px;border-radius:6px;text-decoration:none;font-weight:600;">Otvori</a></p>`
  );

  const seen = new Set();
  for (const u of recipients) {
    if (seen.has(u.id)) continue;
    seen.add(u.id);
    await insertNotif(u.id, match.club_id, title, msg, 'warning', link);
    sendEmail(u.email, emailSubject, emailHtml);
  }
}

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
        title: '📋 Postava nije unesena',
        msg: `Utakmica vs ${match.opponent} počinje za manje od 2 sata - postava nije unesena.`,
        emailSubject: `Postava nije unesena - vs ${match.opponent}`,
        emailIntro: `Utakmica vs ${match.opponent} (${fmtDate(match.match_date)}) počinje uskoro, a postava još nije unesena.`,
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
        title: '📝 Unesi rezultat utakmice',
        msg: `Utakmica vs ${match.opponent} je odigrana - unesite rezultat i statistiku igrača.`,
        emailSubject: `Unesi rezultat - vs ${match.opponent}`,
        emailIntro: `Utakmica vs ${match.opponent} (${fmtDate(match.match_date)}) je odigrana, a rezultat još nije unesen.`,
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
        title: '⏰ Rezultat utakmice i dalje nije unesen',
        msg: `Prošao je dan od utakmice vs ${match.opponent}, a rezultat još nije unesen.`,
        emailSubject: `Podsjetnik: rezultat i dalje nije unesen - vs ${match.opponent}`,
        emailIntro: `Prošao je dan od utakmice vs ${match.opponent} (${fmtDate(match.match_date)}), a rezultat, strijelci i statistika i dalje nisu uneseni.`,
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
