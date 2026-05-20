const router = require('express').Router();
const ctrl = require('../controllers/appointmentController');
const auth = require('../middleware/auth');
const role = require('../middleware/roleCheck');

router.get('/my', auth, ctrl.getMyAppointments);
router.get('/', auth, role('super_admin', 'admin'), ctrl.getAll);
router.post('/', auth, ctrl.create);
router.put('/:id', auth, ctrl.update);
router.delete('/:id', auth, ctrl.remove);

module.exports = router;
