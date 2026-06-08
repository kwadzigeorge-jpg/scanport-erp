const cron = require('node-cron');
const { runDailyCheck } = require('../services/alertService');

function startDailyCheck() {
  // Run at 07:00 every day
  cron.schedule('0 7 * * *', () => {
    runDailyCheck().catch((err) => console.error('[Cron error]', err));
  });

  // Also run immediately on startup so alerts surface right away
  runDailyCheck().catch((err) => console.error('[Startup check error]', err));

  console.log('[Cron] Daily certification check scheduled at 07:00 every day.');
}

module.exports = { startDailyCheck };
