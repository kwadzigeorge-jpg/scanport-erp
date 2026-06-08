const { PrismaClient } = require('@prisma/client');
const { format } = require('date-fns');

const prisma = new PrismaClient();

const SCANNERS = [
  'IMPORT_1', 'IMPORT_2', 'IMPORT_3',
  'EXPORT_1', 'EXPORT_2', 'EXPORT_3',
];

function today() {
  return format(new Date(), 'yyyy-MM-dd');
}

// Compute auto-incrementing session ID (base 370 to feel like an established system)
async function getSessionId(date, shift) {
  const count = await prisma.scannerBoardEntry.count({
    where: { NOT: { sessionId: 0 } },
  });
  // Find or build a session id for this date+shift combo
  const existing = await prisma.scannerBoardEntry.findFirst({
    where: { date, shift, sessionId: { gt: 0 } },
    select: { sessionId: true },
  });
  if (existing) return existing.sessionId;
  return 370 + count + 1;
}

// ─── Get Board State ──────────────────────────────────────────────────────────

async function getBoard(req, res, next) {
  try {
    const date  = req.query.date  || today();
    const shift = req.query.shift || 'MORNING';

    // Fetch existing entries
    const entries = await prisma.scannerBoardEntry.findMany({
      where: { date, shift },
    });

    const entryMap = Object.fromEntries(entries.map((e) => [e.scanner, e]));

    // Fill in defaults for any scanner that has no entry yet
    const board = SCANNERS.map((scanner) => entryMap[scanner] || {
      scanner,
      date,
      shift,
      status:       'OPERATIONAL',
      faultType:    null,
      faultNote:    null,
      updateRemark: null,
      scanCount:    0,
      preparedBy:   null,
      sessionId:    0,
    });

    const sessionId = entries[0]?.sessionId || 0;
    const preparedBy = entries[0]?.preparedBy || '';

    res.json({ date, shift, sessionId, preparedBy, board });
  } catch (err) { next(err); }
}

// ─── Update a Single Scanner Cell ────────────────────────────────────────────

async function updateScanner(req, res, next) {
  try {
    const { scanner } = req.params;
    const {
      date, shift, status, faultType, faultNote,
      updateRemark, scanCount, preparedBy,
    } = req.body;

    if (!SCANNERS.includes(scanner)) {
      return res.status(400).json({ error: 'Invalid scanner ID.' });
    }

    const d = date  || today();
    const s = shift || 'MORNING';

    // Get or compute session ID
    let sessionId = await getSessionId(d, s);

    // Find current state for diff
    const existing = await prisma.scannerBoardEntry.findUnique({
      where: { date_shift_scanner: { date: d, shift: s, scanner } },
    });

    // Build change log
    const changes = [];
    const fields = { status, faultType, faultNote, updateRemark, scanCount };
    for (const [field, newVal] of Object.entries(fields)) {
      if (newVal === undefined) continue;
      const oldVal = existing?.[field] ?? null;
      const nv = newVal === '' ? null : newVal;
      if (String(oldVal ?? '') !== String(nv ?? '')) {
        changes.push({ field, from: oldVal, to: nv });
      }
    }

    // Upsert entry
    const entry = await prisma.scannerBoardEntry.upsert({
      where: { date_shift_scanner: { date: d, shift: s, scanner } },
      create: {
        date: d, shift: s, scanner,
        status:       status       ?? 'OPERATIONAL',
        faultType:    faultType    || null,
        faultNote:    faultNote    || null,
        updateRemark: updateRemark || null,
        scanCount:    Number(scanCount ?? 0),
        preparedBy:   preparedBy   || null,
        sessionId,
      },
      update: {
        ...(status       !== undefined && { status }),
        ...(faultType    !== undefined && { faultType:    faultType    || null }),
        ...(faultNote    !== undefined && { faultNote:    faultNote    || null }),
        ...(updateRemark !== undefined && { updateRemark: updateRemark || null }),
        ...(scanCount    !== undefined && { scanCount:    Number(scanCount) }),
        ...(preparedBy   !== undefined && { preparedBy:   preparedBy   || null }),
        sessionId,
      },
    });

    // Record history if anything changed
    if (changes.length > 0) {
      await prisma.boardHistory.create({
        data: {
          date:      d,
          shift:     s,
          scanner,
          changes:   JSON.stringify(changes),
          updatedBy: req.user?.name || req.user?.email || 'Unknown',
          sessionId,
        },
      });
    }

    res.json(entry);
  } catch (err) { next(err); }
}

// ─── Update Prepared By / Shift Header ───────────────────────────────────────

async function updateHeader(req, res, next) {
  try {
    const { date, shift, preparedBy } = req.body;
    const d = date || today();
    const s = shift || 'MORNING';

    // Update all entries for this shift with the new preparedBy
    await prisma.scannerBoardEntry.updateMany({
      where: { date: d, shift: s },
      data:  { preparedBy: preparedBy || null },
    });

    res.json({ ok: true });
  } catch (err) { next(err); }
}

// ─── Get History ──────────────────────────────────────────────────────────────

async function getHistory(req, res, next) {
  try {
    const date  = req.query.date  || today();
    const shift = req.query.shift || 'MORNING';
    const all   = req.query.all   === 'true';

    const where = all ? {} : { date, shift };

    const history = await prisma.boardHistory.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const enriched = history.map((h) => ({
      ...h,
      changes: JSON.parse(h.changes || '[]'),
    }));

    res.json(enriched);
  } catch (err) { next(err); }
}

// ─── Clear History (Admin only) ───────────────────────────────────────────────

async function clearHistory(req, res, next) {
  try {
    const { date, shift } = req.body;
    await prisma.boardHistory.deleteMany({
      where: { date: date || today(), shift: shift || 'MORNING' },
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

module.exports = { getBoard, updateScanner, updateHeader, getHistory, clearHistory };
