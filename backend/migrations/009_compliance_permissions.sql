-- ============================================================================
-- Migration 009 — Seed Compliance Module Permissions
-- Inserts all compliance.* permissions and grants them to the admin role.
-- ============================================================================

INSERT INTO permissions (name, description) VALUES
  ('compliance.view',               'View all compliance records — scanners, certificates, survey meters'),
  ('compliance.edit',               'Create and update scanners, certificates, notes'),
  ('compliance.submit_application', 'Mark certification application as submitted'),
  ('compliance.upload_certificate', 'Upload NRA certificate documents'),
  ('compliance.delete',             'Delete draft or cancelled compliance records'),
  ('maintenance.log',               'Create maintenance activity records'),
  ('maintenance.view',              'View maintenance history'),
  ('breakdown.log',                 'Log new breakdown incidents'),
  ('breakdown.edit',                'Update breakdown records and root cause analysis'),
  ('breakdown.close',               'Close and resolve breakdown records'),
  ('repair.log',                    'Create repair records'),
  ('repair.edit',                   'Update repair records and cost data'),
  ('calibration.log',               'Log survey meter calibration records'),
  ('calibration.upload',            'Upload calibration certificates'),
  ('report.compliance_view',        'View compliance reports and annual NRA report'),
  ('report.generate',               'Generate the annual NRA compliance report'),
  ('report.submit',                 'Mark annual report as submitted to NRA'),
  ('settings.compliance_manage',    'Configure reminder intervals and compliance settings')
ON CONFLICT (name) DO NOTHING;

-- Grant ALL compliance permissions to the admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin'
  AND p.name IN (
    'compliance.view', 'compliance.edit', 'compliance.submit_application',
    'compliance.upload_certificate', 'compliance.delete',
    'maintenance.log', 'maintenance.view',
    'breakdown.log', 'breakdown.edit', 'breakdown.close',
    'repair.log', 'repair.edit',
    'calibration.log', 'calibration.upload',
    'report.compliance_view', 'report.generate', 'report.submit',
    'settings.compliance_manage'
  )
ON CONFLICT DO NOTHING;

-- Also grant view + log permissions to supervisor role if it exists
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'supervisor'
  AND p.name IN (
    'compliance.view', 'maintenance.view',
    'report.compliance_view'
  )
ON CONFLICT DO NOTHING;
