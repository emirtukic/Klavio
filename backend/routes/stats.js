const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/roleCheck');
const requirePlan = require('../middleware/requirePlan');
const ctrl = require('../controllers/statsController');
const pro = requirePlan('pro');

// /club, /attendance and /match power the free coach dashboard and the
// Utakmice pages - stay open to every plan. /overview and /player are
// exclusive to the Pro-only Statistike page.
router.get('/club',                    auth, ctrl.getClubStats);
router.get('/attendance',              auth, ctrl.getAttendanceStats);
router.get('/match/:matchId',          auth, ctrl.getMatchStats);
router.post('/match/:matchId',         auth, role('super_admin', 'admin', 'coach'), ctrl.upsertStats);

router.get('/overview',                auth, pro, ctrl.getOverview);
router.get('/player/:memberId',        auth, pro, ctrl.getPlayerStats);

module.exports = router;
