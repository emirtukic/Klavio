const router = require('express').Router();
const ctrl = require('../controllers/tournamentController');
const auth = require('../middleware/auth');
const role = require('../middleware/roleCheck');
const log  = require('../controllers/activityController').log;

const staff = [auth, role('super_admin', 'admin', 'coach')];

router.get('/mine', auth, ctrl.getMine);
router.get('/',     ...staff, ctrl.getAll);
router.get('/:id',  ...staff, ctrl.getOne);
router.post('/',    ...staff, log('create', 'Turnir'), ctrl.create);
router.post('/:id/invite', ...staff, log('update', 'Turnir'), ctrl.invite);
router.put('/:id/fees/:feeId/pay', ...staff, log('update', 'Turnir'), ctrl.markFeePaid);
router.delete('/:id', ...staff, log('delete', 'Turnir'), ctrl.remove);

module.exports = router;
