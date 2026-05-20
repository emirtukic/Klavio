const router = require('express').Router();
const ctrl = require('../controllers/matchController');
const auth = require('../middleware/auth');
const role = require('../middleware/roleCheck');
const log  = require('../controllers/activityController').log;

router.get('/standings', auth, ctrl.getStandings);
router.get('/',    auth, ctrl.getAll);
router.get('/:id', auth, ctrl.getOne);
router.post('/',   auth, role('super_admin', 'admin', 'coach'), log('create', 'Utakmica'), ctrl.create);
router.put('/:id', auth, role('super_admin', 'admin', 'coach'), log('update', 'Utakmica'), ctrl.update);
router.delete('/:id', auth, role('super_admin', 'admin', 'coach'), log('delete', 'Utakmica'), ctrl.remove);

module.exports = router;
