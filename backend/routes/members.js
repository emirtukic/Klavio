const router = require('express').Router();
const ctrl = require('../controllers/memberController');
const auth = require('../middleware/auth');
const role = require('../middleware/roleCheck');
const log  = require('../controllers/activityController').log;

router.get('/my-profile', auth, role('member'), ctrl.getMyProfile);
router.get('/',    auth, role('super_admin', 'admin', 'coach'), ctrl.getAll);
router.get('/:id', auth, role('super_admin', 'admin', 'coach'), ctrl.getOne);
router.post('/',   auth, role('super_admin', 'admin'), log('create', 'Član'), ctrl.create);
router.put('/:id', auth, role('super_admin', 'admin'), log('update', 'Član'), ctrl.update);
router.post('/bulk',  auth, role('super_admin', 'admin'), ctrl.bulkAction);
router.delete('/:id', auth, role('super_admin', 'admin'), log('delete', 'Član'), ctrl.remove);

module.exports = router;
