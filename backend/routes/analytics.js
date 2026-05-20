const router = require('express').Router();
const auth   = require('../middleware/auth');
const role   = require('../middleware/roleCheck');
const c      = require('../controllers/analyticsController');

const sa = [auth, role('super_admin')];

router.get('/summary',        ...sa, c.summary);
router.get('/revenue',        ...sa, c.revenue);
router.get('/clubs-growth',   ...sa, c.clubsGrowth);
router.get('/subscriptions',  ...sa, c.subscriptions);
router.get('/top-clubs',      ...sa, c.topClubs);
router.get('/members-growth',   ...sa, c.membersGrowth);
router.get('/platform-health',  ...sa, c.platformHealth);
router.get('/forms-stats',      ...sa, c.formsStats);

module.exports = router;
