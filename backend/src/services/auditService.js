const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ACTIONS = {
  // Scanners
  SCANNER_CREATE:  'Created scanner',
  SCANNER_UPDATE:  'Updated scanner',
  SCANNER_DELETE:  'Deleted scanner',
  // Certifications
  CERT_CREATE:     'Added certification',
  CERT_UPDATE:     'Updated certification',
  CERT_DELETE:     'Deleted certification',
  CERT_DOC_UPLOAD: 'Attached certificate document',
  CERT_DOC_REMOVE: 'Removed certificate document',
  // Notifications
  NOTICE_SENT:     'Recorded NRA notice sent',
  ALERT_RESOLVE:   'Dismissed alert',
  // Users
  USER_CREATE:     'Created user',
  USER_DELETE:     'Deleted user',
  USER_LOGIN:      'Logged in',
  // Admin
  BACKUP_DOWNLOAD: 'Downloaded database backup',
  SMTP_TEST:       'Sent SMTP test email',
  // Incidents
  TICKET_CREATE:   'Created incident ticket',
  TICKET_UPDATE:   'Updated incident ticket',
  TICKET_CLOSE:    'Closed incident ticket',
  TICKET_ESCALATE: 'Escalated incident ticket',
  LOCATION_CREATE: 'Created location',
};

async function audit(user, action, entity, entityId, details = '') {
  try {
    await prisma.auditLog.create({
      data: {
        userId:    user.id,
        userEmail: user.email,
        action,
        entity,
        entityId,
        details,
      },
    });
  } catch (err) {
    console.error('[Audit] Failed to log:', err.message);
  }
}

module.exports = { audit, ACTIONS };
