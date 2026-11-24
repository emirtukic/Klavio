USE club_management;

-- Frontend RSVP buttons post status 'yes'/'maybe'/'no', but the column only
-- allowed 'pending'/'available'/'unavailable' - every RSVP attempt threw a
-- data-truncation error under strict SQL mode (confirmed 0 rows ever saved).
ALTER TABLE member_availability
  MODIFY COLUMN status ENUM('pending','yes','maybe','no') DEFAULT 'pending';
