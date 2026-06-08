const { PrismaClient } = require('@prisma/client');
const { computeDaysToExpiry } = require('../services/statusService');
const { audit, ACTIONS } = require('../services/auditService');

const prisma = new PrismaClient();

function enrichCert(cert) {
  return { ...cert, daysToExpiry: computeDaysToExpiry(cert.expiryDate) };
}

async function list(req, res, next) {
  try {
    const { search, status } = req.query;
    const where = {};
    if (search) where.serialNumber = { contains: search, mode: 'insensitive' };

    const scanners = await prisma.scanner.findMany({
      where,
      include: {
        certifications: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { notifications: { orderBy: { createdAt: 'desc' }, take: 1 } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    let result = scanners.map((s) => ({
      ...s,
      latestCert: s.certifications[0] ? enrichCert(s.certifications[0]) : null,
    }));

    if (status) result = result.filter((s) => s.latestCert?.status === status);

    res.json(result);
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const scanner = await prisma.scanner.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        certifications: {
          orderBy: { createdAt: 'desc' },
          include: {
            notifications: { orderBy: { createdAt: 'desc' } },
            alertLogs: { orderBy: { createdAt: 'desc' } },
          },
        },
      },
    });
    const enriched = {
      ...scanner,
      certifications: scanner.certifications.map(enrichCert),
    };
    res.json(enriched);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { serialNumber, acceleratorSerial, manufacturer, type, location } = req.body;
    if (!serialNumber || !acceleratorSerial) {
      return res.status(400).json({ error: 'serialNumber and acceleratorSerial are required.' });
    }
    const scanner = await prisma.scanner.create({
      data: {
        serialNumber,
        acceleratorSerial,
        manufacturer: manufacturer || 'Siemens',
        type: type || 'Fixed Scanner',
        location,
      },
    });
    await audit(req.user, ACTIONS.SCANNER_CREATE, 'Scanner', scanner.id, scanner.serialNumber);
    res.status(201).json(scanner);
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const { serialNumber, acceleratorSerial, manufacturer, type, location } = req.body;
    const scanner = await prisma.scanner.update({
      where: { id: req.params.id },
      data: { serialNumber, acceleratorSerial, manufacturer, type, location },
    });
    await audit(req.user, ACTIONS.SCANNER_UPDATE, 'Scanner', scanner.id, scanner.serialNumber);
    res.json(scanner);
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    await audit(req.user, ACTIONS.SCANNER_DELETE, 'Scanner', req.params.id, '');
    await prisma.scanner.delete({ where: { id: req.params.id } });
    res.json({ message: 'Scanner deleted.' });
  } catch (err) { next(err); }
}

module.exports = { list, getOne, create, update, remove };
