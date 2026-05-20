const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/statsController');

router.get('/overview',                auth, ctrl.getOverview);
router.get('/club',                    auth, ctrl.getClubStats);
router.get('/attendance',              auth, ctrl.getAttendanceStats);
router.get('/player/:memberId',        auth, ctrl.getPlayerStats);
router.get('/match/:matchId',          auth, ctrl.getMatchStats);
router.post('/match/:matchId',         auth, ctrl.upsertStats);

module.exports = router;
