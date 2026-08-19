const db = require('../config/db');

// Confirms a row exists in `table` (by its `id` column) and belongs to the
// given club. `table` is always a hardcoded literal supplied by the calling
// controller, never user input, so building the query string is safe.
async function assertClubOwned(table, id, clubId) {
  const [[row]] = await db.query(`SELECT id FROM ${table} WHERE id = ? AND club_id = ?`, [id, clubId]);
  return !!row;
}

module.exports = { assertClubOwned };
