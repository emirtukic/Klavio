-- Migration 007: Turniri - multiple selections per tournament, matches added
-- individually instead of auto-generated from a team list.
-- Run once against the production database.

CREATE TABLE IF NOT EXISTS tournament_selections (
  tournament_id INT NOT NULL,
  selection_id INT NOT NULL,
  PRIMARY KEY (tournament_id, selection_id),
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  FOREIGN KEY (selection_id) REFERENCES selections(id) ON DELETE CASCADE
);

INSERT INTO tournament_selections (tournament_id, selection_id)
  SELECT id, selection_id FROM tournaments;

DROP TABLE IF EXISTS tournament_teams;

ALTER TABLE tournaments
  DROP FOREIGN KEY tournaments_ibfk_2;

ALTER TABLE tournaments
  DROP COLUMN selection_id,
  DROP COLUMN default_match_date,
  DROP COLUMN default_match_type,
  DROP COLUMN default_home_away;
