const db     = require('../config/db');
const mailer = require('../config/mailer');

const MATCH_TYPE_LABEL = { friendly: 'Prijateljska', league: 'Liga', cup: 'Kup' };
const HOME_AWAY_LABEL  = { home: 'Domaćin', away: 'Gost', neutral: 'Neutralno' };

const MAIL_ENABLED = !!(process.env.MAIL_USER && process.env.MAIL_PASS);

function matchEmailHtml(subject, details) {
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:10px;border:1px solid #e2e8f0;overflow:hidden;">
      <div style="background:#1e3a5f;padding:20px 24px;">
        <img src="https://klavio.app/assets/img/klavio-icon.svg" alt="Klavio" style="height:32px;" onerror="this.style.display='none'">
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
       WHERE m.club_id = ? AND m.selection_id = ? AND u.is_active = TRUE AND u.id != ?`,
      [clubId, selectionId, creatorUserId]
    );

    const [coaches] = await db.query(
      `SELECT u.id, u.email FROM coaches c JOIN users u ON c.user_id = u.id
       WHERE c.club_id = ? AND c.selection_id = ? AND u.is_active = TRUE AND u.id != ?`,
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
           WHERE m.club_id = ? AND m.selection_id = ? AND u.is_active = TRUE`,
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
           WHERE c.club_id = ? AND c.selection_id = ? AND u.is_active = TRUE`,
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
