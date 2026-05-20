USE club_management;

-- Clubs table (each club is a separate tenant)
CREATE TABLE IF NOT EXISTS clubs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) NOT NULL UNIQUE,
  primary_color VARCHAR(7) DEFAULT '#1e293b',
  secondary_color VARCHAR(7) DEFAULT '#3b82f6',
  logo_url VARCHAR(255) NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default club for existing data
INSERT IGNORE INTO clubs (id, name, slug, primary_color, secondary_color)
VALUES (1, 'FK Primjer', 'fk-primjer', '#1e293b', '#3b82f6');

-- Add club_id to users (NULL = super_admin, belongs to no club)
ALTER TABLE users ADD COLUMN IF NOT EXISTS club_id INT NULL;

-- Add club_id to tenant tables
ALTER TABLE members ADD COLUMN IF NOT EXISTS club_id INT NOT NULL DEFAULT 1;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS club_id INT NOT NULL DEFAULT 1;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS club_id INT NOT NULL DEFAULT 1;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS club_id INT NOT NULL DEFAULT 1;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS club_id INT NOT NULL DEFAULT 1;

-- Assign existing non-super_admin users to club 1
UPDATE users SET club_id = 1 WHERE role != 'super_admin' AND club_id IS NULL;

-- Add foreign key constraints (safe to skip if already exist)
ALTER TABLE users ADD CONSTRAINT fk_users_club FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE SET NULL;
ALTER TABLE members ADD CONSTRAINT fk_members_club FOREIGN KEY (club_id) REFERENCES clubs(id);
ALTER TABLE coaches ADD CONSTRAINT fk_coaches_club FOREIGN KEY (club_id) REFERENCES clubs(id);
ALTER TABLE training_sessions ADD CONSTRAINT fk_training_club FOREIGN KEY (club_id) REFERENCES clubs(id);
ALTER TABLE matches ADD CONSTRAINT fk_matches_club FOREIGN KEY (club_id) REFERENCES clubs(id);
ALTER TABLE appointments ADD CONSTRAINT fk_appointments_club FOREIGN KEY (club_id) REFERENCES clubs(id);
