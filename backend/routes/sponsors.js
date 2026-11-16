const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/roleCheck');
const requirePlan = require('../middleware/requirePlan');
const ctrl = require('../controllers/sponsorController');
const adminOrSa = role('admin','super_admin');
const klub = requirePlan('klub');

router.get('/',       auth, adminOrSa, klub, ctrl.getAll);
router.post('/',      auth, adminOrSa, klub, ctrl.create);
router.put('/:id',    auth, adminOrSa, klub, ctrl.update);
router.delete('/:id', auth, adminOrSa, klub, ctrl.remove);

module.exports = router;
