const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/roleCheck');
const ctrl = require('../controllers/clubController');

const sa = role('super_admin');

router.get('/',                       auth, sa, ctrl.getAll);
router.post('/',                      auth, sa, ctrl.create);
router.get('/:id',                    auth, sa, ctrl.getOne);
router.put('/:id',                    auth, sa, ctrl.update);
router.delete('/:id',                 auth, sa, ctrl.remove);
router.post('/:id/access',            auth, sa, ctrl.accessClub);
router.get('/:id/admins',             auth, sa, ctrl.getAdmins);
router.post('/:id/admins',            auth, sa, ctrl.createAdmin);
router.delete('/:id/admins/:userId',        auth, sa, ctrl.deleteAdmin);
router.post('/:id/admins/:userId/reset',    auth, sa, ctrl.resetAdminPassword);
router.post('/:id/logo',                   auth, sa, ctrl.logoUpload.single('logo'), ctrl.uploadLogo);

module.exports = router;
