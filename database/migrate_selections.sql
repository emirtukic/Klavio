USE club_management;

CREATE TABLE IF NOT EXISTS selections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  club_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE
);

ALTER TABLE coaches ADD COLUMN IF NOT EXISTS selection_id INT NULL;
ALTER TABLE members ADD COLUMN IF NOT EXISTS selection_id INT NULL;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS selection_id INT NULL;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS selection_id INT NULL;

ALTER TABLE coaches ADD CONSTRAINT fk_coaches_sel FOREIGN KEY (selection_id) REFERENCES selections(id) ON DELETE SET NULL;
ALTER TABLE members ADD CONSTRAINT fk_members_sel FOREIGN KEY (selection_id) REFERENCES selections(id) ON DELETE SET NULL;
ALTER TABLE training_sessions ADD CONSTRAINT fk_training_sel FOREIGN KEY (selection_id) REFERENCES selections(id) ON DELETE SET NULL;
ALTER TABLE matches ADD CONSTRAINT fk_matches_sel FOREIGN KEY (selection_id) REFERENCES selections(id) ON DELETE SET NULL;
