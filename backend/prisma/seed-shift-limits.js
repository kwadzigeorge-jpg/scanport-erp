const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const rows = [
    { day_of_week: 1, shift: 'day',   max_gangs: 30 },
    { day_of_week: 1, shift: 'night', max_gangs: 30 },
    { day_of_week: 2, shift: 'day',   max_gangs: 40 },
    { day_of_week: 2, shift: 'night', max_gangs: 40 },
    { day_of_week: 3, shift: 'day',   max_gangs: 50 },
    { day_of_week: 3, shift: 'night', max_gangs: 45 },
    { day_of_week: 4, shift: 'day',   max_gangs: 50 },
    { day_of_week: 4, shift: 'night', max_gangs: 45 },
    { day_of_week: 5, shift: 'day',   max_gangs: 50 },
    { day_of_week: 5, shift: 'night', max_gangs: 45 },
    { day_of_week: 6, shift: 'day',   max_gangs: 35 },
    { day_of_week: 6, shift: 'night', max_gangs: 25 },
    { day_of_week: 0, shift: 'day',   max_gangs:  5 },
    { day_of_week: 0, shift: 'night', max_gangs:  5 },
  ];

  let count = 0;
  for (const row of rows) {
    await prisma.shiftDeploymentLimit.upsert({
      where: { day_of_week_shift: { day_of_week: row.day_of_week, shift: row.shift } },
      create: row,
      update: {},
    });
    count++;
  }
  console.log(`Seeded ${count} shift limits.`);
}

main().finally(() => prisma.$disconnect());
