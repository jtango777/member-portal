-- Where a member sits, shown below their name on Haus Smiles.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS seating TEXT
  CHECK (seating IN ('Office - Main Building', 'Office - West Wing', 'Dedicated Desk', 'Open Desk'));
