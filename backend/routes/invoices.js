const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/roleCheck');
const c = require('../controllers/invoiceController');

const sa    = [auth, role('super_admin')];
const admin = [auth, role('super_admin','admin')];

router.get('/mine',   ...admin, c.getMine);
router.get('/',       ...sa,    c.getAll);
router.post('/',      ...sa,    c.create);
router.patch('/:id',  ...sa,    c.update);
router.delete('/:id', ...sa,    c.remove);
module.exports = router;
