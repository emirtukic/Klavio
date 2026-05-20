-- Run this after schema.sql and all migrations
-- Creates the super admin account required to log in for the first time
-- Default password: admin123  (change immediately after first login)

USE club_management;

INSERT INTO users (name, email, password_hash, role, club_id, email_verified)
VALUES ('Super Admin', 'klavio.app@gmail.com',
        '$2b$10$tPbBB2H7uKT7FGeI7toUZeJJw9ILxW3uHkZnqLZ0ajUZphBPvWbUi',
        'super_admin', NULL, 1);
