const router = require('express').Router({ mergeParams: true });
const auth   = require('../middleware/auth');
const role   = require('../middleware/roleCheck');
const ctrl   = require('../controllers/memberDocumentController');

const canManage = role('admin', 'super_admin', 'coach');

router.get('/',    auth, canManage, ctrl.getAll);
router.post('/',   auth, canManage, ctrl.upload.single('file'), ctrl.create);
router.delete('/:id', auth, canManage, ctrl.remove);

module.exports = router;
