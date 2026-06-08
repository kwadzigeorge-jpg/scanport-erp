const { PrismaClient } = require('@prisma/client');
const { addDays } = require('date-fns');

const prisma = new PrismaClient();

async function getStats(req, res, next) {
  try {
    const today = new Date();
    const in120 = addDays(today, 120);

    const [
      totalScanners,
      active,
      noticeDue,
      noticeSent,
      expiring120,
      expired,
      recentAlerts,
    ] = await Promise.all([
      prisma.scanner.count(),
      prisma.certification.count({ where: { status: 'ACTIVE' } }),
      prisma.certification.count({ where: { status: 'NOTICE_DUE' } }),
      prisma.certification.count({ where: { status: 'NOTICE_SENT' } }),
      prisma.certification.count({
        where: { expiryDate: { lte: in120, gte: today }, status: { not: 'EXPIRED' } },
      }),
      prisma.certification.count({ where: { status: 'EXPIRED' } }),
      prisma.alertLog.findMany({
        where: { resolved: false },
        include: { certification: { include: { scanner: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    res.json({
      totalScanners,
      active,
      noticeDue,
      noticeSent,
      expiring120,
      expired,
      pendingNotices: noticeDue,
      recentAlerts,
    });
  } catch (err) { next(err); }
}

async function getExpiringList(req, res, next) {
  try {
    const today = new Date();
    const in120 = addDays(today, 120);

    const certs = await prisma.certification.findMany({
      where: { expiryDate: { lte: in120, gte: today } },
      include: { scanner: true, notifications: { take: 1, orderBy: { createdAt: 'desc' } } },
      orderBy: { expiryDate: 'asc' },
    });

    const { differenceInDays } = require('date-fns');
    res.json(certs.map((c) => ({ ...c, daysToExpiry: differenceInDays(new Date(c.expiryDate), today) })));
  } catch (err) { next(err); }
}

module.exports = { getStats, getExpiringList };
