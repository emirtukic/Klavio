const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/roleCheck');
const c = require('../controllers/systemNotificationController');

const sa = [auth, role('super_admin')];
const any = [auth];

router.get('/active',  ...any, c.getActive);
router.get('/',        ...sa,  c.getAll);
router.post('/',       ...sa,  c.create);
router.patch('/:id/toggle', ...sa, c.toggle);
router.delete('/:id',  ...sa,  c.remove);
module.exports = router;
