const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/forms', express.static(path.join(__dirname, '../obrazci')));

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
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/support-tickets', require('./routes/support-tickets'));
app.use('/api/analytics',      require('./routes/analytics'));
app.use('/api/contact',        require('./routes/contact'));
app.use('/api/search',         require('./routes/search'));
app.use('/api/live-match',     require('./routes/liveMatch'));
app.use('/api/members/:memberId/documents', require('./routes/member-documents'));

app.get('*splat', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Daily 08:00 - send day-before match reminders
const { sendDayBeforeReminders } = require('./services/matchNotificationService');
cron.schedule('0 8 * * *', () => {
  console.log('[cron] Running day-before match reminder job...');
  sendDayBeforeReminders();
});

// Daily midnight - mark expired subscriptions as overdue
const db = require('./config/db');
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

console.log('[boot] liveMatch controller version: 2 (uses users.name)');

async function runMigrations() {
  try {
    await db.query(`
      ALTER TABLE matches
        ADD COLUMN IF NOT EXISTS status ENUM('scheduled','live','paused','finished') NOT NULL DEFAULT 'scheduled' AFTER goals_against,
        ADD COLUMN IF NOT EXISTS started_at DATETIME NULL AFTER status
    `);
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
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  await runMigrations();
});
