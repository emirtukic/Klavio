const db = require('../config/db');

exports.exportJSON = async (req, res) => {
  try {
    const tables = ['members', 'membership_fees', 'training_sessions', 'training_attendance', 'matches', 'player_stats', 'match_lineup', 'appointments', 'coaches', 'selections', 'finances', 'announcements', 'sponsors', 'equipment', 'member_medical', 'player_development'];
    const backup = { exported_at: new Date().toISOString(), club_id: req.user.club_id, tables: {} };
    for (const table of tables) {
      try {
        const [rows] = await db.query(`SELECT * FROM ${table} WHERE club_id = ?`, [req.user.club_id]);
        backup.tables[table] = rows;
      } catch(_) {
        // table may not have club_id column — skip gracefully
        backup.tables[table] = [];
      }
    }
    res.setHeader('Content-Disposition', `attachment; filename="klavio_backup_${new Date().toISOString().split('T')[0]}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.json(backup);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
