-- Migration 006: Turniri (tournaments)
-- Run once against the production database

CREATE TABLE IF NOT EXISTS tournaments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  club_id INT NOT NULL,
  selection_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  location VARCHAR(200) NULL,
  date_start DATE NOT NULL,
  date_end DATE NOT NULL,
  default_match_date DATETIME NOT NULL,
  default_match_type ENUM('friendly','league','cup') NOT NULL DEFAULT 'cup',
  default_home_away ENUM('home','away','neutral') NOT NULL DEFAULT 'neutral',
  entry_fee_amount DECIMAL(10,2) NULL,
  notes TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
  FOREIGN KEY (selection_id) REFERENCES selections(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tournament_teams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tournament_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
);

-- Separate from the existing, unrelated `match_fees` table - this tracks the
-- one-off tournament entry fee ("kotizacija"), never membership_fees.
CREATE TABLE IF NOT EXISTS tournament_entry_fees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tournament_id INT NOT NULL,
  member_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status ENUM('pending','paid') NOT NULL DEFAULT 'pending',
  paid_date DATE NULL,
  payment_method VARCHAR(50) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tournament_member (tournament_id, member_id),
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);

ALTER TABLE matches
  ADD COLUMN tournament_id INT NULL AFTER selection_id;

ALTER TABLE matches
  ADD CONSTRAINT fk_matches_tournament FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE SET NULL;

ALTER TABLE member_availability
  MODIFY COLUMN event_type ENUM('training','match','tournament') NOT NULL;

INSERT INTO email_templates (template_key, subject, heading, intro_text, secondary_note, info_title, info_body, button_label, enabled, always_send) VALUES
('tournament_invite', 'Pozvani ste na turnir {{turnir}}', 'Pozvani ste na turnir', 'Pozdrav {{ime}}, pozvani ste da učestvujete na turniru "{{turnir}}" sa selekcijom {{selekcija}} ({{datum_od}} - {{datum_do}}, {{lokacija}}). Potvrdite dolazak.', NULL, NULL, NULL, 'Potvrdi dolazak', 1, 0),
('tournament_fee_created', 'Kotizacija za turnir {{turnir}}', 'Kotizacija za turnir', 'Kotizacija za turnir "{{turnir}}" iznosi {{iznos}} KM.', NULL, NULL, NULL, 'Pogledaj turnir', 1, 0),
('tournament_fee_paid', 'Kotizacija plaćena - {{turnir}}', 'Kotizacija plaćena', 'Vaša kotizacija od {{iznos}} KM za turnir "{{turnir}}" je zabilježena kao plaćena.', NULL, NULL, NULL, 'Pogledaj turnir', 1, 0)
ON DUPLICATE KEY UPDATE template_key = template_key;
