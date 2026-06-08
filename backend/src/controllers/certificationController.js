const { PrismaClient } = require('@prisma/client');
const { addYears } = require('date-fns');
const { computeNoticeDate, computeDaysToExpiry, computeStatus } = require('../services/statusService');
const { audit, ACTIONS } = require('../services/auditService');

const prisma = new PrismaClient();

async function list(req, res, next) {
  try {
    const { status, from, to } = req.query;
    const where = {};
    if (status) where.status = status;
    if (from || to) {
      where.expiryDate = {};
      if (from) where.expiryDate.gte = new Date(from);
      if (to) where.expiryDate.lte = new Date(to);
    }

    const certs = await prisma.certification.findMany({
      where,
      include: {
        scanner: true,
        notifications: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { expiryDate: 'asc' },
    });

    res.json(certs.map((c) => ({ ...c, daysToExpiry: computeDaysToExpiry(c.expiryDate) })));
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const cert = await prisma.certification.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        scanner: true,
        notifications: { orderBy: { createdAt: 'desc' } },
        alertLogs: { orderBy: { createdAt: 'desc' } },
      },
    });
    res.json({ ...cert, daysToExpiry: computeDaysToExpiry(cert.expiryDate) });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { scannerId, inspectionDate, expiryDate, certificateStatus } = req.body;
    if (!scannerId || !inspectionDate) {
      return res.status(400).json({ error: 'scannerId and inspectionDate are required.' });
    }

    // Expiry defaults to exactly 1 year from inspection date
    const inspection = new Date(inspectionDate);
    const expiry = expiryDate ? new Date(expiryDate) : addYears(inspection, 1);
    const noticeDate = computeNoticeDate(expiry);
    const status = computeStatus(expiry, noticeDate, false);

    const cert = await prisma.certification.create({
      data: {
        scannerId,
        inspectionDate: inspection,
        expiryDate: expiry,
        noticeDate,
        certificateStatus: certificateStatus || 'ISSUED',
        status,
      },
      include: { scanner: true },
    });

    await prisma.notification.create({ data: { certificationId: cert.id } });
    await audit(req.user, ACTIONS.CERT_CREATE, 'Certification', cert.id, `Scanner: ${cert.scanner.serialNumber}`);
    res.status(201).json({ ...cert, daysToExpiry: computeDaysToExpiry(expiry) });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const { inspectionDate, expiryDate, certificateStatus } = req.body;

    const current = await prisma.certification.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { notifications: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    const inspection = inspectionDate ? new Date(inspectionDate) : current.inspectionDate;
    // If inspectionDate changed but no explicit expiryDate given, recalculate expiry (1 year from inspection)
    const expiry = expiryDate
      ? new Date(expiryDate)
      : (inspectionDate ? addYears(inspection, 1) : current.expiryDate);
    const noticeDate = computeNoticeDate(expiry);
    const noticeSent = current.notifications[0]?.noticeStatus === 'SENT';
    const status = computeStatus(expiry, noticeDate, noticeSent);

    const cert = await prisma.certification.update({
      where: { id: req.params.id },
      data: {
        inspectionDate: inspection,
        expiryDate: expiry,
        noticeDate,
        certificateStatus: certificateStatus || current.certificateStatus,
        status,
      },
      include: { scanner: true },
    });
    await audit(req.user, ACTIONS.CERT_UPDATE, 'Certification', cert.id, `Scanner: ${cert.scanner.serialNumber}`);
    res.json({ ...cert, daysToExpiry: computeDaysToExpiry(expiry) });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    await prisma.certification.delete({ where: { id: req.params.id } });
    res.json({ message: 'Certification deleted.' });
  } catch (err) { next(err); }
}

async function uploadDocument(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

    const cert = await prisma.certification.update({
      where: { id: req.params.id },
      data: {
        documentUrl:  `/uploads/${req.file.filename}`,
        documentName: req.file.originalname,
      },
      include: { scanner: true },
    });

    await audit(req.user, ACTIONS.CERT_DOC_UPLOAD, 'Certification', cert.id, `Scanner: ${cert.scanner.serialNumber} – ${req.file.originalname}`);
    res.json({ ...cert, daysToExpiry: computeDaysToExpiry(cert.expiryDate) });
  } catch (err) { next(err); }
}

async function removeDocument(req, res, next) {
  try {
    const cert = await prisma.certification.update({
      where: { id: req.params.id },
      data: { documentUrl: null, documentName: null },
    });
    res.json(cert);
  } catch (err) { next(err); }
}

module.exports = { list, getOne, create, update, remove, uploadDocument, removeDocument };
