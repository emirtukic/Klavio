const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/roleCheck');
const ctrl = require('../controllers/developmentController');

router.get('/',                    auth, ctrl.getAll);
router.get('/member/:memberId',    auth, ctrl.getOne);
router.post('/',                   auth, role('admin','super_admin','coach'), ctrl.upsert);
router.delete('/:id',              auth, role('admin','super_admin','coach'), ctrl.remove);

module.exports = router;
