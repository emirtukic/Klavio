const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/roleCheck');
const ctrl = require('../controllers/galleryController');

router.get('/',       auth, ctrl.getAll);
router.post('/',      auth, ctrl.upload.single('photo'), ctrl.uploadPhoto);
router.delete('/:id', auth, role('admin','super_admin','coach'), ctrl.remove);

module.exports = router;
