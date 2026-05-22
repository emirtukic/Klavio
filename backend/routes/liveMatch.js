const router = require('express').Router();
const ctrl   = require('../controllers/liveMatchController');
const auth   = require('../middleware/auth');
const role   = require('../middleware/roleCheck');

const canManage = role('super_admin', 'admin', 'coach');

router.get('/active',              auth, ctrl.getActive);
router.get('/:matchId',            auth, ctrl.getState);
router.get('/:matchId/stream',     auth, ctrl.stream);

router.post('/:matchId/start',     auth, canManage, ctrl.startMatch);
router.post('/:matchId/pause',     auth, canManage, ctrl.pauseMatch);
router.post('/:matchId/resume',    auth, canManage, ctrl.resumeMatch);
router.post('/:matchId/end',       auth, canManage, ctrl.endMatch);
router.post('/:matchId/events',    auth, canManage, ctrl.addEvent);
router.delete('/:matchId/events/:eventId', auth, canManage, ctrl.deleteEvent);

module.exports = router;
