const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/roleCheck');
const requirePlan = require('../middleware/requirePlan');
const ctrl = require('../controllers/financeController');
const { log } = require('../controllers/activityController');
const adminOrSa = role('admin', 'super_admin');
const pro = requirePlan('pro');

// /stats powers a summary widget on the free admin dashboard - stays open
// to every plan. The rest of this module is the Pro-only Finansije page.
router.get('/stats',  auth, adminOrSa, ctrl.getStats);

router.get('/goal',   auth, adminOrSa, pro, ctrl.getGoal);
router.put('/goal',   auth, adminOrSa, pro, ctrl.setGoal);
router.get('/',       auth, adminOrSa, pro, ctrl.getAll);
router.post('/',      auth, adminOrSa, pro, log('create', 'Finansije'), ctrl.create);
router.put('/:id',    auth, adminOrSa, pro, log('update', 'Finansije'), ctrl.update);
router.delete('/:id', auth, adminOrSa, pro, log('delete', 'Finansije'), ctrl.remove);

module.exports = router;
