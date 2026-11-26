-- Migration 009: appointments.coach_id and training_sessions.coach_id were
-- ON DELETE NO ACTION, so deleting a coach who had ever had an appointment
-- or training session raised a raw DB error ("Server error") instead of
-- cleanly detaching the record - same bug class fixed for users in
-- migration 008. Run once against the production database.

ALTER TABLE appointments
  MODIFY COLUMN coach_id INT NULL;
ALTER TABLE appointments
  DROP FOREIGN KEY appointments_ibfk_1;
ALTER TABLE appointments
  ADD CONSTRAINT appointments_ibfk_1 FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE SET NULL;

ALTER TABLE training_sessions
  MODIFY COLUMN coach_id INT NULL;
ALTER TABLE training_sessions
  DROP FOREIGN KEY training_sessions_ibfk_1;
ALTER TABLE training_sessions
  ADD CONSTRAINT training_sessions_ibfk_1 FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE SET NULL;
