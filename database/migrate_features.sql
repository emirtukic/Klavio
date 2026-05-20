-- Feature expansion migration
-- Run after migrate_multitenancy.sql and migrate_selections.sql

USE club_management;

-- 1. Enhance members table
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS position VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS jersey_number INT NULL;

-- 2. Medical data
CREATE TABLE IF NOT EXISTS member_medical (
  id INT AUTO_INCREMENT PRIMARY KEY,
  member_id INT NOT NULL UNIQUE,
  blood_type VARCHAR(5),
  allergies TEXT,
  current_injuries TEXT,
  medical_notes TEXT,
  emergency_contact_name VARCHAR(100),
  emergency_contact_phone VARCHAR(20),
  emergency_contact_relation VARCHAR(50),
  last_medical_check DATE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);

-- 3. Availability (member confirms/declines training or match)
CREATE TABLE IF NOT EXISTS member_availability (
  id INT AUTO_INCREMENT PRIMARY KEY,
  member_id INT NOT NULL,
  event_type ENUM('training','match') NOT NULL,
  event_id INT NOT NULL,
  status ENUM('pending','available','unavailable') DEFAULT 'pending',
  note TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_availability (member_id, event_type, event_id),
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);

-- 4. Finance ledger (income/expenses)
CREATE TABLE IF NOT EXISTS finances (
  id INT AUTO_INCREMENT PRIMARY KEY,
  club_id INT NOT NULL,
  type ENUM('income','expense') NOT NULL,
  category VARCHAR(100) NOT NULL,
  description TEXT,
  amount DECIMAL(10,2) NOT NULL,
  date DATE NOT NULL,
  reference VARCHAR(100),
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 5. Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  club_id INT,
  user_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('info','warning','success','danger') DEFAULT 'info',
  is_read BOOLEAN DEFAULT FALSE,
  link VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 6. Announcements (bulletin board)
CREATE TABLE IF NOT EXISTS announcements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  club_id INT NOT NULL,
  author_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id)
);

-- 7. Player statistics per match
CREATE TABLE IF NOT EXISTS player_stats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  member_id INT NOT NULL,
  match_id INT NOT NULL,
  club_id INT NOT NULL,
  goals INT DEFAULT 0,
  assists INT DEFAULT 0,
  yellow_cards INT DEFAULT 0,
  red_cards INT DEFAULT 0,
  minutes_played INT DEFAULT 90,
  started BOOLEAN DEFAULT TRUE,
  UNIQUE KEY uq_player_match (member_id, match_id),
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
);

-- 8. Match lineup
CREATE TABLE IF NOT EXISTS match_lineup (
  id INT AUTO_INCREMENT PRIMARY KEY,
  match_id INT NOT NULL,
  member_id INT NOT NULL,
  club_id INT NOT NULL,
  position VARCHAR(50),
  is_starter BOOLEAN DEFAULT TRUE,
  jersey_number INT,
  UNIQUE KEY uq_lineup (match_id, member_id),
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);

-- 9. Activity log / audit trail
CREATE TABLE IF NOT EXISTS activity_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  club_id INT,
  user_id INT NOT NULL,
  user_name VARCHAR(100),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id INT,
  details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 10. Sponsors
CREATE TABLE IF NOT EXISTS sponsors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  club_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  logo_url VARCHAR(255),
  website VARCHAR(255),
  contact_name VARCHAR(100),
  contact_email VARCHAR(100),
  amount DECIMAL(10,2),
  type ENUM('main','secondary','technical') DEFAULT 'secondary',
  active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE
);

-- 11. Equipment
CREATE TABLE IF NOT EXISTS equipment (
  id INT AUTO_INCREMENT PRIMARY KEY,
  club_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50),
  quantity INT DEFAULT 1,
  assigned_to INT NULL,
  item_condition ENUM('good','fair','poor','lost') DEFAULT 'good',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES members(id) ON DELETE SET NULL
);

-- 12. Gallery
CREATE TABLE IF NOT EXISTS gallery (
  id INT AUTO_INCREMENT PRIMARY KEY,
  club_id INT NOT NULL,
  uploaded_by INT NOT NULL,
  filename VARCHAR(255) NOT NULL,
  url VARCHAR(255) NOT NULL,
  title VARCHAR(200),
  event_type ENUM('training','match','other') DEFAULT 'other',
  event_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
);

-- 13. Player development plans
CREATE TABLE IF NOT EXISTS player_development (
  id INT AUTO_INCREMENT PRIMARY KEY,
  member_id INT NOT NULL,
  coach_id INT NOT NULL,
  club_id INT NOT NULL,
  season VARCHAR(20),
  goals TEXT,
  strengths TEXT,
  improvements TEXT,
  notes TEXT,
  rating INT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_dev (member_id, season),
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE CASCADE
);

-- 14. Match fees
CREATE TABLE IF NOT EXISTS match_fees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  club_id INT NOT NULL,
  member_id INT NOT NULL,
  match_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status ENUM('pending','paid','overdue') DEFAULT 'pending',
  paid_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_match_fee (member_id, match_id),
  FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
);
