USE club_management;

-- Lets a member/coach belong to more than one selection at once.
-- members.selection_id / coaches.selection_id are kept unchanged and keep
-- meaning "primary selection" (used everywhere that already reads them).
-- These join tables are the new source of truth for "which selections can
-- this person see/act within".
CREATE TABLE IF NOT EXISTS member_selections (
  member_id INT NOT NULL,
  selection_id INT NOT NULL,
  PRIMARY KEY (member_id, selection_id),
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  FOREIGN KEY (selection_id) REFERENCES selections(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS coach_selections (
  coach_id INT NOT NULL,
  selection_id INT NOT NULL,
  PRIMARY KEY (coach_id, selection_id),
  FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE CASCADE,
  FOREIGN KEY (selection_id) REFERENCES selections(id) ON DELETE CASCADE
);

-- Backfill: every existing single assignment becomes their first join-table row.
INSERT IGNORE INTO member_selections (member_id, selection_id)
  SELECT id, selection_id FROM members WHERE selection_id IS NOT NULL;
INSERT IGNORE INTO coach_selections (coach_id, selection_id)
  SELECT id, selection_id FROM coaches WHERE selection_id IS NOT NULL;
