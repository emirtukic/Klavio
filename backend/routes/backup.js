const router = require('express').Router();
const multer = require('multer');
const auth = require('../middleware/auth');
const role = require('../middleware/roleCheck');
const ctrl = require('../controllers/backupController');
const { runFullBackup } = require('../services/dbBackupService');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.get('/export', auth, role('admin', 'super_admin'), ctrl.exportJSON);
router.post('/import', auth, role('admin', 'super_admin'), upload.single('backup'), ctrl.importBackup);

// Manual trigger for the full-database backup (otherwise only runs nightly at 03:00) - super_admin only.
router.post('/full', auth, role('super_admin'), async (req, res) => {
  try {
    const result = await runFullBackup();
    res.json({ message: 'Backup uspješan', ...result });
  } catch (err) {
    console.error('Manual full backup error:', err.message);
    res.status(500).json({ message: 'Backup nije uspio: ' + err.message });
  }
});

module.exports = router;
