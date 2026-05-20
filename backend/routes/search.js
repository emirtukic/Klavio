const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/searchController');

router.get('/', auth, ctrl.search);

module.exports = router;
