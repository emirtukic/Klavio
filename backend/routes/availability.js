const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/availabilityController');

router.get('/my',                          auth, ctrl.getMyAvailability);
router.get('/:event_type/:event_id',       auth, ctrl.getForEvent);
router.post('/:event_type/:event_id',      auth, ctrl.setAvailability);

module.exports = router;
