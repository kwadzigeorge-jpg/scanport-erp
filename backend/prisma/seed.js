require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { subMonths, subHours, subDays, subMinutes } = require('date-fns');

const prisma = new PrismaClient();

function nd(expiry) {
  return subMonths(new Date(expiry), 4);
}

function computeStatus(expiryDate, noticeDate, noticeSent) {
  const today = new Date();
  const expiry = new Date(expiryDate);
  const notice = new Date(noticeDate);
  if (today > expiry) return 'EXPIRED';
  if (noticeSent) return 'NOTICE_SENT';
  if (today >= notice) return 'NOTICE_DUE';
  return 'ACTIVE';
}

async function main() {
  // ── Wipe existing data ──────────────────────────────────────────
  await prisma.ticketActivity.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.location.deleteMany();
  await prisma.alertLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.certification.deleteMany();
  await prisma.scanner.deleteMany();
  await prisma.user.deleteMany();

  console.log('Cleared existing data.');

  // ── Users ───────────────────────────────────────────────────────
  const adminPass    = await bcrypt.hash('Admin@1234',    10);
  const viewerPass   = await bcrypt.hash('Viewer@1234',   10);
  const supervisorPw = await bcrypt.hash('Super@1234',    10);
  const maintPw      = await bcrypt.hash('Maint@1234',    10);

  const [adminUser, opsUser, supervisor, maintenance, operator] = await Promise.all([
    prisma.user.create({ data: { email: 'admin@scanport.com',      password: adminPass,    name: 'System Admin',        role: 'ADMIN'       } }),
    prisma.user.create({ data: { email: 'ops@scanport.com',        password: adminPass,    name: 'Operations Manager',  role: 'ADMIN'       } }),
    prisma.user.create({ data: { email: 'supervisor@scanport.com', password: supervisorPw, name: 'Jane Supervisor',     role: 'SUPERVISOR'  } }),
    prisma.user.create({ data: { email: 'maint@scanport.com',      password: maintPw,      name: 'Bob Maintenance',     role: 'MAINTENANCE' } }),
    prisma.user.create({ data: { email: 'operator@scanport.com',   password: viewerPass,   name: 'Port Operator',       role: 'OPERATOR'    } }),
  ]);

  // ── Real scanner fleet ──────────────────────────────────────────
  const fleet = [
    {
      serialNumber:      '2660',
      acceleratorSerial: '10025',
      certifications: [
        {
          inspectionDate:    new Date('2025-03-05'),
          expiryDate:        new Date('2026-03-21'),
          certificateStatus: 'EXPIRED',
          noticeSent:        false,
        },
        {
          inspectionDate:    new Date('2026-03-26'),
          expiryDate:        new Date('2027-03-26'),
          certificateStatus: 'PENDING',
          noticeSent:        false,
        },
      ],
    },
    { serialNumber: '2661', acceleratorSerial: '10030', location: 'Gate 3 – Vehicles Terminal',      certifications: [{ inspectionDate: new Date('2025-01-17'), expiryDate: new Date('2027-03-10'), certificateStatus: 'ISSUED', noticeSent: false }] },
    { serialNumber: '2662', acceleratorSerial: '10029', location: 'Gate 4 – Bulk Cargo Terminal',    certifications: [{ inspectionDate: new Date('2025-01-17'), expiryDate: new Date('2027-03-10'), certificateStatus: 'ISSUED', noticeSent: false }] },
    { serialNumber: '2663', acceleratorSerial: '10022', location: 'Gate 5 – Conventional Terminal',  certifications: [{ inspectionDate: new Date('2025-03-05'), expiryDate: new Date('2027-03-10'), certificateStatus: 'ISSUED', noticeSent: false }] },
    { serialNumber: '2664', acceleratorSerial: '10035', certifications: [{ inspectionDate: new Date('2025-01-17'), expiryDate: new Date('2027-03-10'), certificateStatus: 'ISSUED', noticeSent: false }] },
    { serialNumber: '2669', acceleratorSerial: '10031', certifications: [{ inspectionDate: new Date('2025-09-03'), expiryDate: new Date('2026-10-20'), certificateStatus: 'ISSUED', noticeSent: false }] },
  ];

  for (const s of fleet) {
    const scanner = await prisma.scanner.create({
      data: { serialNumber: s.serialNumber, acceleratorSerial: s.acceleratorSerial, manufacturer: 'Siemens', type: 'Fixed Scanner', location: s.location },
    });
    for (const c of s.certifications) {
      const noticeDate = nd(c.expiryDate);
      const status = computeStatus(c.expiryDate, noticeDate, c.noticeSent);
      const cert = await prisma.certification.create({
        data: { scannerId: scanner.id, inspectionDate: c.inspectionDate, expiryDate: c.expiryDate, noticeDate, certificateStatus: c.certificateStatus, status },
      });
      await prisma.notification.create({ data: { certificationId: cert.id, noticeStatus: 'NOT_SENT' } });
      if (status === 'EXPIRED') {
        await prisma.alertLog.create({ data: { certificationId: cert.id, type: 'EXPIRED', message: `Scanner ${s.serialNumber} – certificate expired on ${c.expiryDate.toDateString()}.` } });
      }
    }
  }

  // ── Locations ───────────────────────────────────────────────────
  const locations = await prisma.location.createManyAndReturn({
    data: [
      { name: 'Import Scanner 1',          code: 'IS1',  type: 'Import Scanner'      },
      { name: 'Import Scanner 2',          code: 'IS2',  type: 'Import Scanner'      },
      { name: 'Export Scanner 1',          code: 'ES1',  type: 'Export Scanner'      },
      { name: 'Export Scanner 2',          code: 'ES2',  type: 'Export Scanner'      },
      { name: 'IE Bay 1',                  code: 'IEB1', type: 'Intrusive Exam Bay'  },
      { name: 'IE Bay 2',                  code: 'IEB2', type: 'Intrusive Exam Bay'  },
      { name: 'IE Bay 3',                  code: 'IEB3', type: 'Intrusive Exam Bay'  },
      { name: 'Holding Area North',        code: 'HAN',  type: 'Holding Area'        },
      { name: 'Holding Area South',        code: 'HAS',  type: 'Holding Area'        },
    ],
  });

  const locMap = Object.fromEntries(locations.map((l) => [l.code, l]));

  // ── Sample Incidents ────────────────────────────────────────────
  const sampleTickets = [
    {
      locationCode: 'IS1', equipmentType: 'OCR System', issueType: 'OCR Failure',
      severity: 'CRITICAL', title: 'OCR system unable to read container numbers',
      description: 'OCR camera on IS1 is producing blank reads for all containers passing through. Affecting all vehicle processing. System rebooted twice with no improvement.',
      status: 'OPEN', assignedTo: 'IT',
      startTime: subHours(new Date(), 2), slaBreached: false,
      reportedBy: operator.id,
    },
    {
      locationCode: 'ES2', equipmentType: 'Conveyor', issueType: 'Conveyor Jam',
      severity: 'CRITICAL', title: 'Conveyor belt stopped mid-scan – container stuck',
      description: 'Belt stopped at approximately 60% scan completion. Emergency stop triggered. Maintenance called. Container blocking secondary conveyor.',
      status: 'IN_PROGRESS', assignedTo: 'MDE',
      startTime: subHours(new Date(), 5), firstResponseAt: subHours(new Date(), 4.5),
      slaBreached: true, reportedBy: operator.id, assignedToId: maintenance.id,
    },
    {
      locationCode: 'IEB1', equipmentType: 'Accelerator', issueType: 'Accelerator Fault',
      severity: 'CRITICAL', title: 'Accelerator beam loss – IE Bay 1 offline',
      description: 'Beam current dropped to zero at 08:14. Control system shows accelerator fault code A-077. Bay immediately evacuated per SOP. Vendor notified.',
      status: 'ESCALATED', assignedTo: 'Vendor – Siemens', escalationLevel: 2,
      startTime: subHours(new Date(), 8), firstResponseAt: subHours(new Date(), 7.5),
      slaBreached: true, downtimeMinutes: 480, reportedBy: supervisor.id,
    },
    {
      locationCode: 'IS2', equipmentType: 'Network Infrastructure', issueType: 'Network Issue',
      severity: 'MAJOR', title: 'Network connectivity loss – IS2 offline',
      description: 'Network switch failure causing complete connectivity loss to IS2 scanning workstation. Images cannot be transmitted to central server.',
      status: 'RESOLVED', assignedTo: 'IT',
      startTime: subHours(new Date(), 12), firstResponseAt: subHours(new Date(), 11.5),
      resolvedAt: subHours(new Date(), 9), downtimeMinutes: 180,
      resolutionNotes: 'Network switch replaced. Full connectivity restored. Root cause: failed PoE port.',
      slaBreached: false, reportedBy: operator.id,
    },
    {
      locationCode: 'ES1', equipmentType: 'Control System', issueType: 'System Down',
      severity: 'MAJOR', title: 'Scanning control system crashed – ES1',
      description: 'Control workstation BSOD. System unresponsive. Attempted local restart, system booting into recovery mode.',
      status: 'RESOLVED', assignedTo: 'IT',
      startTime: subDays(new Date(), 1), firstResponseAt: subDays(new Date(), 1),
      resolvedAt: subHours(new Date(), 20), downtimeMinutes: 240,
      resolutionNotes: 'Windows recovery used to restore last known good config. System stable for 4+ hours post-fix.',
      slaBreached: false, reportedBy: operator.id,
    },
    {
      locationCode: 'HAN', equipmentType: 'Power Supply', issueType: 'Power Failure',
      severity: 'MAJOR', title: 'UPS failure – Holding Area North',
      description: 'Uninterruptible power supply unit tripped at 14:32. Area running on mains only. Risk of data loss if mains interrupted.',
      status: 'IN_PROGRESS', assignedTo: 'MDE',
      startTime: subHours(new Date(), 3), firstResponseAt: subHours(new Date(), 2.5),
      slaBreached: false, reportedBy: operator.id, assignedToId: maintenance.id,
    },
    {
      locationCode: 'IEB2', equipmentType: 'Image Processing', issueType: 'Software Error',
      severity: 'MINOR', title: 'Image enhancement software throwing errors',
      description: 'Image analysis software showing rendering errors on approximately 1 in 10 scans. Scans usable but clarity affected. Logged under ticket for tracking.',
      status: 'OPEN', assignedTo: 'IT',
      startTime: subDays(new Date(), 2), slaBreached: false,
      reportedBy: operator.id,
    },
    {
      locationCode: 'IS1', equipmentType: 'Detector Array', issueType: 'Calibration Required',
      severity: 'MINOR', title: 'Detector calibration overdue – IS1',
      description: 'Routine calibration check flagged detector array requires recalibration. Last calibration 87 days ago (threshold 90 days). No current image quality impact.',
      status: 'CLOSED', assignedTo: 'MDE',
      startTime: subDays(new Date(), 5), firstResponseAt: subDays(new Date(), 5),
      resolvedAt: subDays(new Date(), 3), closedAt: subDays(new Date(), 2),
      downtimeMinutes: 45, resolutionNotes: 'Full detector calibration completed. All channels within spec.',
      slaBreached: false, reportedBy: operator.id,
    },
    {
      locationCode: 'ES2', equipmentType: 'OCR System', issueType: 'OCR Failure',
      severity: 'MAJOR', title: 'OCR misreading ISO codes on ES2',
      description: 'OCR intermittently misreading container ISO codes at rate of ~15%. Impacts manifest matching. Operators manually verifying all containers.',
      status: 'RESOLVED', assignedTo: 'Vendor – Siemens',
      startTime: subDays(new Date(), 3), firstResponseAt: subDays(new Date(), 3),
      resolvedAt: subDays(new Date(), 1), downtimeMinutes: 120,
      resolutionNotes: 'Vendor updated OCR firmware v2.4.1 → v2.5.0. Recognition accuracy restored to 99.7%.',
      slaBreached: false, reportedBy: supervisor.id,
    },
    {
      locationCode: 'IEB3', equipmentType: 'Conveyor', issueType: 'Mechanical Fault',
      severity: 'MINOR', title: 'Conveyor drive belt showing wear – IEB3',
      description: 'Maintenance inspection identified drive belt showing signs of fraying. Belt still functional. Replacement recommended within 2 weeks to prevent failure.',
      status: 'CLOSED', assignedTo: 'MDE',
      startTime: subDays(new Date(), 7), resolvedAt: subDays(new Date(), 6),
      closedAt: subDays(new Date(), 5), downtimeMinutes: 90,
      resolutionNotes: 'Drive belt replaced. Tension adjusted per manufacturer spec.',
      slaBreached: false, reportedBy: maintenance.id,
    },
  ];

  let seqCounters = {};
  for (const t of sampleTickets) {
    const loc = locMap[t.locationCode];
    if (!loc) continue;

    const year = (t.startTime || new Date()).getFullYear();
    const prefix = `${loc.code}-${year}`;
    seqCounters[prefix] = (seqCounters[prefix] || 0) + 1;
    const ticketNumber = `${prefix}-${String(seqCounters[prefix]).padStart(4, '0')}`;

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        title:           t.title,
        description:     t.description,
        locationId:      loc.id,
        equipmentType:   t.equipmentType,
        issueType:       t.issueType,
        severity:        t.severity,
        status:          t.status,
        escalationLevel: t.escalationLevel || 1,
        reportedById:    t.reportedBy,
        assignedTo:      t.assignedTo || null,
        assignedToId:    t.assignedToId || null,
        startTime:       t.startTime,
        firstResponseAt: t.firstResponseAt || null,
        resolvedAt:      t.resolvedAt || null,
        closedAt:        t.closedAt || null,
        downtimeMinutes: t.downtimeMinutes || null,
        resolutionNotes: t.resolutionNotes || null,
        slaBreached:     t.slaBreached || false,
      },
    });

    // Seed activity log
    await prisma.ticketActivity.create({
      data: {
        ticketId:  ticket.id,
        userId:    t.reportedBy,
        userEmail: 'system@scanport.local',
        userName:  'Seed Data',
        action:    'Ticket created',
        toStatus:  'OPEN',
        notes:     'Seeded from sample data.',
        createdAt: t.startTime,
      },
    });

    if (t.resolvedAt) {
      await prisma.ticketActivity.create({
        data: {
          ticketId:   ticket.id,
          userId:     maintenance.id,
          userEmail:  maintenance.email,
          userName:   maintenance.name,
          action:     'Status changed to RESOLVED',
          fromStatus: 'IN_PROGRESS',
          toStatus:   'RESOLVED',
          notes:      t.resolutionNotes || 'Issue resolved.',
          createdAt:  t.resolvedAt,
        },
      });
    }
  }

  console.log('');
  console.log('Fleet loaded:');
  console.log('  2660 → EXPIRED cert + PENDING re-inspection');
  console.log('  2661–2664, 2669 → ACTIVE');
  console.log('');
  console.log(`Locations: ${locations.length} created`);
  console.log(`Tickets:   ${sampleTickets.length} sample incidents seeded`);
  console.log('');
  console.log('Credentials:');
  console.log('  Admin      → admin@scanport.com      / Admin@1234');
  console.log('  Supervisor → supervisor@scanport.com / Super@1234');
  console.log('  Maintenance→ maint@scanport.com      / Maint@1234');
  console.log('  Operator   → operator@scanport.com   / Viewer@1234');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
