-- Migration 008: Two FKs referencing users(id) were ON DELETE NO ACTION,
-- meaning deleting a user was BLOCKED if they had ever authored an
-- announcement or been the created_by on a membership fee - inconsistent
-- with every other created_by/author_id FK to users (finances,
-- system_notifications) which already use SET NULL. A blocked delete left
-- the user (and their email) stuck forever with no error surfaced clearly
-- to the admin. Run once against the production database.

ALTER TABLE membership_fees
  DROP FOREIGN KEY membership_fees_ibfk_2;
ALTER TABLE membership_fees
  ADD CONSTRAINT membership_fees_ibfk_2 FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE announcements
  MODIFY COLUMN author_id INT NULL;
ALTER TABLE announcements
  DROP FOREIGN KEY announcements_ibfk_2;
ALTER TABLE announcements
  ADD CONSTRAINT announcements_ibfk_2 FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL;
