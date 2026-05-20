const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/roleCheck');
const ctrl = require('../controllers/notificationController');

router.get('/',                   auth, ctrl.getAll);
router.get('/unread',             auth, ctrl.getUnreadCount);
router.put('/:id/read',           auth, ctrl.markRead);
router.put('/mark-all-read',      auth, ctrl.markAllRead);
router.delete('/:id',             auth, ctrl.remove);
router.post('/notify-club',       auth, role('admin','super_admin'), ctrl.notifyClub);

module.exports = router;
