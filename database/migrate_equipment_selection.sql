USE club_management;

ALTER TABLE equipment
  ADD COLUMN IF NOT EXISTS selection_id INT NULL,
  ADD COLUMN IF NOT EXISTS assigned_by  INT NULL;

ALTER TABLE equipment
  ADD CONSTRAINT IF NOT EXISTS fk_equipment_sel   FOREIGN KEY (selection_id) REFERENCES selections(id) ON DELETE SET NULL;

ALTER TABLE equipment
  ADD CONSTRAINT IF NOT EXISTS fk_equipment_coach FOREIGN KEY (assigned_by) REFERENCES coaches(id) ON DELETE SET NULL;
