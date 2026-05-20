const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/roleCheck');
const ctrl = require('../controllers/selectionController');

const admin = role('super_admin', 'admin');

router.get('/',                           auth, admin, ctrl.getAll);
router.post('/',                          auth, admin, ctrl.create);
router.get('/:id',                        auth, admin, ctrl.getOne);
router.put('/:id',                        auth, admin, ctrl.update);
router.delete('/:id',                     auth, admin, ctrl.remove);
router.get('/:id/members',                auth, admin, ctrl.getMembers);
router.post('/:id/members',               auth, admin, ctrl.assignMember);
router.delete('/:id/members/:memberId',   auth, admin, ctrl.removeMember);
router.get('/:id/coaches',                auth, admin, ctrl.getCoaches);
router.post('/:id/coaches',               auth, admin, ctrl.assignCoach);
router.delete('/:id/coaches/:coachId',    auth, admin, ctrl.removeCoach);

module.exports = router;
