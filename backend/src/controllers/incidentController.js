const { PrismaClient } = require('@prisma/client');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const { format, differenceInMinutes, differenceInHours, subDays, startOfDay, endOfDay } = require('date-fns');
const path = require('path');
const { audit, ACTIONS } = require('../services/auditService');

const prisma = new PrismaClient();

// SLA thresholds in hours: { firstResponse, resolution }
const SLA = {
  CRITICAL: { firstResponse: 1,  resolution: 4  },
  MAJOR:    { firstResponse: 2,  resolution: 8  },
  MINOR:    { firstResponse: 4,  resolution: 24 },
};

function getSla(severity) {
  return SLA[severity?.toUpperCase()] || SLA.MINOR;
}

// Generate ticket number: CODE-YEAR-XXXX
async function generateTicketNumber(locationCode) {
  const year = new Date().getFullYear();
  const prefix = `${locationCode}-${year}`;
  const count = await prisma.ticket.count({
    where: { ticketNumber: { startsWith: prefix } },
  });
  const seq = String(count + 1).padStart(4, '0');
  return `${prefix}-${seq}`;
}

function calcDowntime(startTime, resolvedAt) {
  if (!resolvedAt) return null;
  return differenceInMinutes(new Date(resolvedAt), new Date(startTime));
}

function slaStatus(ticket) {
  const sla = getSla(ticket.severity);
  const now = new Date();
  const start = new Date(ticket.startTime);
  const hoursElapsed = differenceInHours(now, start);

  const resolutionDeadline = new Date(start);
  resolutionDeadline.setHours(resolutionDeadline.getHours() + sla.resolution);

  const responseDeadline = new Date(start);
  responseDeadline.setHours(responseDeadline.getHours() + sla.firstResponse);

  const isResolved = ['RESOLVED', 'CLOSED'].includes(ticket.status);
  const resolvedTime = ticket.resolvedAt ? new Date(ticket.resolvedAt) : null;

  return {
    slaHours:          sla.resolution,
    responseHours:     sla.firstResponse,
    resolutionDeadline,
    responseDeadline,
    responseBreached:  ticket.firstResponseAt
      ? differenceInHours(new Date(ticket.firstResponseAt), start) > sla.firstResponse
      : !isResolved && now > responseDeadline,
    resolutionBreached: isResolved
      ? resolvedTime > resolutionDeadline
      : !isResolved && now > resolutionDeadline,
    minutesRemaining:  isResolved ? 0 : Math.max(0, differenceInMinutes(resolutionDeadline, now)),
    hoursElapsed,
  };
}

// ─── List Tickets ────────────────────────────────────────────────────────────

async function listTickets(req, res, next) {
  try {
    const {
      status, severity, locationId, issueType, equipmentType,
      search, dateFrom, dateTo, page = 1, limit = 50,
    } = req.query;

    const where = {};
    if (status)        where.status        = status;
    if (severity)      where.severity      = severity;
    if (locationId)    where.locationId    = locationId;
    if (issueType)     where.issueType     = issueType;
    if (equipmentType) where.equipmentType = equipmentType;
    if (search)        where.OR = [
      { title:        { contains: search } },
      { description:  { contains: search } },
      { ticketNumber: { contains: search } },
    ];
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo)   where.createdAt.lte = endOfDay(new Date(dateTo));
    }

    const [total, tickets] = await Promise.all([
      prisma.ticket.count({ where }),
      prisma.ticket.findMany({
        where,
        include: {
          location:      true,
          reportedBy:    { select: { id: true, name: true, email: true } },
          assignedToUser: { select: { id: true, name: true, email: true } },
          _count: { select: { activities: true, attachments: true } },
        },
        orderBy: [
          { severity: 'asc' },  // CRITICAL first (alphabetically C < M)
          { createdAt: 'desc' },
        ],
        skip:  (Number(page) - 1) * Number(limit),
        take:  Number(limit),
      }),
    ]);

    const enriched = tickets.map((t) => ({
      ...t,
      sla: slaStatus(t),
      downtimeMinutes: calcDowntime(t.startTime, t.resolvedAt),
    }));

    res.json({ total, page: Number(page), limit: Number(limit), tickets: enriched });
  } catch (err) { next(err); }
}

// ─── Get Single Ticket ───────────────────────────────────────────────────────

async function getTicket(req, res, next) {
  try {
    const ticket = await prisma.ticket.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        location:      true,
        reportedBy:    { select: { id: true, name: true, email: true, role: true } },
        assignedToUser: { select: { id: true, name: true, email: true, role: true } },
        attachments:   { orderBy: { createdAt: 'desc' } },
        activities:    {
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    res.json({ ...ticket, sla: slaStatus(ticket) });
  } catch (err) { next(err); }
}

// ─── Create Ticket ───────────────────────────────────────────────────────────

async function createTicket(req, res, next) {
  try {
    const {
      title, description, locationId, equipmentType,
      issueType, severity, assignedTo, assignedToId,
    } = req.body;

    if (!title || !description || !locationId || !equipmentType || !issueType || !severity) {
      return res.status(400).json({ error: 'title, description, locationId, equipmentType, issueType, severity are required.' });
    }

    // Verify the requesting user still exists (catches stale JWT after re-seed)
    const reporter = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!reporter) {
      return res.status(401).json({ error: 'Session expired — please log out and log back in.' });
    }

    const location = await prisma.location.findUniqueOrThrow({ where: { id: locationId } });
    const ticketNumber = await generateTicketNumber(location.code);

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        title,
        description,
        locationId,
        equipmentType,
        issueType,
        severity:       severity.toUpperCase(),
        assignedTo:     assignedTo || null,
        assignedToId:   assignedToId || null,
        reportedById:   req.user.id,
        startTime:      new Date(),
      },
      include: {
        location:    true,
        reportedBy:  { select: { id: true, name: true, email: true } },
      },
    });

    // Log initial activity
    await prisma.ticketActivity.create({
      data: {
        ticketId:  ticket.id,
        userId:    req.user.id,
        userEmail: req.user.email,
        userName:  req.user.name,
        action:    'Ticket created',
        toStatus:  'OPEN',
        notes:     `Reported by ${req.user.name}. Assigned to: ${assignedTo || 'Unassigned'}.`,
      },
    });

    await audit(req.user, ACTIONS.TICKET_CREATE, 'Ticket', ticket.id, ticket.ticketNumber);

    res.status(201).json({ ...ticket, sla: slaStatus(ticket) });
  } catch (err) { next(err); }
}

// ─── Update Ticket ───────────────────────────────────────────────────────────

async function updateTicket(req, res, next) {
  try {
    const {
      status, assignedTo, assignedToId, resolutionNotes,
      escalationLevel, notes, severity, title, description,
      equipmentType, issueType,
    } = req.body;

    const existing = await prisma.ticket.findUniqueOrThrow({ where: { id: req.params.id } });

    const data = {};
    const activities = [];

    if (title)          data.title          = title;
    if (description)    data.description    = description;
    if (equipmentType)  data.equipmentType  = equipmentType;
    if (issueType)      data.issueType      = issueType;
    if (severity)       data.severity       = severity.toUpperCase();
    if (assignedTo !== undefined)  data.assignedTo   = assignedTo || null;
    if (assignedToId !== undefined) data.assignedToId = assignedToId || null;
    if (escalationLevel) data.escalationLevel = Number(escalationLevel);

    if (status && status !== existing.status) {
      const validTransitions = {
        OPEN:        ['IN_PROGRESS', 'ESCALATED', 'CLOSED'],
        IN_PROGRESS: ['RESOLVED', 'ESCALATED', 'OPEN'],
        ESCALATED:   ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
        RESOLVED:    ['CLOSED', 'IN_PROGRESS'],
        CLOSED:      [],
      };

      if (!validTransitions[existing.status]?.includes(status)) {
        return res.status(400).json({
          error: `Cannot transition from ${existing.status} to ${status}.`,
        });
      }

      data.status = status;

      if (status === 'IN_PROGRESS' && !existing.firstResponseAt) {
        data.firstResponseAt = new Date();
      }
      if (status === 'RESOLVED') {
        data.resolvedAt = new Date();
        data.downtimeMinutes = calcDowntime(existing.startTime, new Date());
        if (resolutionNotes) data.resolutionNotes = resolutionNotes;
      }
      if (status === 'CLOSED') {
        data.closedAt = new Date();
      }

      activities.push({
        ticketId:   existing.id,
        userId:     req.user.id,
        userEmail:  req.user.email,
        userName:   req.user.name,
        action:     `Status changed to ${status}`,
        fromStatus: existing.status,
        toStatus:   status,
        notes:      notes || null,
      });
    } else if (notes) {
      activities.push({
        ticketId:  existing.id,
        userId:    req.user.id,
        userEmail: req.user.email,
        userName:  req.user.name,
        action:    'Comment added',
        notes,
      });
    }

    if (assignedTo !== undefined && assignedTo !== existing.assignedTo) {
      activities.push({
        ticketId:  existing.id,
        userId:    req.user.id,
        userEmail: req.user.email,
        userName:  req.user.name,
        action:    `Assigned to ${assignedTo || 'Unassigned'}`,
        notes:     null,
      });
    }

    if (escalationLevel && escalationLevel !== existing.escalationLevel) {
      activities.push({
        ticketId:  existing.id,
        userId:    req.user.id,
        userEmail: req.user.email,
        userName:  req.user.name,
        action:    `Escalated to Level ${escalationLevel}`,
        notes:     notes || null,
      });
    }

    const updated = await prisma.ticket.update({
      where: { id: req.params.id },
      data,
      include: {
        location:      true,
        reportedBy:    { select: { id: true, name: true, email: true } },
        assignedToUser: { select: { id: true, name: true, email: true } },
        attachments:   true,
        activities:    {
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (activities.length) {
      await prisma.ticketActivity.createMany({ data: activities });
    }

    await audit(req.user, ACTIONS.TICKET_UPDATE, 'Ticket', updated.id,
      `${updated.ticketNumber} – ${status ? `status → ${status}` : 'fields updated'}`);

    res.json({ ...updated, sla: slaStatus(updated) });
  } catch (err) { next(err); }
}

// ─── Add Comment ─────────────────────────────────────────────────────────────

async function addComment(req, res, next) {
  try {
    const { notes } = req.body;
    if (!notes?.trim()) return res.status(400).json({ error: 'notes is required.' });

    const activity = await prisma.ticketActivity.create({
      data: {
        ticketId:  req.params.id,
        userId:    req.user.id,
        userEmail: req.user.email,
        userName:  req.user.name,
        action:    'Comment added',
        notes:     notes.trim(),
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    res.status(201).json(activity);
  } catch (err) { next(err); }
}

// ─── List Locations ───────────────────────────────────────────────────────────

async function listLocations(req, res, next) {
  try {
    const locations = await prisma.location.findMany({ orderBy: { name: 'asc' } });
    res.json(locations);
  } catch (err) { next(err); }
}

// ─── Dashboard Stats ─────────────────────────────────────────────────────────

async function getIncidentStats(req, res, next) {
  try {
    const today = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    const last30 = subDays(today, 30);

    const [
      totalToday,
      openTickets,
      inProgressTickets,
      escalatedTickets,
      criticalOpen,
      resolvedToday,
      allTickets30d,
      byLocation,
      byIssueType,
      bySeverity,
      recentTickets,
    ] = await Promise.all([
      prisma.ticket.count({ where: { createdAt: { gte: today, lte: todayEnd } } }),
      prisma.ticket.count({ where: { status: 'OPEN' } }),
      prisma.ticket.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.ticket.count({ where: { status: 'ESCALATED' } }),
      prisma.ticket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS', 'ESCALATED'] }, severity: 'CRITICAL' } }),
      prisma.ticket.count({ where: { status: { in: ['RESOLVED', 'CLOSED'] }, resolvedAt: { gte: today } } }),
      prisma.ticket.findMany({
        where: { createdAt: { gte: last30 } },
        select: { severity: true, status: true, downtimeMinutes: true, resolvedAt: true, startTime: true, slaBreached: true },
      }),
      prisma.ticket.groupBy({
        by: ['locationId'],
        _count: { id: true },
        _sum:   { downtimeMinutes: true },
        where:  { createdAt: { gte: last30 } },
      }),
      prisma.ticket.groupBy({
        by:    ['issueType'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
      prisma.ticket.groupBy({
        by:    ['severity'],
        _count: { id: true },
      }),
      prisma.ticket.findMany({
        where:   { status: { in: ['OPEN', 'IN_PROGRESS', 'ESCALATED'] } },
        include: { location: true },
        orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
        take: 10,
      }),
    ]);

    // Enrich byLocation with names
    const locationIds = byLocation.map((b) => b.locationId);
    const locations = await prisma.location.findMany({ where: { id: { in: locationIds } } });
    const locationMap = Object.fromEntries(locations.map((l) => [l.id, l]));

    const byLocationEnriched = byLocation.map((b) => ({
      locationId:     b.locationId,
      locationName:   locationMap[b.locationId]?.name || b.locationId,
      locationCode:   locationMap[b.locationId]?.code || '',
      ticketCount:    b._count.id,
      totalDowntime:  b._sum.downtimeMinutes || 0,
    }));

    // MTTR (mean time to resolve)
    const resolved = allTickets30d.filter((t) => t.resolvedAt && t.downtimeMinutes != null);
    const mttr = resolved.length
      ? Math.round(resolved.reduce((sum, t) => sum + t.downtimeMinutes, 0) / resolved.length)
      : 0;

    // SLA compliance rate
    const slaBreached = allTickets30d.filter((t) => t.slaBreached).length;
    const slaCompliance = allTickets30d.length
      ? Math.round(((allTickets30d.length - slaBreached) / allTickets30d.length) * 100)
      : 100;

    // Total downtime today
    const todayTickets = await prisma.ticket.findMany({
      where:  { createdAt: { gte: today, lte: todayEnd } },
      select: { downtimeMinutes: true },
    });
    const totalDowntimeToday = todayTickets.reduce((s, t) => s + (t.downtimeMinutes || 0), 0);

    res.json({
      totalToday,
      openTickets,
      inProgressTickets,
      escalatedTickets,
      criticalOpen,
      resolvedToday,
      mttrMinutes: mttr,
      slaCompliance,
      totalDowntimeToday,
      byLocation: byLocationEnriched,
      byIssueType,
      bySeverity,
      recentTickets: recentTickets.map((t) => ({ ...t, sla: slaStatus(t) })),
    });
  } catch (err) { next(err); }
}

// ─── PDF Report ───────────────────────────────────────────────────────────────

async function incidentReportPdf(req, res, next) {
  try {
    const { dateFrom, dateTo, locationId, severity, status, issueType } = req.query;

    const where = {};
    if (locationId) where.locationId = locationId;
    if (severity)   where.severity   = severity;
    if (status)     where.status     = status;
    if (issueType)  where.issueType  = issueType;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo)   where.createdAt.lte = endOfDay(new Date(dateTo));
    }

    const tickets = await prisma.ticket.findMany({
      where,
      include: { location: true, reportedBy: { select: { name: true } } },
      orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
    });

    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="incident-report-${format(new Date(), 'yyyy-MM-dd')}.pdf"`);
    doc.pipe(res);

    // Header
    doc.fontSize(16).font('Helvetica-Bold').text('ScanPort – Port Operations', 40, 40);
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#1e3a5f').text('Incident & Downtime Report', 40, 62);
    doc.fontSize(9).font('Helvetica').fillColor('black')
       .text(`Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}  |  Period: ${dateFrom || 'All time'} → ${dateTo || 'Now'}  |  Records: ${tickets.length}`, 40, 80);

    doc.moveDown(2);

    const SEV_COLORS = { CRITICAL: '#fee2e2', MAJOR: '#fef9c3', MINOR: '#f0fdf4' };
    const cols = [
      { header: 'Ticket #',     width: 100 },
      { header: 'Location',     width: 100 },
      { header: 'Equipment',    width: 80  },
      { header: 'Issue Type',   width: 90  },
      { header: 'Severity',     width: 60  },
      { header: 'Status',       width: 70  },
      { header: 'Reported',     width: 90  },
      { header: 'Downtime',     width: 60  },
      { header: 'Reported By',  width: 100 },
    ];

    const totalWidth = cols.reduce((s, c) => s + c.width, 0);
    let y = doc.y;

    // Table header
    doc.rect(40, y, totalWidth, 22).fill('#1e3a5f');
    let x = 40;
    cols.forEach((col) => {
      doc.fontSize(8).font('Helvetica-Bold').fillColor('white')
         .text(col.header, x + 3, y + 7, { width: col.width - 6, lineBreak: false });
      x += col.width;
    });
    y += 22;

    // Rows
    tickets.forEach((t, i) => {
      if (y > 500) {
        doc.addPage({ layout: 'landscape', margin: 40 });
        y = 40;
      }
      const bg = SEV_COLORS[t.severity] || '#ffffff';
      doc.rect(40, y, totalWidth, 20).fill(bg);
      doc.fillColor('black');
      const row = [
        t.ticketNumber,
        t.location?.name || '',
        t.equipmentType,
        t.issueType,
        t.severity,
        t.status,
        format(new Date(t.createdAt), 'dd/MM/yy HH:mm'),
        t.downtimeMinutes != null ? `${t.downtimeMinutes}m` : '—',
        t.reportedBy?.name || '',
      ];
      x = 40;
      row.forEach((val, ci) => {
        doc.fontSize(7.5).font('Helvetica')
           .text(String(val ?? '—'), x + 3, y + 6, { width: cols[ci].width - 6, lineBreak: false });
        x += cols[ci].width;
      });
      y += 20;
    });

    // Summary
    doc.moveDown(2);
    const resolved = tickets.filter((t) => t.downtimeMinutes != null);
    const totalDown = resolved.reduce((s, t) => s + t.downtimeMinutes, 0);
    const mttr = resolved.length ? Math.round(totalDown / resolved.length) : 0;
    const critical = tickets.filter((t) => t.severity === 'CRITICAL').length;

    doc.fontSize(10).font('Helvetica-Bold').text('Summary', 40);
    doc.fontSize(9).font('Helvetica')
       .text(`Total Incidents: ${tickets.length}  |  Critical: ${critical}  |  Total Downtime: ${totalDown} min  |  MTTR: ${mttr} min`);

    doc.end();
  } catch (err) { next(err); }
}

// ─── Excel Report ─────────────────────────────────────────────────────────────

async function incidentReportExcel(req, res, next) {
  try {
    const { dateFrom, dateTo, locationId, severity, status, issueType } = req.query;

    const where = {};
    if (locationId) where.locationId = locationId;
    if (severity)   where.severity   = severity;
    if (status)     where.status     = status;
    if (issueType)  where.issueType  = issueType;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo)   where.createdAt.lte = endOfDay(new Date(dateTo));
    }

    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        location:      true,
        reportedBy:    { select: { name: true } },
        assignedToUser: { select: { name: true } },
      },
      orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
    });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'ScanPort';
    wb.created = new Date();

    const ws = wb.addWorksheet('Incidents', {
      pageSetup: { orientation: 'landscape', fitToPage: true },
    });

    // Header row style
    const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1e3a5f' } };
    const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };

    ws.columns = [
      { header: 'Ticket #',        key: 'ticketNumber',    width: 18 },
      { header: 'Location',        key: 'location',        width: 22 },
      { header: 'Equipment Type',  key: 'equipmentType',   width: 18 },
      { header: 'Issue Type',      key: 'issueType',       width: 22 },
      { header: 'Severity',        key: 'severity',        width: 12 },
      { header: 'Status',          key: 'status',          width: 14 },
      { header: 'Reported At',     key: 'startTime',       width: 20 },
      { header: 'First Response',  key: 'firstResponseAt', width: 20 },
      { header: 'Resolved At',     key: 'resolvedAt',      width: 20 },
      { header: 'Downtime (min)',   key: 'downtimeMinutes', width: 16 },
      { header: 'SLA Breached',    key: 'slaBreached',     width: 14 },
      { header: 'Reported By',     key: 'reportedBy',      width: 20 },
      { header: 'Assigned To',     key: 'assignedTo',      width: 20 },
      { header: 'Description',     key: 'description',     width: 40 },
      { header: 'Resolution Notes', key: 'resolutionNotes', width: 40 },
    ];

    ws.getRow(1).eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    ws.getRow(1).height = 24;

    const SEV_COLORS = { CRITICAL: 'FFFEE2E2', MAJOR: 'FFFEF9C3', MINOR: 'FFF0FDF4' };

    tickets.forEach((t) => {
      const row = ws.addRow({
        ticketNumber:    t.ticketNumber,
        location:        t.location?.name || '',
        equipmentType:   t.equipmentType,
        issueType:       t.issueType,
        severity:        t.severity,
        status:          t.status,
        startTime:       t.startTime ? format(new Date(t.startTime), 'dd/MM/yyyy HH:mm') : '',
        firstResponseAt: t.firstResponseAt ? format(new Date(t.firstResponseAt), 'dd/MM/yyyy HH:mm') : '',
        resolvedAt:      t.resolvedAt ? format(new Date(t.resolvedAt), 'dd/MM/yyyy HH:mm') : '',
        downtimeMinutes: t.downtimeMinutes ?? '',
        slaBreached:     t.slaBreached ? 'YES' : 'No',
        reportedBy:      t.reportedBy?.name || '',
        assignedTo:      t.assignedToUser?.name || t.assignedTo || '',
        description:     t.description,
        resolutionNotes: t.resolutionNotes || '',
      });

      const bg = SEV_COLORS[t.severity] || 'FFFFFFFF';
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.alignment = { vertical: 'top', wrapText: true };
      });
      if (t.slaBreached) {
        row.getCell('slaBreached').font = { bold: true, color: { argb: 'FFDC2626' } };
      }
    });

    // Summary sheet
    const summary = wb.addWorksheet('Summary');
    const resolved = tickets.filter((t) => t.downtimeMinutes != null);
    const totalDown = resolved.reduce((s, t) => s + t.downtimeMinutes, 0);
    const mttr = resolved.length ? Math.round(totalDown / resolved.length) : 0;

    summary.addRow(['Metric', 'Value']);
    summary.addRow(['Total Incidents', tickets.length]);
    summary.addRow(['Critical', tickets.filter((t) => t.severity === 'CRITICAL').length]);
    summary.addRow(['Major', tickets.filter((t) => t.severity === 'MAJOR').length]);
    summary.addRow(['Minor', tickets.filter((t) => t.severity === 'MINOR').length]);
    summary.addRow(['Open', tickets.filter((t) => t.status === 'OPEN').length]);
    summary.addRow(['Resolved/Closed', tickets.filter((t) => ['RESOLVED', 'CLOSED'].includes(t.status)).length]);
    summary.addRow(['SLA Breached', tickets.filter((t) => t.slaBreached).length]);
    summary.addRow(['Total Downtime (min)', totalDown]);
    summary.addRow(['MTTR (min)', mttr]);
    summary.addRow(['Report Generated', format(new Date(), 'dd/MM/yyyy HH:mm')]);
    summary.getColumn(1).width = 25;
    summary.getColumn(2).width = 20;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="incident-report-${format(new Date(), 'yyyy-MM-dd')}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) { next(err); }
}

// ─── Upload Attachment ────────────────────────────────────────────────────────

async function uploadAttachment(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

    const attachment = await prisma.attachment.create({
      data: {
        ticketId: req.params.id,
        fileName: req.file.originalname,
        fileUrl:  `/uploads/${req.file.filename}`,
        fileType: req.file.mimetype,
      },
    });

    await prisma.ticketActivity.create({
      data: {
        ticketId:  req.params.id,
        userId:    req.user.id,
        userEmail: req.user.email,
        userName:  req.user.name,
        action:    `Attachment added: ${req.file.originalname}`,
      },
    });

    res.status(201).json(attachment);
  } catch (err) { next(err); }
}

// ─── Get issue types / equipment types list ───────────────────────────────────

async function getMeta(req, res) {
  res.json({
    issueTypes: [
      'OCR Failure',
      'IPS Fault',
      'Accelerator Major Fault',
      'CCTV Fault',
      'No Image After Scan',
      'Daisy Fault',
      'Boom Barrier Fault',
      'Power Outage',
      'Vehicle Stuck / Breakdown',
      'System Down',
      'Mechanical Fault',
      'Network Issue',
      'Power Failure',
      'Conveyor Jam',
      'Accelerator Fault',
      'Software Error',
      'Calibration Required',
      'Truck Breakdown – Towing Required',
      'Traffic Congestion',
      'Shortage of Gangs',
      'Other',
    ],
    equipmentTypes: [
      'OCR System',
      'Conveyor',
      'Accelerator',
      'Control System',
      'Network Infrastructure',
      'Power Supply',
      'Detector Array',
      'Image Processing',
      'Boom Barrier',
      'CCTV System',
      'Intrusive Platform',
    ],
    severities: ['CRITICAL', 'MAJOR', 'MINOR'],
    statuses:   ['OPEN', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED', 'CLOSED'],
    assignableTeams: ['MDE', 'IT', 'Vendor – Siemens', 'Maintenance', 'Operations', 'Security'],
  });
}

module.exports = {
  listTickets,
  getTicket,
  createTicket,
  updateTicket,
  addComment,
  listLocations,
  getIncidentStats,
  incidentReportPdf,
  incidentReportExcel,
  uploadAttachment,
  getMeta,
};
