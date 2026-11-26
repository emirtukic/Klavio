const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const db = require('./config/db');

const app = express();

app.use(cors());
app.use(express.json());

// Lightweight endpoint for external uptime monitors to ping - checks the DB
// connection too, since "server up but DB unreachable" is the failure mode
// that actually matters for this app.
app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(503).json({ status: 'error', message: err.message });
  }
});

// Clean URL for the registration page (file has no extension on disk,
// so express.static can't guess its content type on its own).
app.get('/register', (req, res) => {
  res.type('html').sendFile(path.join(__dirname, '../frontend/register'));
});

// acceptRanges disabled: Range requests return 206 Partial Content, which
// Cloudflare should never compress - doing so corrupts the response and
// breaks crawlers (e.g. Meta's domain verification, link scraping).
// setHeaders forces JS/CSS to always revalidate: without an explicit
// Cache-Control, Cloudflare applies its own ~4h edge/browser default for
// static extensions, so a deploy fixing a bug in shared app JS (e.g.
// auth.js) wouldn't actually reach a returning visitor's browser for hours.
app.use(express.static(path.join(__dirname, '../frontend'), {
  acceptRanges: false,
  setHeaders: (res, filePath) => {
    if (/\.(js|css)$/.test(filePath)) res.setHeader('Cache-Control', 'no-cache');
  },
}));
app.use('/forms', express.static(path.join(__dirname, '../obrazci'), { acceptRanges: false }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/members', require('./routes/members'));
app.use('/api/fees', require('./routes/fees'));
app.use('/api/training', require('./routes/training'));
app.use('/api/matches', require('./routes/matches'));
app.use('/api/coaches', require('./routes/coaches'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/clubs', require('./routes/clubs'));
app.use('/api/selections', require('./routes/selections'));
app.use('/api/finances', require('./routes/finances'));
app.use('/api/match-fees', require('./routes/match-fees'));
app.use('/api/announcements', require('./routes/announcements'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/lineup', require('./routes/lineup'));
app.use('/api/sponsors', require('./routes/sponsors'));
app.use('/api/equipment', require('./routes/equipment'));
app.use('/api/gallery', require('./routes/gallery'));
app.use('/api/development', require('./routes/development'));
app.use('/api/medical', require('./routes/medical'));
app.use('/api/availability', require('./routes/availability'));
app.use('/api/activity-log', require('./routes/activity-log'));
app.use('/api/forms',        require('./routes/forms'));
app.use('/api/reminders', require('./routes/reminders'));
app.use('/api/backup', require('./routes/backup'));
app.use('/api/platform', require('./routes/platform'));
app.use('/api/platform-messaging', require('./routes/platform-messaging'));
app.use('/api/system-notifications', require('./routes/system-notifications'));
app.use('/api/email-templates', require('./routes/emailTemplates'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/support-tickets', require('./routes/support-tickets'));
app.use('/api/analytics',      require('./routes/analytics'));
app.use('/api/contact',        require('./routes/contact'));
app.use('/api/search',         require('./routes/search'));
app.use('/api/live-match',     require('./routes/liveMatch'));
app.use('/api/members/:memberId/documents', require('./routes/member-documents'));

app.get('*splat', (req, res) => {
  res.status(404).sendFile(path.join(__dirname, '../frontend/404.html'));
});

// Catch multer/fileFilter errors (and anything else passed to next(err))
// so clients always get JSON instead of Express's default HTML error page.
app.use((err, req, res, next) => {
  if (!err) return next();
  console.error(err);
  res.status(400).json({ message: err.message || 'Greška pri obradi zahtjeva' });
});

// Daily 08:00 - send day-before match reminders
const { sendDayBeforeReminders } = require('./services/matchNotificationService');
cron.schedule('0 8 * * *', () => {
  console.log('[cron] Running day-before match reminder job...');
  sendDayBeforeReminders();
});

// Daily midnight - mark expired subscriptions as overdue
cron.schedule('0 0 * * *', async () => {
  try {
    const [result] = await db.query(`
      UPDATE club_subscriptions
      SET status = 'overdue'
      WHERE status = 'active'
        AND plan != 'starter'
        AND current_period_end IS NOT NULL
        AND current_period_end < CURDATE()
    `);
    if (result.affectedRows > 0)
      console.log(`[cron] Marked ${result.affectedRows} subscription(s) as overdue.`);
  } catch (err) {
    console.error('[cron] Subscription expiry check failed:', err.message);
  }
});

// Daily 03:00 - full database backup to R2 (private bucket, not the public uploads one)
const { runFullBackupSafely } = require('./services/dbBackupService');
cron.schedule('0 3 * * *', () => {
  console.log('[cron] Running nightly full DB backup...');
  runFullBackupSafely().catch(() => {}); // already logged + alerted inside
});

// Every 5 min - auto-end live matches nobody closed after 90 minutes
const { autoEndStaleMatches } = require('./controllers/liveMatchController');
const { checkLineupReminders, checkResultReminders } = require('./services/matchNotificationService');
cron.schedule('*/5 * * * *', () => {
  autoEndStaleMatches();
  checkLineupReminders();
  checkResultReminders();
});

console.log('[boot] liveMatch controller version: 2 (uses users.name)');

// MySQL only added ADD COLUMN IF NOT EXISTS in 8.0.29 - older MySQL (e.g. some
// managed Aiven versions) rejects that syntax outright, which aborted the whole
// migration block before it ever reached the CREATE TABLE statements after it.
// information_schema works identically on every MySQL/MariaDB version instead.
async function columnExists(table, column) {
  const [rows] = await db.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows.length > 0;
}

async function runMigrations() {
  try {
    if (!(await columnExists('matches', 'status'))) {
      await db.query(`
        ALTER TABLE matches
          ADD COLUMN status ENUM('scheduled','live','paused','finished') NOT NULL DEFAULT 'scheduled' AFTER goals_against
      `);
    }
    if (!(await columnExists('matches', 'started_at'))) {
      await db.query(`
        ALTER TABLE matches
          ADD COLUMN started_at DATETIME NULL AFTER status
      `);
    }
    await db.query(`
      CREATE TABLE IF NOT EXISTS match_events (
        id                  INT AUTO_INCREMENT PRIMARY KEY,
        match_id            INT NOT NULL,
        event_type          ENUM('goal','own_goal','yellow_card','red_card','substitution','half_time','full_time','penalty','missed_penalty','var') NOT NULL,
        minute              TINYINT UNSIGNED NOT NULL DEFAULT 0,
        extra_minute        TINYINT UNSIGNED NOT NULL DEFAULT 0,
        member_id           INT NULL,
        member_name_cache   VARCHAR(100) NULL,
        member_id_2         INT NULL,
        member_name_2_cache VARCHAR(100) NULL,
        is_opponent         TINYINT(1) NOT NULL DEFAULT 0,
        score_for           TINYINT UNSIGNED NOT NULL DEFAULT 0,
        score_against       TINYINT UNSIGNED NOT NULL DEFAULT 0,
        notes               VARCHAR(200) NULL,
        created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (match_id)    REFERENCES matches(id) ON DELETE CASCADE,
        FOREIGN KEY (member_id)   REFERENCES members(id) ON DELETE SET NULL,
        FOREIGN KEY (member_id_2) REFERENCES members(id) ON DELETE SET NULL
      )
    `);
    console.log('[migration] 004_live_match: OK');
  } catch (err) {
    console.error('[migration] 004_live_match failed:', err.message);
  }

  try {
    // Disambiguate what verification_token is for (email-verify / invite / password-reset)
    // so the three flows can't be mixed up via a shared column.
    if (!(await columnExists('users', 'token_purpose'))) {
      await db.query(`
        ALTER TABLE users
          ADD COLUMN token_purpose VARCHAR(20) NULL AFTER verification_expires
      `);
    }
    console.log('[migration] 005_token_purpose: OK');
  } catch (err) {
    console.error('[migration] 005_token_purpose failed:', err.message);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  await runMigrations();
});
