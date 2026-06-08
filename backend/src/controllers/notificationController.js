const { PrismaClient } = require('@prisma/client');
const { computeStatus } = require('../services/statusService');
const { audit, ACTIONS } = require('../services/auditService');
const path = require('path');

const prisma = new PrismaClient();

async function list(req, res, next) {
  try {
    const { certificationId } = req.query;
    const where = certificationId ? { certificationId } : {};
    const notifications = await prisma.notification.findMany({
      where,
      include: {
        certification: { include: { scanner: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(notifications);
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const n = await prisma.notification.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { certification: { include: { scanner: true } } },
    });
    res.json(n);
  } catch (err) { next(err); }
}

async function markSent(req, res, next) {
  try {
    const { method, referenceNumber, notes, dateSent } = req.body;
    const documentUrl = req.file
      ? `/uploads/${req.file.filename}`
      : undefined;

    const notification = await prisma.notification.update({
      where: { id: req.params.id },
      data: {
        noticeStatus: 'SENT',
        dateSent: dateSent ? new Date(dateSent) : new Date(),
        method: method || 'EMAIL',
        referenceNumber,
        notes,
        ...(documentUrl && { documentUrl }),
      },
      include: { certification: true },
    });

    // Update the parent certification status to NOTICE_SENT
    const cert = notification.certification;
    const newStatus = computeStatus(cert.expiryDate, cert.noticeDate, true);
    await prisma.certification.update({
      where: { id: cert.id },
      data: { status: newStatus },
    });

    const scanner = notification.certification?.scanner;
    await audit(req.user, ACTIONS.NOTICE_SENT, 'Notification', notification.id,
      `Scanner: ${scanner?.serialNumber ?? notification.certificationId} – Ref: ${referenceNumber || '—'}`);
    res.json(notification);
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const { noticeStatus, method, referenceNumber, notes, dateSent } = req.body;
    const documentUrl = req.file ? `/uploads/${req.file.filename}` : undefined;

    const notification = await prisma.notification.update({
      where: { id: req.params.id },
      data: {
        ...(noticeStatus && { noticeStatus }),
        ...(method && { method }),
        ...(referenceNumber !== undefined && { referenceNumber }),
        ...(notes !== undefined && { notes }),
        ...(dateSent && { dateSent: new Date(dateSent) }),
        ...(documentUrl && { documentUrl }),
      },
    });
    res.json(notification);
  } catch (err) { next(err); }
}

async function listAlerts(req, res, next) {
  try {
    const alerts = await prisma.alertLog.findMany({
      where: { resolved: false },
      include: { certification: { include: { scanner: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(alerts);
  } catch (err) { next(err); }
}

async function resolveAlert(req, res, next) {
  try {
    await prisma.alertLog.update({ where: { id: req.params.id }, data: { resolved: true } });
    res.json({ message: 'Alert resolved.' });
  } catch (err) { next(err); }
}

module.exports = { list, getOne, markSent, update, listAlerts, resolveAlert };
