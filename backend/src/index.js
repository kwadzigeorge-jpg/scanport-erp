require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const { startDailyCheck } = require('./jobs/dailyCheck');
const { startBackupJob } = require('./jobs/backupJob');
const { startSlaCheck } = require('./jobs/slaCheck');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api', routes);
app.use(errorHandler);

const DAY_DEFAULTS = [3,3,3,3,3,3,3]; // Sun–Sat day-shift max gangs
const NIGHT_DEFAULTS = [2,2,2,2,2,2,2]; // Sun–Sat night-shift max gangs

async function seedShiftLimits() {
  const count = await prisma.shiftDeploymentLimit.count();
  if (count > 0) return;
  const rows = [];
  for (let d = 0; d < 7; d++) {
    rows.push({ day_of_week: d, shift: 'day',   max_gangs: DAY_DEFAULTS[d] });
    rows.push({ day_of_week: d, shift: 'night', max_gangs: NIGHT_DEFAULTS[d] });
  }
  await prisma.shiftDeploymentLimit.createMany({ data: rows });
  console.log('[Seed] shift_deployment_limits seeded with 14 rows');
}

async function main() {
  await prisma.$connect();
  console.log('[DB] Connected to PostgreSQL');
  await seedShiftLimits();

  startDailyCheck();
  startBackupJob();
  startSlaCheck();

  app.listen(PORT, () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
    console.log(`[API]    http://localhost:${PORT}/api/health`);
  });
}

main().catch((err) => {
  console.error('Startup error:', err);
  process.exit(1);
});
