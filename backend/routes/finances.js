const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/roleCheck');
const ctrl = require('../controllers/financeController');
const adminOrSa = role('admin', 'super_admin');

router.get('/goal',   auth, adminOrSa, ctrl.getGoal);
router.put('/goal',   auth, adminOrSa, ctrl.setGoal);
router.get('/',       auth, adminOrSa, ctrl.getAll);
router.get('/stats',  auth, adminOrSa, ctrl.getStats);
router.post('/',      auth, adminOrSa, ctrl.create);
router.put('/:id',    auth, adminOrSa, ctrl.update);
router.delete('/:id', auth, adminOrSa, ctrl.remove);

module.exports = router;
