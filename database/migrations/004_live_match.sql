-- Migration 004: Live Match Support
-- Run once against the production database

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS status ENUM('scheduled','live','paused','finished') NOT NULL DEFAULT 'scheduled' AFTER goals_against,
  ADD COLUMN IF NOT EXISTS started_at DATETIME NULL AFTER status;

CREATE TABLE IF NOT EXISTS match_events (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  match_id      INT NOT NULL,
  event_type    ENUM('goal','own_goal','yellow_card','red_card','substitution','half_time','full_time','penalty','missed_penalty','var') NOT NULL,
  minute        TINYINT UNSIGNED NOT NULL DEFAULT 0,
  extra_minute  TINYINT UNSIGNED NOT NULL DEFAULT 0,
  member_id     INT NULL,
  member_name_cache  VARCHAR(100) NULL,
  member_id_2   INT NULL,
  member_name_2_cache VARCHAR(100) NULL,
  is_opponent   TINYINT(1) NOT NULL DEFAULT 0,
  score_for     TINYINT UNSIGNED NOT NULL DEFAULT 0,
  score_against TINYINT UNSIGNED NOT NULL DEFAULT 0,
  notes         VARCHAR(200) NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (match_id)    REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id)   REFERENCES members(id) ON DELETE SET NULL,
  FOREIGN KEY (member_id_2) REFERENCES members(id) ON DELETE SET NULL
);
