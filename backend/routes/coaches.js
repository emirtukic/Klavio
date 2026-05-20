const router = require('express').Router();
const ctrl = require('../controllers/coachController');
const auth = require('../middleware/auth');
const role = require('../middleware/roleCheck');

router.get('/my-schedule', auth, role('coach'), ctrl.getMySchedule);
router.get('/', auth, ctrl.getAll);
router.get('/:id', auth, ctrl.getOne);
router.get('/:id/schedule', auth, ctrl.getSchedule);
router.post('/', auth, role('super_admin', 'admin'), ctrl.create);
router.put('/:id', auth, role('super_admin', 'admin'), ctrl.update);
router.delete('/:id', auth, role('super_admin', 'admin'), ctrl.remove);

module.exports = router;
