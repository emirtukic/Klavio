const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const roleCheck  = require('../middleware/roleCheck');
const c = require('../controllers/platformController');

const superAdmin = [verifyToken, roleCheck('super_admin')];
const adminOrAbove = [verifyToken, roleCheck('super_admin', 'admin')];

router.get('/my-subscription',       ...adminOrAbove, c.getMySubscription);
router.get('/stats',                 ...superAdmin,   c.getStats);
router.get('/subscriptions',         ...superAdmin,   c.getAllSubscriptions);
router.get('/subscriptions/:clubId', ...superAdmin,   c.getSubscription);
router.put('/subscriptions/:clubId', ...superAdmin,   c.upsertSubscription);

module.exports = router;
