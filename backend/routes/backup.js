const router = require('express').Router();
const multer = require('multer');
const auth = require('../middleware/auth');
const role = require('../middleware/roleCheck');
const ctrl = require('../controllers/backupController');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.get('/export', auth, role('admin', 'super_admin'), ctrl.exportJSON);
router.post('/import', auth, role('admin', 'super_admin'), upload.single('backup'), ctrl.importBackup);

module.exports = router;
