const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { differenceInHours } = require('date-fns');

const prisma = new PrismaClient();

const SLA = {
  CRITICAL: { firstResponse: 1,  resolution: 4  },
  MAJOR:    { firstResponse: 2,  resolution: 8  },
  MINOR:    { firstResponse: 4,  resolution: 24 },
};

async function runSlaCheck() {
  try {
    const active = await prisma.ticket.findMany({
      where: { status: { in: ['OPEN', 'IN_PROGRESS', 'ESCALATED'] } },
    });

    const now = new Date();
    const updates = [];
    const escalations = [];

    for (const ticket of active) {
      const sla = SLA[ticket.severity] || SLA.MINOR;
      const start = new Date(ticket.startTime);
      const hoursElapsed = differenceInHours(now, start);

      // Mark SLA breached
      if (!ticket.slaBreached && hoursElapsed >= sla.resolution) {
        updates.push(ticket.id);
      }

      // Auto-escalate at 150% of SLA if still open/in-progress
      if (
        ticket.status === 'OPEN' &&
        hoursElapsed >= Math.ceil(sla.resolution * 1.5) &&
        ticket.escalationLevel < 3
      ) {
        escalations.push({
          id: ticket.id,
          level: Math.min(ticket.escalationLevel + 1, 3),
        });
      }
    }

    if (updates.length) {
      await prisma.ticket.updateMany({
        where: { id: { in: updates } },
        data:  { slaBreached: true },
      });
      console.log(`[SLA] Marked ${updates.length} ticket(s) as SLA breached.`);
    }

    for (const esc of escalations) {
      await prisma.ticket.update({
        where: { id: esc.id },
        data:  { status: 'ESCALATED', escalationLevel: esc.level },
      });
      await prisma.ticketActivity.create({
        data: {
          ticketId:  esc.id,
          userId:    'system',
          userEmail: 'system@scanport.local',
          userName:  'ScanPort System',
          action:    `Auto-escalated to Level ${esc.level} (SLA exceeded)`,
          toStatus:  'ESCALATED',
        },
      });
    }

    if (escalations.length) {
      console.log(`[SLA] Auto-escalated ${escalations.length} ticket(s).`);
    }
  } catch (err) {
    console.error('[SLA] Check failed:', err.message);
  }
}

function startSlaCheck() {
  // Run every 15 minutes
  cron.schedule('*/15 * * * *', runSlaCheck);
  console.log('[SLA] SLA check job started (every 15 minutes).');
}

module.exports = { startSlaCheck, runSlaCheck };
