const router = require('express').Router();

router.use('/auth',           require('./auth'));
router.use('/scanners',       require('./scanners'));
router.use('/certifications', require('./certifications'));
router.use('/notifications',  require('./notifications'));
router.use('/dashboard',      require('./dashboard'));
router.use('/reports',        require('./reports'));
router.use('/audit',          require('./audit'));
router.use('/admin',          require('./admin'));
router.use('/incidents',      require('./incidents'));
router.use('/scanner-board',   require('./scannerBoard'));
router.use('/agent-requests',  require('./agentRequests'));
router.use('/gangs',           require('./gangs'));

router.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

module.exports = router;
