const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/roleCheck');
const ctrl = require('../controllers/lineupController');

router.get('/:matchId',                    auth, ctrl.getLineup);
router.post('/:matchId',                   auth, role('admin','super_admin','coach'), ctrl.saveLineup);
router.delete('/:matchId/:memberId',       auth, role('admin','super_admin','coach'), ctrl.removePlayer);

module.exports = router;
