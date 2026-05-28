-- Gang structure: 1 head man + 4 dockers = 5 members (no cutter role)
ALTER TABLE gang_members
  DROP CONSTRAINT IF EXISTS gang_members_role_check;

ALTER TABLE gang_members
  ADD CONSTRAINT gang_members_role_check
  CHECK (role IN ('head_man', 'docker'));
