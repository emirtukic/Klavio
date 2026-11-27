const db = require('../config/db');

// Render keeps the old instance alive alongside the new one for a bit during
// every deploy (and sometimes longer, if an old process doesn't shut down
// cleanly) - each instance registers its own in-process cron.schedule timer,
// so without this, every scheduled job fires once per still-alive instance
// instead of once total. The first instance to INSERT a given (job, run_key)
// wins the right to actually run; every other instance's INSERT IGNORE hits
// the primary key and gets 0 affected rows, so it skips.
async function claimCronRun(jobName, runKey) {
  try {
    const [result] = await db.query(
      'INSERT IGNORE INTO cron_locks (job_name, run_key) VALUES (?, ?)',
      [jobName, runKey]
    );
    return result.affectedRows > 0;
  } catch (err) {
    console.error(`[cron-lock] claim failed for ${jobName}/${runKey}:`, err.message);
    return false; // fail safe - skip rather than risk a duplicate run on error
  }
}

module.exports = { claimCronRun };
