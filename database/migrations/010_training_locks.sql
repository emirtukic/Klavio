-- Migration 010: let a coach/admin lock a training session's RSVP and/or
-- attendance independently, so members can't change RSVP and nobody can
-- change attendance after the fact ("zakljuci trening i prisustvo" ticket).
-- Separate from status='completed', which never locked anything.

ALTER TABLE training_sessions
  ADD COLUMN rsvp_locked TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN attendance_locked TINYINT(1) NOT NULL DEFAULT 0;
