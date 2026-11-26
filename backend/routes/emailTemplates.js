const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/roleCheck');
const c = require('../controllers/emailTemplateController');

const sa = [auth, role('super_admin')];

router.get('/branding',              ...sa, c.getBranding);
router.put('/branding',              ...sa, c.updateBranding);
router.get('/templates',             ...sa, c.listTemplates);
router.put('/templates/:key',        ...sa, c.updateTemplate);
router.post('/templates/:key/reset', ...sa, c.resetTemplate);
router.post('/templates/:key/test',  ...sa, c.sendTest);

module.exports = router;
