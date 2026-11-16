const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/roleCheck');
const requirePlan = require('../middleware/requirePlan');
const ctrl = require('../controllers/developmentController');
const pro = requirePlan('pro');

// /member/:memberId feeds the member profile page, open to every plan.
// The list view and management actions belong to the Pro-only Razvoj
// igrača page.
router.get('/member/:memberId',    auth, ctrl.getOne);

router.get('/',                    auth, pro, ctrl.getAll);
router.post('/',                   auth, role('admin','super_admin','coach'), pro, ctrl.upsert);
router.delete('/:id',              auth, role('admin','super_admin','coach'), pro, ctrl.remove);

module.exports = router;
