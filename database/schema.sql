CREATE DATABASE IF NOT EXISTS club_management;
USE club_management;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('super_admin','admin','coach','member') NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  membership_number VARCHAR(20) UNIQUE,
  phone VARCHAR(20),
  date_of_birth DATE,
  address TEXT,
  join_date DATE DEFAULT (CURDATE()),
  status ENUM('active','inactive','suspended') DEFAULT 'active',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS coaches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  specialization VARCHAR(100),
  phone VARCHAR(20),
  bio TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
  title VARCHAR(200) NOT NULL,
  description TEXT,
  location VARCHAR(200),
  session_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_participants INT DEFAULT 20,
  status ENUM('scheduled','cancelled','completed') DEFAULT 'scheduled',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (coach_id) REFERENCES coaches(id)
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
  opponent VARCHAR(100) NOT NULL,
  location VARCHAR(200),
  match_date DATETIME NOT NULL,
  match_type ENUM('friendly','league','cup') DEFAULT 'league',
  home_away ENUM('home','away','neutral') DEFAULT 'home',
  result ENUM('pending','win','loss','draw') DEFAULT 'pending',
  goals_for INT DEFAULT 0,
  goals_against INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS appointments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  coach_id INT NOT NULL,
  member_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status ENUM('pending','confirmed','cancelled','completed') DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (coach_id) REFERENCES coaches(id),
  FOREIGN KEY (member_id) REFERENCES members(id)
);
