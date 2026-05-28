-- Add head_man role to gang_members and adjust docker limit from 4 to 3
ALTER TABLE gang_members
  DROP CONSTRAINT IF EXISTS gang_members_role_check;

ALTER TABLE gang_members
  ADD CONSTRAINT gang_members_role_check
  CHECK (role IN ('head_man', 'docker', 'cutter'));
