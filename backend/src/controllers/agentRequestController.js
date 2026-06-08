const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

async function generateRequestNumber() {
  const year  = new Date().getFullYear();
  const prefix = `AGT-${year}-`;
  const last = await prisma.agentRequest.findFirst({
    where:   { requestNumber: { startsWith: prefix } },
    orderBy: { createdAt: 'desc' },
    select:  { requestNumber: true },
  });
  const seq = last
    ? parseInt(last.requestNumber.split('-')[2], 10) + 1
    : 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

/* ─── List ───────────────────────────────────────────────────────────────────── */

exports.list = async (req, res) => {
  try {
    const {
      status, requestType, containerNumber, search,
      page = 1, limit = 20,
    } = req.query;

    const where = {};
    if (status)          where.status      = status;
    if (requestType)     where.requestType = requestType;
    if (containerNumber) where.containerNumber = { contains: containerNumber.toUpperCase() };
    if (search) {
      where.OR = [
        { requestNumber:   { contains: search } },
        { containerNumber: { contains: search.toUpperCase() } },
        { agentName:       { contains: search } },
        { agencyName:      { contains: search } },
        { sealNumber:      { contains: search } },
      ];
    }

    const [total, requests] = await Promise.all([
      prisma.agentRequest.count({ where }),
      prisma.agentRequest.findMany({
        where,
        include: { submittedBy: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip:    (Number(page) - 1) * Number(limit),
        take:    Number(limit),
      }),
    ]);

    res.json({ total, page: Number(page), limit: Number(limit), requests });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch agent requests.' });
  }
};

/* ─── Get one ────────────────────────────────────────────────────────────────── */

exports.getOne = async (req, res) => {
  try {
    const request = await prisma.agentRequest.findUnique({
      where:   { id: req.params.id },
      include: { submittedBy: { select: { id: true, name: true, email: true } } },
    });
    if (!request) return res.status(404).json({ error: 'Request not found.' });
    res.json(request);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch request.' });
  }
};

/* ─── Create ─────────────────────────────────────────────────────────────────── */

exports.create = async (req, res) => {
  try {
    const {
      requestType,
      containerNumber, containerSize, sealNumber,
      bayZone, bayNumber, gangAssigned,
      agencyName, agentName, agentPhone,
      itemDescription, completionTime,
      notes,
    } = req.body;

    // Validation
    if (!requestType || !containerNumber || !containerSize) {
      return res.status(400).json({ error: 'requestType, containerNumber, and containerSize are required.' });
    }
    if (!['SEAL_CUTTING', 'GANG_UNSTUFFING'].includes(requestType)) {
      return res.status(400).json({ error: 'requestType must be SEAL_CUTTING or GANG_UNSTUFFING.' });
    }
    if (!['20FT', '40FT', '45FT'].includes(containerSize)) {
      return res.status(400).json({ error: 'containerSize must be 20FT, 40FT, or 45FT.' });
    }
    if (requestType === 'SEAL_CUTTING' && !sealNumber) {
      return res.status(400).json({ error: 'sealNumber is required for seal cutting requests.' });
    }
    if (requestType === 'GANG_UNSTUFFING') {
      if (!bayZone || !bayNumber || !gangAssigned || !agencyName || !agentName || !agentPhone || !itemDescription || !completionTime) {
        return res.status(400).json({ error: 'All fields are required for gang unstuffing requests.' });
      }
    }

    const requestNumber = await generateRequestNumber();

    const request = await prisma.agentRequest.create({
      data: {
        requestNumber,
        requestType,
        containerNumber: containerNumber.toUpperCase().trim(),
        containerSize,
        sealNumber:      sealNumber      || null,
        bayZone:         bayZone         || null,
        bayNumber:       bayNumber       || null,
        gangAssigned:    gangAssigned    || null,
        agencyName:      agencyName      || null,
        agentName:       agentName       || null,
        agentPhone:      agentPhone      || null,
        itemDescription: itemDescription || null,
        completionTime:  completionTime  ? new Date(completionTime) : null,
        notes:           notes           || null,
        submittedById:   req.user.id,
      },
      include: { submittedBy: { select: { id: true, name: true, email: true } } },
    });

    res.status(201).json(request);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create request.' });
  }
};

/* ─── Update status ──────────────────────────────────────────────────────────── */

exports.update = async (req, res) => {
  try {
    const { status, notes } = req.body;
    const VALID = ['PENDING', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'];
    if (status && !VALID.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID.join(', ')}` });
    }

    const request = await prisma.agentRequest.update({
      where: { id: req.params.id },
      data:  {
        ...(status && { status }),
        ...(notes  && { notes }),
      },
      include: { submittedBy: { select: { id: true, name: true, email: true } } },
    });

    res.json(request);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Request not found.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to update request.' });
  }
};

/* ─── Stats ──────────────────────────────────────────────────────────────────── */

exports.stats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [total, pending, approved, inProgress, completed, sealCutting, gangUnstuffing, todayCount] =
      await Promise.all([
        prisma.agentRequest.count(),
        prisma.agentRequest.count({ where: { status: 'PENDING'     } }),
        prisma.agentRequest.count({ where: { status: 'APPROVED'    } }),
        prisma.agentRequest.count({ where: { status: 'IN_PROGRESS' } }),
        prisma.agentRequest.count({ where: { status: 'COMPLETED'   } }),
        prisma.agentRequest.count({ where: { requestType: 'SEAL_CUTTING'    } }),
        prisma.agentRequest.count({ where: { requestType: 'GANG_UNSTUFFING' } }),
        prisma.agentRequest.count({ where: { createdAt: { gte: today } } }),
      ]);

    res.json({ total, pending, approved, inProgress, completed, sealCutting, gangUnstuffing, todayCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch stats.' });
  }
};
