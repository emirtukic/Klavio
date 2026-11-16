const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/roleCheck');
const requirePlan = require('../middleware/requirePlan');
const ctrl = require('../controllers/equipmentController');
const klub = requirePlan('klub');

router.get('/',       auth, klub, ctrl.getAll);
router.post('/',      auth, role('admin', 'super_admin', 'coach'), klub, ctrl.create);
router.put('/:id',    auth, role('admin', 'super_admin', 'coach'), klub, ctrl.update);
router.delete('/:id', auth, role('admin', 'super_admin', 'coach'), klub, ctrl.remove);

module.exports = router;
