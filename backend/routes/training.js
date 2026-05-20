const router = require('express').Router();
const ctrl = require('../controllers/trainingController');
const auth = require('../middleware/auth');
const role = require('../middleware/roleCheck');
const log  = require('../controllers/activityController').log;

router.get('/my-schedule', auth, ctrl.getMySchedule);
router.get('/',    auth, ctrl.getAll);
router.get('/:id', auth, ctrl.getOne);
router.post('/',   auth, role('super_admin', 'admin', 'coach'), log('create', 'Trening'), ctrl.create);
router.put('/:id', auth, role('super_admin', 'admin', 'coach'), log('update', 'Trening'), ctrl.update);
router.delete('/:id', auth, role('super_admin', 'admin'),       log('delete', 'Trening'), ctrl.remove);
router.post('/:id/attendance', auth, role('super_admin', 'admin', 'coach'), log('update', 'Trening'), ctrl.markAttendance);

module.exports = router;
