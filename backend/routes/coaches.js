const router = require('express').Router();
const ctrl = require('../controllers/coachController');
const auth = require('../middleware/auth');
const role = require('../middleware/roleCheck');
const { log } = require('../controllers/activityController');

router.get('/my-schedule', auth, role('coach'), ctrl.getMySchedule);
router.get('/', auth, ctrl.getAll);
router.get('/:id', auth, ctrl.getOne);
router.get('/:id/schedule', auth, ctrl.getSchedule);
router.post('/', auth, role('super_admin', 'admin'), log('create', 'Trener'), ctrl.create);
router.put('/:id', auth, role('super_admin', 'admin'), log('update', 'Trener'), ctrl.update);
router.delete('/:id', auth, role('super_admin', 'admin'), log('delete', 'Trener'), ctrl.remove);

module.exports = router;
