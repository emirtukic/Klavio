const router = require('express').Router();
const ctrl = require('../controllers/tournamentController');
const auth = require('../middleware/auth');
const role = require('../middleware/roleCheck');
const requirePlan = require('../middleware/requirePlan');
const log  = require('../controllers/activityController').log;

const staff = [auth, role('super_admin', 'admin', 'coach'), requirePlan('pro')];

// /mine and /:id stay open to any plan - a club that drops back to Starter
// after having tournaments shouldn't lock invited members out of what
// already exists, it just can't create anything new (gated below).
router.get('/mine', auth, ctrl.getMine);
router.get('/fees-overview', ...staff, ctrl.getFeesOverview);
router.get('/member/:memberId/fees', auth, requirePlan('pro'), ctrl.getMemberFees);
router.get('/',     ...staff, ctrl.getAll);
router.get('/:id',  auth, ctrl.getOne); // open to members too - controller enforces they were invited
router.post('/',    ...staff, log('create', 'Turnir'), ctrl.create);
router.post('/:id/matches', ...staff, log('create', 'Turnir'), ctrl.addMatch);
router.delete('/:id/matches/:matchId', ...staff, log('delete', 'Turnir'), ctrl.removeMatch);
router.post('/:id/invite', ...staff, log('update', 'Turnir'), ctrl.invite);
router.put('/:id/fees/:feeId/pay', ...staff, log('update', 'Turnir'), ctrl.markFeePaid);
router.delete('/:id', ...staff, log('delete', 'Turnir'), ctrl.remove);

module.exports = router;
