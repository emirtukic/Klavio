const router = require('express').Router();
const ctrl = require('../controllers/feeController');
const auth = require('../middleware/auth');
const role = require('../middleware/roleCheck');
const log  = require('../controllers/activityController').log;

router.get('/stats',           auth, role('super_admin', 'admin', 'coach'), ctrl.getStats);
router.get('/member/:memberId', auth, ctrl.getMemberFees);
router.get('/',                auth, role('super_admin', 'admin', 'coach'), ctrl.getAll);
router.post('/',               auth, role('super_admin', 'admin', 'coach'), log('create', 'Članarina'), ctrl.create);
router.post('/bulk-generate/preview', auth, role('super_admin', 'admin', 'coach'), ctrl.bulkPreview);
router.post('/bulk-generate',  auth, role('super_admin', 'admin', 'coach'), log('create', 'Članarina (masovno)'), ctrl.bulkGenerate);
router.get('/last-period',     auth, role('super_admin', 'admin', 'coach'), ctrl.getLastPeriod);
router.post('/duplicate-last-month', auth, role('super_admin', 'admin', 'coach'), log('create', 'Članarina (duplirano)'), ctrl.duplicateLastPeriod);
router.put('/:id/pay',         auth, role('super_admin', 'admin', 'coach'), log('update', 'Članarina'), ctrl.markPaid);
router.put('/:id',             auth, role('super_admin', 'admin', 'coach'), log('update', 'Članarina'), ctrl.update);
router.delete('/:id',          auth, role('super_admin', 'admin', 'coach'), log('delete', 'Članarina'), ctrl.remove);

module.exports = router;
