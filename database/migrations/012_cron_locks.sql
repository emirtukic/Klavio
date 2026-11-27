CREATE TABLE IF NOT EXISTS cron_locks (
  job_name VARCHAR(64) NOT NULL,
  run_key VARCHAR(32) NOT NULL,
  claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (job_name, run_key)
);
