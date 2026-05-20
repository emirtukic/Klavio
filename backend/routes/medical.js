const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/medicalController');

router.get('/:memberId',    auth, ctrl.get);
router.put('/:memberId',    auth, ctrl.upsert);

module.exports = router;
