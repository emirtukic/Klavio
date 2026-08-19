const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const PizZip  = require('pizzip');
const Docxtemplater = require('docxtemplater');
const db      = require('../config/db');
const auth    = require('../middleware/auth');
const role    = require('../middleware/roleCheck');

const FORMS_DIR = path.resolve(__dirname, '../../obrazci');

// Ensure history table exists
db.query(`
  CREATE TABLE IF NOT EXISTS form_history (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    club_id    INT NOT NULL,
    filled_by  INT NOT NULL,
    user_name  VARCHAR(100),
    form_type  VARCHAR(50) NOT NULL,
    form_name  VARCHAR(255) NOT NULL,
    summary    VARCHAR(500),
    filled_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (club_id, filled_at)
  )
`).catch(err => console.error('[form_history] table init:', err.message));

// POST /api/forms/history - save a fill event
router.post('/history', auth, role('admin', 'super_admin'), async (req, res) => {
  try {
    const { form_type, form_name, summary } = req.body;
    if (!form_type || !form_name) return res.status(400).json({ message: 'form_type and form_name required' });
    await db.query(
      `INSERT INTO form_history (club_id, filled_by, user_name, form_type, form_name, summary)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.club_id, req.user.id, req.user.name || '', form_type, form_name, summary || '']
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/forms/history - list fill history for club
router.get('/history', auth, role('admin', 'super_admin'), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, form_type, form_name, summary, user_name, filled_at
       FROM form_history WHERE club_id = ? ORDER BY filled_at DESC LIMIT 100`,
      [req.user.club_id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/forms/fill
// Body: { template: "NSFBIH/Obrazac-spisak igrača...docx", data: { key: value, ... } }
// Returns: filled .docx file as download
router.post('/fill', auth, (req, res) => {
  const { template, data } = req.body;
  if (!template) return res.status(400).json({ message: 'template required' });

  const resolved = path.resolve(FORMS_DIR, template);
  if (!resolved.startsWith(FORMS_DIR)) {
    return res.status(400).json({ message: 'Invalid template path' });
  }
  if (!fs.existsSync(resolved)) {
    return res.status(404).json({ message: 'Template not found: ' + template });
  }

  try {
    const content = fs.readFileSync(resolved, 'binary');
    const zip     = new PizZip(content);
    const doc     = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks:    true,
      nullGetter:    () => '',
    });

    doc.render(data || {});

    const buf      = doc.getZip().generate({ type: 'nodebuffer' });
    const basename = path.basename(resolved, path.extname(resolved));
    const fname    = encodeURIComponent(basename + '_popunjen.docx');

    res.setHeader('Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${fname}`);
    res.send(buf);
  } catch (err) {
    console.error('[forms/fill]', err.message);
    res.status(500).json({ message: 'Greška pri popunjavanju obrasca' });
  }
});

module.exports = router;
