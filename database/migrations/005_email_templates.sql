-- Migration 005: Editable email templates + branding (super_admin only)
-- Run once against the production database.
-- email_templates rows are seeded from backend/config/emailTemplateStore.js's
-- DEFAULTS object via a one-off Node script, not hardcoded here, so the
-- migration and "reset to default" never drift apart.

CREATE TABLE IF NOT EXISTS email_branding (
  id INT PRIMARY KEY DEFAULT 1,
  logo_url VARCHAR(500) NOT NULL DEFAULT 'https://klavioclub.com/assets/img/favicon-192.png',
  brand_name VARCHAR(100) NOT NULL DEFAULT 'KLAVIO',
  accent_color VARCHAR(7) NOT NULL DEFAULT '#2563eb',
  footer_tagline VARCHAR(200) NOT NULL DEFAULT 'Platforma za upravljanje fudbalskim klubom',
  footer_address VARCHAR(200) NOT NULL DEFAULT 'Sarajevo, Bosna i Hercegovina',
  footer_email VARCHAR(100) NOT NULL DEFAULT 'info@klavioclub.com',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
INSERT IGNORE INTO email_branding (id) VALUES (1);

CREATE TABLE IF NOT EXISTS email_templates (
  template_key VARCHAR(50) PRIMARY KEY,
  subject VARCHAR(200) NOT NULL,
  heading VARCHAR(200) NOT NULL,
  intro_text TEXT NULL,
  secondary_note VARCHAR(300) NULL,
  info_title VARCHAR(100) NULL,
  info_body VARCHAR(500) NULL,
  button_label VARCHAR(50) NOT NULL DEFAULT 'Otvori',
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  always_send TINYINT(1) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
