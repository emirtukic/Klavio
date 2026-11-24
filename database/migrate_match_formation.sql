USE club_management;

-- lineupController.js reads/writes matches.formation, but the column was
-- never added - every lineup load/save threw "Unknown column 'formation'".
-- (Plain ALTER, not "ADD COLUMN IF NOT EXISTS" - that combined syntax threw
-- a syntax error on this server despite MySQL 8.4; check information_schema
-- first if re-running this.)
ALTER TABLE matches ADD COLUMN formation VARCHAR(20) NULL;
