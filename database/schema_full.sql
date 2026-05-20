CREATE DATABASE IF NOT EXISTS club_management;
USE club_management;

CREATE TABLE IF NOT EXISTS clubs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  city VARCHAR(100) NULL,
  slug VARCHAR(50) NOT NULL UNIQUE,
  primary_color VARCHAR(7) DEFAULT '#1e293b',
  secondary_color VARCHAR(7) DEFAULT '#3b82f6',
  logo_url VARCHAR(255) NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('super_admin','admin','coach','member') NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  club_id INT NULL,
  phone VARCHAR(20) NULL,
  avatar_url VARCHAR(255) NULL,
  email_verified TINYINT(1) NOT NULL DEFAULT 0,
  verification_token VARCHAR(255) NULL,
  verification_expires DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS club_subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  club_id INT NOT NULL UNIQUE,
  plan ENUM('starter','pro','klub') DEFAULT 'starter',
  price DECIMAL(10,2) DEFAULT 0,
  billing_cycle VARCHAR(20) DEFAULT 'monthly',
  status ENUM('active','overdue','cancelled') DEFAULT 'active',
  trial_ends_at DATE NULL,
  current_period_start DATE NULL,
  current_period_end DATE NULL,
  notes TEXT NULL,
  FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS selections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  club_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  club_id INT NOT NULL DEFAULT 1,
  membership_number VARCHAR(20) UNIQUE,
  phone VARCHAR(20),
  date_of_birth DATE,
  address TEXT,
  join_date DATE DEFAULT (CURDATE()),
  status ENUM('active','inactive','suspended') DEFAULT 'active',
  position VARCHAR(50) NULL,
  jersey_number INT NULL,
  selection_id INT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (club_id) REFERENCES clubs(id),
  FOREIGN KEY (selection_id) REFERENCES selections(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS coaches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  club_id INT NOT NULL DEFAULT 1,
  specialization VARCHAR(100),
  phone VARCHAR(20),
  bio TEXT,
  selection_id INT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (club_id) REFERENCES clubs(id),
  FOREIGN KEY (selection_id) REFERENCES selections(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS membership_fees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  member_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  due_date DATE NOT NULL,
  paid_date DATE,
  status ENUM('pending','paid','overdue') DEFAULT 'pending',
  payment_method VARCHAR(50),
  notes TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS training_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  coach_id INT NOT NULL,
  club_id INT NOT NULL DEFAULT 1,
  selection_id INT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  location VARCHAR(200),
  session_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_participants INT DEFAULT 20,
  status ENUM('scheduled','cancelled','completed') DEFAULT 'scheduled',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (coach_id) REFERENCES coaches(id),
  FOREIGN KEY (club_id) REFERENCES clubs(id),
  FOREIGN KEY (selection_id) REFERENCES selections(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS training_attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  member_id INT NOT NULL,
  status ENUM('present','absent','excused') DEFAULT 'present',
  UNIQUE KEY uq_attendance (session_id, member_id),
  FOREIGN KEY (session_id) REFERENCES training_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES members(id)
);

CREATE TABLE IF NOT EXISTS matches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  club_id INT NOT NULL DEFAULT 1,
  selection_id INT NULL,
  opponent VARCHAR(100) NOT NULL,
  location VARCHAR(200),
  match_date DATETIME NOT NULL,
  match_type ENUM('friendly','league','cup') DEFAULT 'league',
  home_away ENUM('home','away','neutral') DEFAULT 'home',
  result ENUM('pending','win','loss','draw') DEFAULT 'pending',
  goals_for INT DEFAULT 0,
  goals_against INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (club_id) REFERENCES clubs(id),
  FOREIGN KEY (selection_id) REFERENCES selections(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS appointments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  coach_id INT NOT NULL,
  member_id INT NOT NULL,
  club_id INT NOT NULL DEFAULT 1,
  title VARCHAR(200) NOT NULL,
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status ENUM('pending','confirmed','cancelled','completed') DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (coach_id) REFERENCES coaches(id),
  FOREIGN KEY (member_id) REFERENCES members(id),
  FOREIGN KEY (club_id) REFERENCES clubs(id)
);

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

CREATE TABLE IF NOT EXISTS equipment (
  id INT AUTO_INCREMENT PRIMARY KEY,
  club_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50),
  quantity INT DEFAULT 1,
  assigned_to INT NULL,
  item_condition ENUM('good','fair','poor','lost') DEFAULT 'good',
  notes TEXT,
  selection_id INT NULL,
  assigned_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES members(id) ON DELETE SET NULL,
  FOREIGN KEY (selection_id) REFERENCES selections(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_by) REFERENCES coaches(id) ON DELETE SET NULL
);

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

CREATE TABLE IF NOT EXISTS invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  club_id INT NOT NULL,
  invoice_number VARCHAR(50),
  amount DECIMAL(10,2) NOT NULL,
  status ENUM('unpaid','paid','overdue','cancelled') DEFAULT 'unpaid',
  due_date DATE,
  paid_date DATE,
  period_start DATE,
  period_end DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  club_id INT,
  created_by INT NOT NULL,
  subject VARCHAR(255) NOT NULL,
  priority ENUM('low','medium','high') DEFAULT 'medium',
  status ENUM('open','in_progress','resolved','closed') DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS support_ticket_replies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ticket_id INT NOT NULL,
  user_id INT NOT NULL,
  body TEXT NOT NULL,
  is_staff TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS system_notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type VARCHAR(50) DEFAULT 'general',
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS platform_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type ENUM('broadcast','direct') DEFAULT 'direct',
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  club_id INT NULL,
  sent_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sent_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS platform_message_replies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  message_id INT NOT NULL,
  user_id INT NOT NULL,
  body TEXT NOT NULL,
  is_staff TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES platform_messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
