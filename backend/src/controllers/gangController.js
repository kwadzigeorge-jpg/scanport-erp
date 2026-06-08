const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ─── Helpers ──────────────────────────────────────────────────────────────────
function genRef() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `REQ-${ts}-${rand}`;
}

function round1(n) { return Math.round(n * 10) / 10; }
function round2(n) { return Math.round(n * 100) / 100; }

function computeAllocationScore(gang, jobsToday, hoursSinceLastJob) {
  const headmanAvail = gang.headman_available > 0;
  const dockersAvail = Math.min(gang.dockers_available || 0, 4);
  const availability = !headmanAvail ? 0 : Math.round(10 + dockersAvail * 7.5);
  const workload = Math.max(0, 25 - jobsToday * 5);
  const performance = (gang.performance_score / 100) * 25;
  const idle = Math.min((hoursSinceLastJob || 0) * 2.5, 10);
  return Math.round((availability + workload + performance + idle) * 10) / 10;
}

function computeJobScore({ actualMin, expectedMin, delayCount, agentRating, arrivedOnTime }) {
  const ratio = expectedMin > 0 ? actualMin / expectedMin : 1;
  const durationScore = ratio <= 1 ? 30 : Math.max(0, 30 - (ratio - 1) * 30);
  const delayScore = Math.max(0, 25 - delayCount * 5);
  const arrivalScore = arrivedOnTime ? 20 : 0;
  const ratingScore = agentRating ? (agentRating / 5) * 25 : 12.5;
  return {
    durationScore: round1(durationScore),
    delayScore:    round1(delayScore),
    arrivalScore,
    ratingScore:   round1(ratingScore),
    total:         round1(durationScore + delayScore + arrivalScore + ratingScore),
  };
}

async function logAudit(req, action, entity, entityId, details) {
  try {
    await prisma.auditLog.create({
      data: {
        userId:    req.user?.id    || 'system',
        userEmail: req.user?.email || 'system',
        action,
        entity,
        entityId: String(entityId),
        details: typeof details === 'string' ? details : JSON.stringify(details),
      },
    });
  } catch (_) { /* non-fatal */ }
}

// Build a plain gang object with derived member stats from an included members array
function withMemberStats(gang, jobsToday = 0, lastJobCompleted = null) {
  const members = gang.members || [];
  return {
    ...gang,
    headman_count:     members.filter(m => m.role === 'head_man').length,
    docker_count:      members.filter(m => m.role === 'docker').length,
    total_members:     members.length,
    headman_available: members.filter(m => m.role === 'head_man' && m.status === 'available').length,
    dockers_available: members.filter(m => m.role === 'docker'   && m.status === 'available').length,
    available_count:   members.filter(m => m.status === 'available').length,
    jobs_today:        jobsToday,
    last_job_completed: lastJobCompleted,
  };
}

// ─── Shift Helpers ────────────────────────────────────────────────────────────
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function getShiftWindow(now = new Date()) {
  const h = now.getHours();
  const shift = (h >= 6 && h < 18) ? 'day' : 'night';
  const todayStr = now.toISOString().slice(0, 10);

  if (shift === 'day') {
    const start = new Date(`${todayStr}T06:00:00`);
    const end   = new Date(`${todayStr}T18:00:00`);
    return { shift, start, end, dow: start.getDay() };
  } else {
    let shiftStart;
    if (h < 6) {
      const prev = new Date(now);
      prev.setDate(prev.getDate() - 1);
      shiftStart = new Date(prev.toISOString().slice(0, 10) + 'T18:00:00');
    } else {
      shiftStart = new Date(`${todayStr}T18:00:00`);
    }
    const end = new Date(shiftStart.getTime() + 12 * 3600000);
    return { shift, start: shiftStart, end, dow: shiftStart.getDay() };
  }
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
async function getDashboard(req, res, next) {
  try {
    const now = new Date();
    const todayStart = new Date(now.toISOString().slice(0, 10));

    const [allGangs, allRequests, activeAllocations, pendingQueue, notifications] = await Promise.all([
      prisma.gang.findMany({ select: { status: true } }),
      prisma.gangRequest.findMany({ select: { status: true, created_at: true } }),
      prisma.gangAllocation.findMany({
        where: { status: { in: ['allocated', 'gang_dispatched', 'in_progress'] } },
        include: { gang: true, request: true },
        orderBy: [{ request: { priority: 'desc' } }, { allocated_at: 'asc' }],
      }),
      prisma.gangRequest.findMany({
        where: { status: 'pending' },
        include: { receiver: { select: { name: true } } },
        orderBy: [{ priority: 'desc' }, { created_at: 'asc' }],
        take: 10,
      }),
      prisma.gangNotification.findMany({
        where: { is_read: false },
        include: { gang: { select: { gang_code: true } } },
        orderBy: { created_at: 'desc' },
        take: 20,
      }),
    ]);

    const topGangs = await prisma.gang.findMany({
      orderBy: { performance_score: 'desc' },
      take: 5,
      select: { gang_code: true, status: true, performance_score: true, total_jobs_completed: true },
    });

    const gangs = {
      available: allGangs.filter(g => g.status === 'available').length,
      busy:      allGangs.filter(g => g.status === 'busy').length,
      on_break:  allGangs.filter(g => g.status === 'on_break').length,
      off_duty:  allGangs.filter(g => g.status === 'off_duty').length,
      total:     allGangs.length,
    };

    const requests = {
      pending:     allRequests.filter(r => r.status === 'pending').length,
      allocated:   allRequests.filter(r => r.status === 'allocated').length,
      in_progress: allRequests.filter(r => r.status === 'in_progress').length,
      today:       allRequests.filter(r => r.created_at >= todayStart).length,
    };

    const active_jobs = activeAllocations.map(a => ({
      ...a,
      gang_code:        a.gang.gang_code,
      request_ref:      a.request.request_ref,
      bay_number:       a.request.bay_number,
      container_number: a.request.container_number,
      priority:         a.request.priority,
      agent_name:       a.request.agent_name,
      elapsed_minutes:  (now - a.allocated_at) / 60000,
      overdue_minutes:  a.expected_start
        ? (now - new Date(a.expected_start.getTime() + a.expected_duration_minutes * 60000)) / 60000
        : null,
    }));

    const pending_queue = pendingQueue.map(r => ({ ...r, received_by_name: r.receiver?.name ?? null }));

    return res.json({ gangs, requests, active_jobs, pending_queue, top_gangs: topGangs, notifications });
  } catch (err) { next(err); }
}

// ─── Gangs ────────────────────────────────────────────────────────────────────
async function listGangs(req, res, next) {
  try {
    const { status } = req.query;
    const [gangs, activeSubs] = await Promise.all([
      prisma.gang.findMany({
        where: status ? { status } : undefined,
        include: { members: { where: { is_active: true }, orderBy: [{ role: 'asc' }, { full_name: 'asc' }] } },
        orderBy: [{ performance_score: 'desc' }, { gang_code: 'asc' }],
      }),
      prisma.gangSubstitution.findMany({
        where: { ended_at: null },
        include: {
          absent_member: { select: { id: true, full_name: true, role: true, employee_id: true } },
          substitute:    { select: { id: true, full_name: true, role: true, employee_id: true, gang: { select: { gang_code: true } } } },
        },
      }),
    ]);

    const subsByGang = {};
    for (const s of activeSubs) {
      if (!subsByGang[s.gang_id]) subsByGang[s.gang_id] = [];
      subsByGang[s.gang_id].push({
        id:                s.id,
        absent_member_id:  s.absent_member_id,
        absent_member:     s.absent_member,
        substitute_id:     s.substitute_id,
        substitute:        { ...s.substitute, gang_code: s.substitute.gang?.gang_code },
        reason:            s.reason,
        notes:             s.notes,
        created_at:        s.created_at,
      });
    }

    const today = new Date(new Date().toISOString().slice(0, 10));
    const result = await Promise.all(gangs.map(async g => {
      const [jobsToday, lastJob] = await Promise.all([
        prisma.gangAllocation.count({
          where: { gang_id: g.id, allocated_at: { gte: today }, status: { not: 'cancelled' } },
        }),
        prisma.gangAllocation.findFirst({
          where: { gang_id: g.id, status: 'completed' },
          orderBy: { work_completed_at: 'desc' },
          select: { work_completed_at: true },
        }),
      ]);
      return { ...withMemberStats(g, jobsToday, lastJob?.work_completed_at ?? null), active_substitutions: subsByGang[g.id] || [] };
    }));

    return res.json(result);
  } catch (err) { next(err); }
}

async function getGang(req, res, next) {
  try {
    const gang = await prisma.gang.findUnique({
      where: { id: req.params.id },
      include: {
        creator: { select: { name: true } },
        members: { orderBy: [{ role: 'asc' }, { full_name: 'asc' }] },
      },
    });
    if (!gang) return res.status(404).json({ error: 'Gang not found.' });
    return res.json({ ...gang, created_by_name: gang.creator?.name ?? null });
  } catch (err) { next(err); }
}

async function createGang(req, res, next) {
  try {
    const { gang_code, specialization, notes } = req.body;
    if (!gang_code) return res.status(400).json({ error: 'gang_code is required.' });
    const gang = await prisma.gang.create({
      data: { gang_code: gang_code.toUpperCase(), specialization: specialization || null, notes: notes || null, created_by: req.user.id },
    });
    await logAudit(req, 'gang:created', 'Gang', gang.id, { gang_code });
    return res.status(201).json(gang);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Gang code already exists.' });
    next(err);
  }
}

async function updateGang(req, res, next) {
  try {
    const { gang_code, specialization, notes, status } = req.body;
    const gang = await prisma.gang.update({
      where: { id: req.params.id },
      data: { gang_code, specialization: specialization || null, notes: notes || null, status },
    });
    await logAudit(req, 'gang:updated', 'Gang', req.params.id, req.body);
    return res.json(gang);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Gang not found.' });
    next(err);
  }
}

async function deleteGang(req, res, next) {
  try {
    const { id } = req.params;
    const gang = await prisma.gang.findUnique({ where: { id }, select: { id: true, gang_code: true } });
    if (!gang) return res.status(404).json({ error: 'Gang not found.' });

    const activeAlloc = await prisma.gangAllocation.findFirst({
      where: { gang_id: id, status: { in: ['allocated', 'gang_dispatched', 'in_progress'] } },
      select: { id: true },
    });
    if (activeAlloc) {
      return res.status(409).json({ error: 'Cannot delete a gang with active allocations. Complete or cancel all jobs first.' });
    }

    // Delete in FK-safe order
    const memberIds = await prisma.gangMember.findMany({ where: { gang_id: id }, select: { id: true } }).then(r => r.map(m => m.id));
    const allocIds  = await prisma.gangAllocation.findMany({ where: { gang_id: id }, select: { id: true } }).then(r => r.map(a => a.id));

    await prisma.$transaction([
      // Nullify engine_recommended_gang references
      prisma.gangAllocation.updateMany({ where: { engine_recommended_gang: id }, data: { engine_recommended_gang: null } }),
      // End/remove substitutions involving this gang's members
      prisma.gangSubstitution.deleteMany({ where: { OR: [{ gang_id: id }, { absent_member_id: { in: memberIds } }, { substitute_id: { in: memberIds } }] } }),
      // Delete delay logs attached to this gang's allocations
      prisma.gangDelayLog.deleteMany({ where: { allocation_id: { in: allocIds } } }),
      // Delete allocations
      prisma.gangAllocation.deleteMany({ where: { gang_id: id } }),
      // Delete gang (cascades members, perf records, notifications)
      prisma.gang.delete({ where: { id } }),
    ]);

    await logAudit(req, 'gang:deleted', 'Gang', id, { gang_code: gang.gang_code });
    return res.json({ ok: true });
  } catch (err) { next(err); }
}

async function setGangStatus(req, res, next) {
  try {
    const { status } = req.body;
    const valid = ['available', 'busy', 'on_break', 'off_duty'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status.' });
    const gang = await prisma.gang.update({ where: { id: req.params.id }, data: { status } });
    await logAudit(req, 'gang:status_changed', 'Gang', req.params.id, { status });
    return res.json(gang);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Gang not found.' });
    next(err);
  }
}

// ─── Members ──────────────────────────────────────────────────────────────────
async function listMembers(req, res, next) {
  try {
    const members = await prisma.gangMember.findMany({
      where: { gang_id: req.params.id },
      orderBy: [{ role: 'asc' }, { full_name: 'asc' }],
    });
    return res.json(members);
  } catch (err) { next(err); }
}

async function addMember(req, res, next) {
  try {
    const gang_id = req.params.id;
    const { role, full_name, employee_id, phone, joined_date } = req.body;
    if (!role || !full_name || !employee_id) {
      return res.status(400).json({ error: 'role, full_name, employee_id required.' });
    }
    if (!['head_man', 'docker'].includes(role)) {
      return res.status(400).json({ error: 'role must be head_man or docker.' });
    }

    const [dockerCount, headmanCount] = await Promise.all([
      prisma.gangMember.count({ where: { gang_id, role: 'docker', is_active: true } }),
      prisma.gangMember.count({ where: { gang_id, role: 'head_man', is_active: true } }),
    ]);
    if (role === 'docker'   && dockerCount  >= 4) return res.status(400).json({ error: 'A gang can have at most 4 dockers.' });
    if (role === 'head_man' && headmanCount >= 1) return res.status(400).json({ error: 'A gang can have only 1 head man.' });

    const member = await prisma.gangMember.create({
      data: { gang_id, role, full_name, employee_id, phone: phone || null, joined_date: joined_date ? new Date(joined_date) : null },
    });
    return res.status(201).json(member);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Employee ID already exists.' });
    next(err);
  }
}

async function updateMember(req, res, next) {
  try {
    const { full_name, phone, is_active } = req.body;
    const member = await prisma.gangMember.update({
      where: { id: req.params.memberId },
      data: { full_name, phone: phone || null, is_active: is_active !== false },
    });
    return res.json(member);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Member not found.' });
    next(err);
  }
}

async function removeMember(req, res, next) {
  try {
    const member = await prisma.gangMember.updateMany({
      where: { id: req.params.memberId, gang_id: req.params.id },
      data: { is_active: false },
    });
    if (member.count === 0) return res.status(404).json({ error: 'Member not found.' });
    return res.json({ ok: true });
  } catch (err) { next(err); }
}

async function setMemberStatus(req, res, next) {
  try {
    const { status } = req.body;
    const valid = ['available', 'on_break', 'off_duty', 'sick', 'on_leave'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status.' });
    const updated = await prisma.gangMember.updateMany({
      where: { id: req.params.memberId, gang_id: req.params.id, is_active: true },
      data: { status },
    });
    if (updated.count === 0) return res.status(404).json({ error: 'Member not found.' });
    const member = await prisma.gangMember.findUnique({ where: { id: req.params.memberId } });
    await logAudit(req, 'gang:member_status_changed', 'GangMember', req.params.memberId, { status, gang_id: req.params.id });
    return res.json(member);
  } catch (err) { next(err); }
}

// ─── Agent Requests ───────────────────────────────────────────────────────────
async function listRequests(req, res, next) {
  try {
    const { status, priority, from, to, search } = req.query;
    const where = {};
    if (status)   where.status   = status;
    if (priority) where.priority = priority;
    if (from || to) where.created_at = {};
    if (from) where.created_at.gte = new Date(from);
    if (to)   where.created_at.lte = new Date(to + 'T23:59:59');
    if (search) {
      where.OR = [
        { container_number: { contains: search } },
        { agent_name:       { contains: search } },
        { bay_number:       { contains: search } },
      ];
    }

    const rows = await prisma.gangRequest.findMany({
      where,
      include: {
        receiver: { select: { name: true } },
        allocations: {
          where: { status: { not: 'cancelled' } },
          include: { gang: { select: { gang_code: true } } },
          orderBy: { created_at: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ priority: 'desc' }, { created_at: 'desc' }],
      take: 200,
    });

    const result = rows.map(r => {
      const alloc = r.allocations[0] ?? null;
      return {
        ...r,
        received_by_name: r.receiver?.name ?? null,
        allocation_id:    alloc?.id ?? null,
        gang_id:          alloc?.gang_id ?? null,
        gang_code:        alloc?.gang?.gang_code ?? null,
        allocation_status: alloc?.status ?? null,
        allocated_at:     alloc?.allocated_at ?? null,
      };
    });

    return res.json(result);
  } catch (err) { next(err); }
}

async function createRequest(req, res, next) {
  try {
    const { agent_name, agent_phone, agency, bay_number, container_number, container_number_2, cargo_type, priority, notes } = req.body;
    if (!agent_name || !bay_number || !container_number) {
      return res.status(400).json({ error: 'agent_name, bay_number, container_number are required.' });
    }
    const cnumRegex = /^[A-Z]{4}\d{7}$/;
    const cnum = container_number.toUpperCase().replace(/\s/g, '');
    if (!cnumRegex.test(cnum)) {
      return res.status(400).json({ error: 'Invalid container number format. Expected: 4 letters + 7 digits (e.g. MSCU1234567).' });
    }

    let cnum2 = null;
    if (container_number_2?.trim()) {
      cnum2 = container_number_2.toUpperCase().replace(/\s/g, '');
      if (!cnumRegex.test(cnum2)) return res.status(400).json({ error: 'Invalid second container number format.' });
      if (cnum2 === cnum) return res.status(400).json({ error: 'Second container number must differ from the first.' });
      const dup2 = await prisma.gangRequest.findFirst({
        where: { status: { in: ['pending', 'allocated', 'in_progress'] }, OR: [{ container_number: cnum2 }, { container_number_2: cnum2 }] },
      });
      if (dup2) return res.status(409).json({ error: 'An active request for the second container already exists.' });
    }

    const dup = await prisma.gangRequest.findFirst({
      where: { status: { in: ['pending', 'allocated', 'in_progress'] }, OR: [{ container_number: cnum }, { container_number_2: cnum }] },
    });
    if (dup) return res.status(409).json({ error: 'An active request for this container already exists.' });

    const request = await prisma.gangRequest.create({
      data: {
        request_ref: genRef(),
        agent_name, agent_phone: agent_phone || null, agency: agency || null,
        bay_number, container_number: cnum, container_number_2: cnum2,
        is_dual_container: !!cnum2, cargo_type: cargo_type || null,
        priority: priority || 'normal', notes: notes || null,
        received_by: req.user.id,
      },
    });

    await logAudit(req, 'gang:request_created', 'GangRequest', request.id, { ref: request.request_ref, container_number: cnum });
    return res.status(201).json(request);
  } catch (err) { next(err); }
}

async function cancelRequest(req, res, next) {
  try {
    const updated = await prisma.gangRequest.updateMany({
      where: { id: req.params.id, status: 'pending' },
      data: { status: 'cancelled' },
    });
    if (updated.count === 0) return res.status(400).json({ error: 'Request not found or not in pending status.' });
    const request = await prisma.gangRequest.findUnique({ where: { id: req.params.id } });
    await logAudit(req, 'gang:request_cancelled', 'GangRequest', req.params.id, {});
    return res.json(request);
  } catch (err) { next(err); }
}

// ─── Allocation Engine ────────────────────────────────────────────────────────
async function recommendGangs(req, res, next) {
  try {
    const today = new Date(new Date().toISOString().slice(0, 10));
    const gangs = await prisma.gang.findMany({
      where: { status: { not: 'busy' }, specialization: { not: 'Reserve Pool' } },
      include: { members: { where: { is_active: true } } },
    });

    const scored = await Promise.all(gangs.map(async g => {
      const headmanAvailable = g.members.filter(m => m.role === 'head_man' && m.status === 'available').length;
      const dockersAvailable = g.members.filter(m => m.role === 'docker'   && m.status === 'available').length;
      const totalMembers     = g.members.length;

      const [jobsToday, lastCompleted] = await Promise.all([
        prisma.gangAllocation.count({ where: { gang_id: g.id, allocated_at: { gte: today }, status: { not: 'cancelled' } } }),
        prisma.gangAllocation.findFirst({ where: { gang_id: g.id, status: 'completed' }, orderBy: { work_completed_at: 'desc' }, select: { work_completed_at: true } }),
      ]);

      const hoursSinceLastJob = lastCompleted?.work_completed_at
        ? (Date.now() - lastCompleted.work_completed_at.getTime()) / 3600000
        : 0;

      const gangData = { ...g, headman_available: headmanAvailable, dockers_available: dockersAvailable, performance_score: g.performance_score };
      const score = computeAllocationScore(gangData, jobsToday, hoursSinceLastJob);

      const reasons = [];
      if (!headmanAvailable) reasons.push('Head man unavailable');
      else reasons.push('Head man available');
      reasons.push(`${dockersAvailable}/4 dockers available`);
      reasons.push(`${jobsToday} job(s) today`);
      reasons.push(`Perf: ${g.performance_score}`);

      return { ...withMemberStats(g, jobsToday, lastCompleted?.work_completed_at), allocation_score: score, score_reasons: reasons };
    }));

    scored.sort((a, b) => b.allocation_score - a.allocation_score);
    return res.json(scored);
  } catch (err) { next(err); }
}

// ─── Allocations ──────────────────────────────────────────────────────────────
async function createAllocation(req, res, next) {
  try {
    const { request_id, gang_id, is_override, override_reason, expected_start, expected_duration_minutes, engine_recommended_gang, engine_score } = req.body;
    if (!request_id || !gang_id) return res.status(400).json({ error: 'request_id and gang_id are required.' });

    const [gangRequest, gang] = await Promise.all([
      prisma.gangRequest.findUnique({ where: { id: request_id } }),
      prisma.gang.findUnique({ where: { id: gang_id } }),
    ]);
    if (!gangRequest) return res.status(404).json({ error: 'Request not found.' });
    if (gangRequest.status !== 'pending') return res.status(400).json({ error: `Request is already ${gangRequest.status}.` });
    if (!gang) return res.status(404).json({ error: 'Gang not found.' });

    // Shift capacity check
    const { shift, start: sStart, end: sEnd, dow } = getShiftWindow();
    const [shiftLimit, shiftUsed] = await Promise.all([
      prisma.shiftDeploymentLimit.findUnique({ where: { day_of_week_shift: { day_of_week: dow, shift } } }),
      prisma.gangAllocation.findMany({
        where: { allocated_at: { gte: sStart, lt: sEnd }, status: { not: 'cancelled' } },
        select: { gang_id: true },
        distinct: ['gang_id'],
      }),
    ]);
    if (shiftLimit && shiftUsed.length >= shiftLimit.max_gangs) {
      return res.status(429).json({
        error: `${DAY_NAMES[dow]} ${shift} shift is at capacity (${shiftLimit.max_gangs} gangs). No further allocations permitted.`,
        shift_limit: shiftLimit.max_gangs,
        shift_used:  shiftUsed.length,
      });
    }

    const [alloc] = await prisma.$transaction([
      prisma.gangAllocation.create({
        data: {
          request_id, gang_id, allocated_by: req.user.id,
          is_override: !!is_override, override_reason: override_reason || null,
          engine_recommended_gang: engine_recommended_gang || null,
          engine_score: engine_score || null,
          expected_start: expected_start ? new Date(expected_start) : null,
          expected_duration_minutes: expected_duration_minutes || 60,
          status: 'allocated',
        },
      }),
      prisma.gangRequest.update({ where: { id: request_id }, data: { status: 'allocated' } }),
      prisma.gang.update({ where: { id: gang_id }, data: { status: 'busy' } }),
    ]);

    await prisma.gangNotification.create({
      data: {
        type: 'job_assigned',
        message: `Gang ${gang.gang_code} assigned to Bay ${gangRequest.bay_number} — Container ${gangRequest.container_number}`,
        allocation_id: alloc.id,
        gang_id,
      },
    });

    await logAudit(req, 'gang:allocated', 'GangAllocation', alloc.id, { request_id, gang_id, gang_code: gang.gang_code, is_override });
    return res.status(201).json(alloc);
  } catch (err) { next(err); }
}

async function listAllocations(req, res, next) {
  try {
    const { status, gang_id, from, to } = req.query;
    const where = {};
    if (status)  where.status  = status;
    if (gang_id) where.gang_id = gang_id;
    if (from || to) where.allocated_at = {};
    if (from) where.allocated_at.gte = new Date(from);
    if (to)   where.allocated_at.lte = new Date(to + 'T23:59:59');

    const rows = await prisma.gangAllocation.findMany({
      where,
      include: {
        gang:      { select: { gang_code: true, performance_score: true } },
        request:   { select: { request_ref: true, bay_number: true, container_number: true, priority: true, agent_name: true, agent_phone: true, agency: true, cargo_type: true } },
        allocator: { select: { name: true } },
        delay_logs: { select: { id: true } },
      },
      orderBy: { allocated_at: 'desc' },
      take: 200,
    });

    const now = new Date();
    const result = rows.map(a => ({
      ...a,
      gang_code:         a.gang.gang_code,
      performance_score: a.gang.performance_score,
      request_ref:       a.request.request_ref,
      bay_number:        a.request.bay_number,
      container_number:  a.request.container_number,
      priority:          a.request.priority,
      agent_name:        a.request.agent_name,
      agent_phone:       a.request.agent_phone,
      agency:            a.request.agency,
      cargo_type:        a.request.cargo_type,
      allocated_by_name: a.allocator.name,
      elapsed_minutes:   (new Date(a.work_completed_at || now) - new Date(a.work_started_at || a.allocated_at)) / 60000,
      delay_count:       a.delay_logs.length,
    }));

    return res.json(result);
  } catch (err) { next(err); }
}

async function logTimestamp(req, res, next) {
  try {
    const { id } = req.params;
    const { event } = req.body;
    const colMap = {
      arrived: { data: { gang_arrived_at: new Date(), status: 'gang_dispatched' } },
      started: { data: { work_started_at: new Date(), status: 'in_progress' } },
    };
    if (!colMap[event]) return res.status(400).json({ error: 'event must be arrived or started.' });

    const alloc = await prisma.gangAllocation.update({ where: { id }, data: colMap[event].data });

    if (event === 'started') {
      await prisma.gangRequest.update({ where: { id: alloc.request_id }, data: { status: 'in_progress' } });
    }
    await logAudit(req, `gang:timestamp_${event}`, 'GangAllocation', id, { event });
    return res.json(alloc);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Allocation not found.' });
    next(err);
  }
}

async function completeJob(req, res, next) {
  try {
    const { id } = req.params;
    const { supervisor_comments } = req.body;

    const alloc = await prisma.gangAllocation.update({
      where: { id, status: 'in_progress' },
      data: { work_completed_at: new Date(), status: 'completed', supervisor_comments: supervisor_comments || null },
    }).catch(() => null);

    if (!alloc) return res.status(400).json({ error: 'Allocation not found or not in_progress.' });

    await Promise.all([
      prisma.gangRequest.update({ where: { id: alloc.request_id }, data: { status: 'completed' } }),
      prisma.gang.update({ where: { id: alloc.gang_id }, data: { status: 'available', total_jobs_completed: { increment: 1 } } }),
    ]);

    const delayCount = await prisma.gangDelayLog.count({ where: { allocation_id: id } });
    const actualMin = alloc.work_started_at
      ? Math.round((alloc.work_completed_at.getTime() - alloc.work_started_at.getTime()) / 60000)
      : null;
    const arrivedOnTime = alloc.gang_arrived_at && alloc.expected_start
      ? alloc.gang_arrived_at <= new Date(alloc.expected_start.getTime() + 10 * 60000)
      : null;

    if (actualMin !== null) {
      const scores = computeJobScore({ actualMin, expectedMin: alloc.expected_duration_minutes, delayCount, agentRating: alloc.agent_rating, arrivedOnTime });
      await prisma.gangPerformanceRecord.create({
        data: {
          gang_id: alloc.gang_id, allocation_id: id,
          period_date: new Date(new Date().toISOString().slice(0, 10)),
          actual_duration_minutes: actualMin, expected_duration_minutes: alloc.expected_duration_minutes,
          delay_count: delayCount, agent_rating: alloc.agent_rating, arrived_on_time: arrivedOnTime,
          duration_score: scores.durationScore, delay_score: scores.delayScore,
          arrival_score: scores.arrivalScore, rating_score: scores.ratingScore, total_score: scores.total,
        },
      });

      // Rolling average of last 10 jobs
      const last10 = await prisma.gangPerformanceRecord.findMany({
        where: { gang_id: alloc.gang_id },
        orderBy: { computed_at: 'desc' },
        take: 10,
        select: { total_score: true },
      });
      const validScores = last10.filter(r => r.total_score != null).map(r => r.total_score);
      const newScore = validScores.length
        ? round2(validScores.reduce((a, b) => a + b, 0) / validScores.length)
        : 100;
      await prisma.gang.update({ where: { id: alloc.gang_id }, data: { performance_score: newScore } });
    }

    await logAudit(req, 'gang:job_completed', 'GangAllocation', id, { gang_id: alloc.gang_id });
    return res.json(alloc);
  } catch (err) { next(err); }
}

async function logDelay(req, res, next) {
  try {
    const { delay_type, delay_minutes, description } = req.body;
    if (!delay_type || !description) return res.status(400).json({ error: 'delay_type and description required.' });
    const log = await prisma.gangDelayLog.create({
      data: { allocation_id: req.params.id, delay_type, delay_minutes: delay_minutes || null, description, reported_by: req.user.id },
    });
    await logAudit(req, 'gang:delay_logged', 'GangDelayLog', log.id, { allocation_id: req.params.id, delay_type });
    return res.status(201).json(log);
  } catch (err) { next(err); }
}

async function getDelays(req, res, next) {
  try {
    const delays = await prisma.gangDelayLog.findMany({
      where: { allocation_id: req.params.id },
      include: { reporter: { select: { name: true } } },
      orderBy: { reported_at: 'asc' },
    });
    const result = delays.map(d => ({ ...d, reported_by_name: d.reporter?.name ?? null }));
    return res.json(result);
  } catch (err) { next(err); }
}

async function submitFeedback(req, res, next) {
  try {
    const { agent_rating, agent_feedback } = req.body;
    if (!agent_rating) return res.status(400).json({ error: 'agent_rating required.' });
    const alloc = await prisma.gangAllocation.update({
      where: { id: req.params.id },
      data: { agent_rating, agent_feedback: agent_feedback || null },
    });
    return res.json(alloc);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Allocation not found.' });
    next(err);
  }
}

// ─── Performance ──────────────────────────────────────────────────────────────
async function getPerformance(req, res, next) {
  try {
    const { from, to, gang_id } = req.query;
    const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const toDate   = to   || new Date().toISOString().slice(0, 10);
    const rangeWhere = { gte: new Date(fromDate), lte: new Date(toDate + 'T23:59:59') };

    // Per-gang stats
    const gangsWithPerf = await prisma.gang.findMany({
      where: gang_id ? { id: gang_id } : undefined,
      include: { performance_records: { where: { period_date: rangeWhere } } },
    });

    const gang_stats = gangsWithPerf.map(g => {
      const recs = g.performance_records;
      const validDur  = recs.filter(r => r.actual_duration_minutes != null);
      const validScore = recs.filter(r => r.total_score != null);
      const validRating = recs.filter(r => r.agent_rating != null);
      return {
        gang_code:            g.gang_code,
        status:               g.status,
        performance_score:    g.performance_score,
        total_jobs_completed: g.total_jobs_completed,
        jobs_in_period:       recs.length,
        avg_duration_min:     validDur.length   ? round1(validDur.reduce((s, r) => s + r.actual_duration_minutes, 0) / validDur.length) : null,
        avg_score:            validScore.length  ? round2(validScore.reduce((s, r) => s + r.total_score, 0) / validScore.length) : null,
        total_delays:         recs.reduce((s, r) => s + r.delay_count, 0),
        avg_rating:           validRating.length ? round2(validRating.reduce((s, r) => s + r.agent_rating, 0) / validRating.length) : null,
        on_time_count:        recs.filter(r => r.arrived_on_time === true).length,
      };
    }).sort((a, b) => (b.avg_score ?? -1) - (a.avg_score ?? -1));

    // Daily trend — group in JS
    const allRecs = await prisma.gangPerformanceRecord.findMany({
      where: { period_date: rangeWhere, ...(gang_id ? { gang_id } : {}) },
      orderBy: { period_date: 'asc' },
    });
    const byDate = {};
    for (const r of allRecs) {
      const d = r.period_date.toISOString().slice(0, 10);
      if (!byDate[d]) byDate[d] = { period_date: d, jobs: 0, scores: [], durations: [], delays: 0 };
      byDate[d].jobs++;
      if (r.total_score != null)              byDate[d].scores.push(r.total_score);
      if (r.actual_duration_minutes != null)  byDate[d].durations.push(r.actual_duration_minutes);
      byDate[d].delays += r.delay_count;
    }
    const daily_trend = Object.values(byDate).map(d => ({
      period_date:  d.period_date,
      jobs:         d.jobs,
      avg_score:    d.scores.length    ? round2(d.scores.reduce((a, b) => a + b, 0) / d.scores.length) : null,
      avg_duration: d.durations.length ? round1(d.durations.reduce((a, b) => a + b, 0) / d.durations.length) : null,
      total_delays: d.delays,
    }));

    // Delay breakdown — group by type in JS
    const allDelays = await prisma.gangDelayLog.findMany({
      where: { reported_at: rangeWhere },
    });
    const byType = {};
    for (const d of allDelays) {
      if (!byType[d.delay_type]) byType[d.delay_type] = { delay_type: d.delay_type, count: 0, mins: [] };
      byType[d.delay_type].count++;
      if (d.delay_minutes != null) byType[d.delay_type].mins.push(d.delay_minutes);
    }
    const delay_breakdown = Object.values(byType).map(t => ({
      delay_type:  t.delay_type,
      count:       t.count,
      avg_minutes: t.mins.length ? round1(t.mins.reduce((a, b) => a + b, 0) / t.mins.length) : null,
    })).sort((a, b) => b.count - a.count);

    // Bay stats — join through allocations
    const perfWithBay = await prisma.gangPerformanceRecord.findMany({
      where: { period_date: rangeWhere },
      include: { allocation: { include: { request: { select: { bay_number: true } } } } },
    });
    const byBay = {};
    for (const p of perfWithBay) {
      const bay = p.allocation?.request?.bay_number;
      if (!bay) continue;
      if (!byBay[bay]) byBay[bay] = { bay_number: bay, job_count: 0, durs: [] };
      byBay[bay].job_count++;
      if (p.actual_duration_minutes != null) byBay[bay].durs.push(p.actual_duration_minutes);
    }
    const bay_stats = Object.values(byBay).map(b => ({
      bay_number:   b.bay_number,
      job_count:    b.job_count,
      avg_duration: b.durs.length ? round1(b.durs.reduce((a, c) => a + c, 0) / b.durs.length) : null,
    })).sort((a, b) => b.job_count - a.job_count);

    return res.json({ gang_stats, daily_trend, delay_breakdown, bay_stats });
  } catch (err) { next(err); }
}

// ─── Audit ────────────────────────────────────────────────────────────────────
async function getAuditLog(req, res, next) {
  try {
    const { from, to, gang_id } = req.query;
    const fromDate = from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const toDate   = to   || new Date().toISOString().slice(0, 10);
    const where = {
      allocated_at: { gte: new Date(fromDate), lte: new Date(toDate + 'T23:59:59') },
      ...(gang_id ? { gang_id } : {}),
    };

    const rows = await prisma.gangAllocation.findMany({
      where,
      include: {
        gang:      { select: { gang_code: true } },
        request:   { select: { request_ref: true, bay_number: true, container_number: true, priority: true, agent_name: true } },
        allocator: { select: { name: true } },
        delay_logs: { select: { delay_type: true } },
      },
      orderBy: { allocated_at: 'desc' },
      take: 500,
    });

    const result = rows.map(a => ({
      ...a,
      gang_code:         a.gang.gang_code,
      request_ref:       a.request.request_ref,
      bay_number:        a.request.bay_number,
      container_number:  a.request.container_number,
      priority:          a.request.priority,
      agent_name:        a.request.agent_name,
      allocated_by_name: a.allocator.name,
      delay_count:       a.delay_logs.length,
      delay_types:       a.delay_logs.length ? a.delay_logs.map(d => d.delay_type).join(', ') : null,
    }));

    return res.json(result);
  } catch (err) { next(err); }
}

// ─── Notifications ────────────────────────────────────────────────────────────
async function getNotifications(req, res, next) {
  try {
    const notifications = await prisma.gangNotification.findMany({
      include: { gang: { select: { gang_code: true } } },
      orderBy: { created_at: 'desc' },
      take: 50,
    });
    const result = notifications.map(n => ({ ...n, gang_code: n.gang?.gang_code ?? null }));
    return res.json(result);
  } catch (err) { next(err); }
}

async function markNotificationRead(req, res, next) {
  try {
    await prisma.gangNotification.update({ where: { id: req.params.id }, data: { is_read: true } });
    return res.json({ ok: true });
  } catch (err) { next(err); }
}

// ─── Shift Deployment Limits ──────────────────────────────────────────────────
async function getShiftCapacity(req, res, next) {
  try {
    const { shift, start, end, dow } = getShiftWindow();
    const [limit, used] = await Promise.all([
      prisma.shiftDeploymentLimit.findUnique({ where: { day_of_week_shift: { day_of_week: dow, shift } } }),
      prisma.gangAllocation.findMany({
        where: { allocated_at: { gte: start, lt: end }, status: { not: 'cancelled' } },
        select: { gang_id: true },
        distinct: ['gang_id'],
      }),
    ]);
    const max_gangs = limit?.max_gangs ?? null;
    const used_count = used.length;
    return res.json({
      shift,
      shift_start:  start,
      shift_end:    end,
      day_of_week:  dow,
      day_name:     DAY_NAMES[dow],
      max_gangs,
      used_count,
      remaining:    max_gangs !== null ? Math.max(0, max_gangs - used_count) : null,
      at_limit:     max_gangs !== null && used_count >= max_gangs,
    });
  } catch (err) { next(err); }
}

async function listShiftLimits(req, res, next) {
  try {
    const limits = await prisma.shiftDeploymentLimit.findMany({
      orderBy: [{ day_of_week: 'asc' }, { shift: 'asc' }],
    });
    return res.json(limits.map(l => ({ ...l, day_name: DAY_NAMES[l.day_of_week] })));
  } catch (err) { next(err); }
}

async function updateShiftLimit(req, res, next) {
  try {
    const { day_of_week, shift, max_gangs } = req.body;
    if (day_of_week === undefined || !shift || max_gangs === undefined) {
      return res.status(400).json({ error: 'day_of_week, shift, and max_gangs are required.' });
    }
    const limit = await prisma.shiftDeploymentLimit.upsert({
      where:  { day_of_week_shift: { day_of_week: parseInt(day_of_week), shift } },
      create: { day_of_week: parseInt(day_of_week), shift, max_gangs: parseInt(max_gangs) },
      update: { max_gangs: parseInt(max_gangs) },
    });
    await logAudit(req, 'shift_limit:updated', 'ShiftDeploymentLimit', limit.id, { day_of_week, shift, max_gangs });
    return res.json({ ...limit, day_name: DAY_NAMES[limit.day_of_week] });
  } catch (err) { next(err); }
}

// ─── Substitutions ────────────────────────────────────────────────────────────
async function getReserveMembers(req, res, next) {
  try {
    const reserves = await prisma.gangMember.findMany({
      where: {
        is_active: true,
        status: 'available',
        gang: { specialization: 'Reserve Pool' },
        substituting_for: { none: { ended_at: null } },
      },
      include: { gang: { select: { gang_code: true } } },
      orderBy: [{ gang: { gang_code: 'asc' } }, { full_name: 'asc' }],
    });
    return res.json(reserves.map(m => ({ ...m, gang_code: m.gang.gang_code })));
  } catch (err) { next(err); }
}

async function listActiveSubstitutions(req, res, next) {
  try {
    const subs = await prisma.gangSubstitution.findMany({
      where: { ended_at: null },
      include: {
        gang:          { select: { gang_code: true } },
        absent_member: { select: { id: true, full_name: true, role: true, employee_id: true } },
        substitute:    { select: { id: true, full_name: true, role: true, employee_id: true, gang: { select: { gang_code: true } } } },
        creator:       { select: { name: true } },
      },
      orderBy: { created_at: 'desc' },
    });
    return res.json(subs.map(s => ({
      ...s,
      gang_code:      s.gang.gang_code,
      created_by_name: s.creator.name,
      substitute:     { ...s.substitute, gang_code: s.substitute.gang?.gang_code },
    })));
  } catch (err) { next(err); }
}

async function createSubstitution(req, res, next) {
  try {
    const { absent_member_id, substitute_id, reason, notes } = req.body;
    if (!absent_member_id || !substitute_id) {
      return res.status(400).json({ error: 'absent_member_id and substitute_id are required.' });
    }

    const [absent, substitute] = await Promise.all([
      prisma.gangMember.findUnique({ where: { id: absent_member_id } }),
      prisma.gangMember.findUnique({ where: { id: substitute_id }, include: { gang: { select: { specialization: true } } } }),
    ]);
    if (!absent)     return res.status(404).json({ error: 'Absent member not found.' });
    if (!substitute) return res.status(404).json({ error: 'Substitute member not found.' });
    if (substitute.gang?.specialization !== 'Reserve Pool') {
      return res.status(400).json({ error: 'Substitute must be a member of a Reserve Pool gang.' });
    }

    const existing = await prisma.gangSubstitution.findFirst({
      where: { absent_member_id, ended_at: null },
    });
    if (existing) return res.status(409).json({ error: 'This member already has an active substitution.' });

    const subInUse = await prisma.gangSubstitution.findFirst({
      where: { substitute_id, ended_at: null },
    });
    if (subInUse) return res.status(409).json({ error: 'This reserve member is already substituting elsewhere.' });

    const sub = await prisma.gangSubstitution.create({
      data: {
        gang_id:          absent.gang_id,
        absent_member_id,
        substitute_id,
        reason:           reason || null,
        notes:            notes  || null,
        created_by:       req.user.id,
      },
      include: {
        absent_member: { select: { full_name: true, role: true, employee_id: true } },
        substitute:    { select: { full_name: true, role: true, employee_id: true } },
      },
    });

    await logAudit(req, 'substitution:created', 'GangSubstitution', sub.id, {
      gang_id: absent.gang_id, absent_member_id, substitute_id, reason,
    });

    return res.status(201).json(sub);
  } catch (err) { next(err); }
}

async function endSubstitution(req, res, next) {
  try {
    const sub = await prisma.gangSubstitution.findUnique({ where: { id: req.params.subId } });
    if (!sub)           return res.status(404).json({ error: 'Substitution not found.' });
    if (sub.ended_at)   return res.status(409).json({ error: 'Substitution already ended.' });

    const updated = await prisma.gangSubstitution.update({
      where: { id: req.params.subId },
      data:  { ended_at: new Date() },
    });

    await logAudit(req, 'substitution:ended', 'GangSubstitution', sub.id, { gang_id: sub.gang_id });

    return res.json(updated);
  } catch (err) { next(err); }
}

// ─── Automated Alerts (called by scheduler) ──────────────────────────────────
async function runGangAlerts() {
  try {
    const now = new Date();
    const oneHourAgo  = new Date(now - 3600000);
    const twoHoursAgo = new Date(now - 7200000);
    const thirtyMinAgo = new Date(now - 1800000);

    // 1. Overdue jobs (in_progress, past expected end + 15min)
    const inProgress = await prisma.gangAllocation.findMany({
      where: { status: 'in_progress', expected_start: { not: null } },
      include: { gang: { select: { gang_code: true } }, request: { select: { bay_number: true, container_number: true } } },
    });
    for (const a of inProgress) {
      const expectedEnd = new Date(a.expected_start.getTime() + (a.expected_duration_minutes + 15) * 60000);
      if (now < expectedEnd) continue;
      const recent = await prisma.gangNotification.findFirst({
        where: { allocation_id: a.id, type: 'job_overdue', created_at: { gte: oneHourAgo } },
      });
      if (recent) continue;
      await prisma.gangNotification.create({
        data: { type: 'job_overdue', message: `OVERDUE: Gang ${a.gang.gang_code} — Bay ${a.request.bay_number} (${a.request.container_number})`, allocation_id: a.id, gang_id: a.gang_id },
      });
    }

    // 2. Idle gangs (available, last job completed >2h ago)
    const availableGangs = await prisma.gang.findMany({ where: { status: 'available' } });
    for (const g of availableGangs) {
      const lastJob = await prisma.gangAllocation.findFirst({
        where: { gang_id: g.id, status: 'completed' },
        orderBy: { work_completed_at: 'desc' },
        select: { work_completed_at: true },
      });
      if (!lastJob?.work_completed_at || lastJob.work_completed_at >= twoHoursAgo) continue;
      const recent = await prisma.gangNotification.findFirst({
        where: { gang_id: g.id, type: 'idle_gang', created_at: { gte: twoHoursAgo } },
      });
      if (recent) continue;
      await prisma.gangNotification.create({
        data: { type: 'idle_gang', message: `Gang ${g.gang_code} has been idle for over 2 hours`, gang_id: g.id },
      });
    }

    // 3. Pending requests unallocated >30min
    const longPending = await prisma.gangRequest.findMany({
      where: { status: 'pending', created_at: { lt: thirtyMinAgo } },
    });
    for (const r of longPending) {
      const recent = await prisma.gangNotification.findFirst({
        where: { type: 'pending_request', created_at: { gte: thirtyMinAgo } },
      });
      if (recent) continue;
      await prisma.gangNotification.create({
        data: { type: 'pending_request', message: `UNALLOCATED: ${r.priority.toUpperCase()} request ${r.request_ref} — Bay ${r.bay_number} pending >30min` },
      });
    }
  } catch (_) { /* non-fatal scheduler */ }
}

module.exports = {
  getDashboard,
  listGangs, getGang, createGang, updateGang, deleteGang, setGangStatus,
  listMembers, addMember, updateMember, removeMember, setMemberStatus,
  listRequests, createRequest, cancelRequest,
  recommendGangs, createAllocation, listAllocations,
  logTimestamp, completeJob, logDelay, getDelays, submitFeedback,
  getPerformance,
  getAuditLog,
  getNotifications, markNotificationRead,
  getShiftCapacity, listShiftLimits, updateShiftLimit,
  getReserveMembers, listActiveSubstitutions, createSubstitution, endSubstitution,
  runGangAlerts,
};
