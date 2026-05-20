const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/roleCheck');
const c = require('../controllers/platformMessagingController');

const sa    = [auth, role('super_admin')];
const any   = [auth, role('super_admin', 'admin')];

router.get('/mine',          ...any, c.getMine);
router.get('/:id/replies',   ...any, c.getReplies);
router.post('/:id/replies',  ...any, c.addReply);
router.get('/',              ...sa,  c.getAll);
router.post('/',             ...sa,  c.send);
router.delete('/:id',        ...sa,  c.remove);
module.exports = router;
