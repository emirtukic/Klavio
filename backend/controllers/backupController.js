const db = require('../config/db');

const BACKUP_TABLES = [
  'members', 'membership_fees', 'training_sessions', 'training_attendance',
  'matches', 'player_stats', 'match_lineup', 'appointments', 'coaches',
  'selections', 'finances', 'announcements', 'sponsors', 'equipment',
  'member_medical', 'player_development', 'gallery', 'match_fees',
  'notifications', 'activity_log'
];

exports.exportJSON = async (req, res) => {
  try {
    const clubId = req.user.club_id;
    const backup = { version: '1.0', exported_at: new Date().toISOString(), club_id: clubId, tables: {} };

    for (const table of BACKUP_TABLES) {
      try {
        const [rows] = await db.query(`SELECT * FROM ${table} WHERE club_id = ?`, [clubId]);
        backup.tables[table] = rows;
      } catch (_) {
        backup.tables[table] = [];
      }
    }

    // member_availability has no club_id - join through members
    try {
      const [rows] = await db.query(
        `SELECT ma.* FROM member_availability ma JOIN members m ON ma.member_id = m.id WHERE m.club_id = ?`,
        [clubId]
      );
      backup.tables['member_availability'] = rows;
    } catch (_) {
      backup.tables['member_availability'] = [];
    }

    res.setHeader('Content-Disposition', `attachment; filename="klavio_backup_${new Date().toISOString().split('T')[0]}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.json(backup);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.importBackup = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Nema fajla' });
  const clubId = req.user.club_id;

  let backup;
  try {
    backup = JSON.parse(req.file.buffer.toString('utf8'));
  } catch (_) {
    return res.status(400).json({ message: 'Neispravan JSON fajl' });
  }

  if (!backup.tables || typeof backup.tables !== 'object') {
    return res.status(400).json({ message: 'Neispravan format backupa' });
  }

  const conn = await db.getConnection();
  const summary = {};
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    for (const [table, rows] of Object.entries(backup.tables)) {
      if (!Array.isArray(rows) || rows.length === 0) { summary[table] = 0; continue; }
      // Skip tables not in our allowed list (plus member_availability)
      const allowed = [...BACKUP_TABLES, 'member_availability'];
      if (!allowed.includes(table)) { summary[table] = 0; continue; }

      let inserted = 0;
      for (const row of rows) {
        try {
          if (table !== 'member_availability' && 'club_id' in row) {
            row.club_id = clubId;
          }
          const cols = Object.keys(row).filter(c => /^[a-zA-Z0-9_]+$/.test(c));
          const vals = cols.map(c => row[c]);
          const [result] = await conn.query(
            `INSERT IGNORE INTO ${table} (${cols.map(c => `\`${c}\``).join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
            vals
          );
          inserted += result.affectedRows;
        } catch (_) {}
      }
      summary[table] = inserted;
    }

    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    res.json({ message: 'Import završen', summary });
  } catch (err) {
    await conn.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => {});
    res.status(500).json({ message: 'Greška pri importu' });
  } finally {
    conn.release();
  }
};
