const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function list(req, res, next) {
  try {
    const { entity, action, limit = 100 } = req.query;
    const where = {};
    if (entity) where.entity = entity;
    if (action) where.action = { contains: action };

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(limit), 500),
    });
    res.json(logs);
  } catch (err) { next(err); }
}

module.exports = { list };
