const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/roleCheck');
const ctrl = require('../controllers/statsController');

router.get('/overview',                auth, ctrl.getOverview);
router.get('/club',                    auth, ctrl.getClubStats);
router.get('/attendance',              auth, ctrl.getAttendanceStats);
router.get('/player/:memberId',        auth, ctrl.getPlayerStats);
router.get('/match/:matchId',          auth, ctrl.getMatchStats);
router.post('/match/:matchId',         auth, role('super_admin', 'admin', 'coach'), ctrl.upsertStats);

module.exports = router;
