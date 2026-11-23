const zlib = require('zlib');
const db = require('../config/db');
const { uploadBackup, listBackups, deleteBackup } = require('../config/r2');
const { send: sendMail } = require('../config/mailer');

const RETENTION_DAYS = 14;
const PREFIX = 'full/';

async function getAllTableNames() {
  const [rows] = await db.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'`
  );
  return rows.map(r => r.TABLE_NAME);
}

async function pruneOldBackups() {
  const objects = await listBackups(PREFIX);
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  for (const obj of objects) {
    if (obj.LastModified && new Date(obj.LastModified).getTime() < cutoff) {
      await deleteBackup(obj.Key);
    }
  }
}

async function runFullBackup() {
  const tables = await getAllTableNames();
  const dump = { version: '1.0', exported_at: new Date().toISOString(), tables: {} };
  for (const table of tables) {
    const [rows] = await db.query(`SELECT * FROM \`${table}\``);
    dump.tables[table] = rows;
  }
  const gz = zlib.gzipSync(JSON.stringify(dump));
  const dateStr = new Date().toISOString().slice(0, 10);
  const key = `${PREFIX}klavio_full_${dateStr}_${Date.now()}.json.gz`;
  await uploadBackup(key, gz, 'application/gzip');
  await pruneOldBackups();
  return { key, tableCount: tables.length, sizeBytes: gz.length };
}

// Wraps runFullBackup so a failure never crashes the caller (cron job) -
// instead it emails the admin, since a silently-broken backup is worse than
// no backup (nobody would know to fix it).
async function runFullBackupSafely() {
  try {
    const result = await runFullBackup();
    console.log(`[backup] OK: ${result.key} (${result.tableCount} tables, ${(result.sizeBytes / 1024).toFixed(1)} KB)`);
    return result;
  } catch (err) {
    console.error('[backup] FAILED:', err.message);
    await sendMail({
      to: process.env.MAIL_USER || 'info@klavioclub.com',
      subject: 'UPOZORENJE: Automatski backup baze nije uspio',
      text: `Dnevni backup produkcijske baze nije uspio.\n\nGreška: ${err.message}\n\nProvjeri odmah.`,
      html: `<p>Dnevni backup produkcijske baze nije uspio.</p><p>Greška: ${err.message}</p><p>Provjeri odmah.</p>`,
    }).catch(e => console.error('[backup] Failure alert mail also failed:', e.message));
    throw err;
  }
}

module.exports = { runFullBackup, runFullBackupSafely };
