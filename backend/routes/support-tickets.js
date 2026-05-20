const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/roleCheck');
const c = require('../controllers/supportTicketController');

const sa    = [auth, role('super_admin')];
const admin = [auth, role('super_admin','admin')];

router.get('/',              ...sa,    c.getAll);
router.get('/mine',          ...admin, c.getMine);
router.post('/',             ...admin, c.create);
router.get('/:id/replies',   ...admin, c.getReplies);
router.post('/:id/replies',  ...admin, c.reply);
router.patch('/:id/status',  ...sa,    c.updateStatus);
module.exports = router;
