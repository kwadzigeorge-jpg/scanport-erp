const { PrismaClient } = require('@prisma/client');
const { computeStatus, computeDaysToExpiry } = require('./statusService');
const { sendNoticeDueAlert, sendExpiryWarning, sendExpiredAlert } = require('./emailService');
const { sendNoticeDueWhatsApp, sendExpiryWarningWhatsApp, sendExpiredWhatsApp } = require('./whatsappService');

const prisma = new PrismaClient();

async function runDailyCheck() {
  console.log(`[Alert Engine] Running daily check – ${new Date().toISOString()}`);

  const certifications = await prisma.certification.findMany({
    include: { scanner: true, notifications: true },
  });

  for (const cert of certifications) {
    const latestNotification = cert.notifications[0];
    const noticeSent   = latestNotification?.noticeStatus === 'SENT';
    const daysToExpiry = computeDaysToExpiry(cert.expiryDate);
    const newStatus    = computeStatus(cert.expiryDate, cert.noticeDate, noticeSent);

    if (newStatus !== cert.status) {
      await prisma.certification.update({
        where: { id: cert.id },
        data: {
          status: newStatus,
          certificateStatus: newStatus === 'EXPIRED' ? 'EXPIRED' : cert.certificateStatus,
        },
      });
    }

    if (newStatus === 'EXPIRED') {
      await logAlert(cert.id, 'EXPIRED', `Scanner ${cert.scanner.serialNumber} certification has EXPIRED.`);
      await sendExpiredAlert(cert.scanner, cert);
      await sendExpiredWhatsApp(cert.scanner, cert);
    } else if (newStatus === 'NOTICE_DUE') {
      await logAlert(cert.id, 'NOTICE_DUE', `Scanner ${cert.scanner.serialNumber} NRA notice is due. Expires in ${daysToExpiry} days.`);
      await sendNoticeDueAlert(cert.scanner, cert, daysToExpiry);
      await sendNoticeDueWhatsApp(cert.scanner, cert, daysToExpiry);
    } else if (daysToExpiry <= 30 && daysToExpiry > 0) {
      await logAlert(cert.id, 'EXPIRY_WARNING', `Scanner ${cert.scanner.serialNumber} expires in ${daysToExpiry} days.`);
      await sendExpiryWarning(cert.scanner, cert, daysToExpiry);
      await sendExpiryWarningWhatsApp(cert.scanner, cert, daysToExpiry);
    }
  }

  console.log(`[Alert Engine] Done – checked ${certifications.length} certifications.`);
}

async function logAlert(certificationId, type, message) {
  const existing = await prisma.alertLog.findFirst({
    where: {
      certificationId, type, resolved: false,
      createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    },
  });
  if (!existing) {
    await prisma.alertLog.create({ data: { certificationId, type, message } });
  }
}

module.exports = { runDailyCheck };
