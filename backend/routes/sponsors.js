const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/roleCheck');
const ctrl = require('../controllers/sponsorController');
const adminOrSa = role('admin','super_admin');

router.get('/',       auth, adminOrSa, ctrl.getAll);
router.post('/',      auth, adminOrSa, ctrl.create);
router.put('/:id',    auth, adminOrSa, ctrl.update);
router.delete('/:id', auth, adminOrSa, ctrl.remove);

module.exports = router;
