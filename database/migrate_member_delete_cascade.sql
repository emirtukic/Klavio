-- Deleting a member currently fails with a server error because
-- training_attendance and appointments reference members(id) with
-- NO ACTION (the implicit default), unlike every other member-linked
-- table in this schema which already cascades. Bring these two in line
-- so deleting a member always fully removes their records everywhere.
ALTER TABLE training_attendance DROP FOREIGN KEY training_attendance_ibfk_2;
ALTER TABLE training_attendance ADD CONSTRAINT training_attendance_ibfk_2
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE;

ALTER TABLE appointments DROP FOREIGN KEY appointments_ibfk_2;
ALTER TABLE appointments ADD CONSTRAINT appointments_ibfk_2
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE;
