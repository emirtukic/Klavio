const router = require('express').Router();
const ctrl = require('../controllers/feeController');
const auth = require('../middleware/auth');
const role = require('../middleware/roleCheck');
const log  = require('../controllers/activityController').log;

router.get('/stats',           auth, role('super_admin', 'admin'), ctrl.getStats);
router.get('/member/:memberId', auth, ctrl.getMemberFees);
router.get('/',                auth, role('super_admin', 'admin'), ctrl.getAll);
router.post('/',               auth, role('super_admin', 'admin'), log('create', 'Članarina'), ctrl.create);
router.put('/:id/pay',         auth, role('super_admin', 'admin'), log('update', 'Članarina'), ctrl.markPaid);
router.put('/:id',             auth, role('super_admin', 'admin'), log('update', 'Članarina'), ctrl.update);
router.delete('/:id',          auth, role('super_admin', 'admin'), log('delete', 'Članarina'), ctrl.remove);

module.exports = router;
