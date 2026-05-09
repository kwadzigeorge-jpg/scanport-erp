-- ============================================================================
-- Migration 013 — Seed Grievance Module Permissions
-- ============================================================================

INSERT INTO permissions (name, description) VALUES
  ('grievance.view',   'View the grievance registry and all cases'),
  ('grievance.create', 'Submit new grievances'),
  ('grievance.manage', 'Update status, assign and manage grievance cases'),
  ('grievance.export', 'Export grievance registry to XLSX')
ON CONFLICT (name) DO NOTHING;
