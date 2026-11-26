const db = require('../config/db');
const { send: sendMail } = require('../config/mailer');
const { escapeHtml, ctaButton, noteText, infoBox, emailWrap } = require('../config/emailTemplates');
const { DEFAULTS, TEMPLATE_KEYS, SAMPLE_VARS, SAMPLE_ROWS, getBranding, renderPlaceholders } = require('../config/emailTemplateStore');

exports.getBranding = async (req, res) => {
  try {
    res.json(await getBranding());
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.updateBranding = async (req, res) => {
  const { logo_url, brand_name, accent_color, footer_tagline, footer_address, footer_email } = req.body;
  try {
    await db.query(`
      INSERT INTO email_branding (id, logo_url, brand_name, accent_color, footer_tagline, footer_address, footer_email)
      VALUES (1, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE logo_url=VALUES(logo_url), brand_name=VALUES(brand_name), accent_color=VALUES(accent_color),
        footer_tagline=VALUES(footer_tagline), footer_address=VALUES(footer_address), footer_email=VALUES(footer_email)
    `, [logo_url, brand_name, accent_color, footer_tagline, footer_address, footer_email]);
    res.json({ message: 'Brending sačuvan' });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.listTemplates = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM email_templates');
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.updateTemplate = async (req, res) => {
  const key = req.params.key;
  if (!TEMPLATE_KEYS.includes(key)) return res.status(404).json({ message: 'Nepoznat email template' });
  const { subject, heading, intro_text, secondary_note, info_title, info_body, button_label, enabled } = req.body;
  try {
    await db.query(`
      UPDATE email_templates SET subject=?, heading=?, intro_text=?, secondary_note=?, info_title=?, info_body=?, button_label=?, enabled=?
      WHERE template_key=?
    `, [subject, heading, intro_text || null, secondary_note || null, info_title || null, info_body || null, button_label, enabled ? 1 : 0, key]);
    res.json({ message: 'Email sačuvan' });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.resetTemplate = async (req, res) => {
  const key = req.params.key;
  const d = DEFAULTS[key];
  if (!d) return res.status(404).json({ message: 'Nepoznat email template' });
  try {
    await db.query(`
      UPDATE email_templates SET subject=?, heading=?, intro_text=?, secondary_note=?, info_title=?, info_body=?, button_label=?, enabled=?
      WHERE template_key=?
    `, [d.subject, d.heading, d.intro_text || null, d.secondary_note || null, d.info_title || null, d.info_body || null, d.button_label, d.enabled, key]);
    const [[row]] = await db.query('SELECT * FROM email_templates WHERE template_key=?', [key]);
    res.json(row);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

// Sends using the UNSAVED form values straight from the request body, with
// hardcoded sample placeholder data - bypasses both `enabled` and the saved
// DB row, so the admin can preview an edit before committing to it.
exports.sendTest = async (req, res) => {
  const key = req.params.key;
  if (!TEMPLATE_KEYS.includes(key)) return res.status(404).json({ message: 'Nepoznat email template' });
  const { to, subject, heading, intro_text, secondary_note, info_title, info_body, button_label } = req.body;
  if (!to) return res.status(400).json({ message: 'Email adresa je obavezna' });
  try {
    const vars = { ...(SAMPLE_VARS[key] || {}), __link: 'https://klavioclub.com/app/' };
    const branding = await getBranding();

    const renderedSubject = renderPlaceholders(subject, vars);
    const renderedHeading = renderPlaceholders(heading, vars);
    const renderedIntro = intro_text ? renderPlaceholders(intro_text, vars).replace(/\n/g, '<br>') : null;
    const renderedNote = secondary_note ? renderPlaceholders(secondary_note, vars) : null;
    const renderedInfoTitle = info_title ? renderPlaceholders(info_title, vars) : null;
    const renderedInfoBody = info_body ? renderPlaceholders(info_body, vars).replace(/\n/g, '<br>') : null;
    const renderedButton = renderPlaceholders(button_label, vars);

    const detailRows = SAMPLE_ROWS[key] || null;
    const rowsHtml = (detailRows && detailRows.length) ? `
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0;">
              ${detailRows.map(([label, value]) => `
              <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;"><span style="font-size:13px;color:#94a3b8;">${escapeHtml(label)}</span><br><span style="font-size:15px;color:#0f172a;font-weight:600;">${escapeHtml(String(value))}</span></td></tr>`).join('')}
            </table>` : '';

    const bodyHtml = `
            <h1 class="heading" style="margin:0 0 14px;font-size:26px;font-weight:800;color:#0f172a;letter-spacing:-0.4px;line-height:1.25;text-align:center;">
              ${renderedHeading}
            </h1>
            ${renderedIntro ? `<p style="margin:0 0 8px;font-size:15px;color:#475569;line-height:1.7;text-align:center;">${renderedIntro}</p>` : ''}
            ${rowsHtml}
            ${ctaButton(vars.__link, renderedButton, branding)}
            ${renderedNote ? noteText(renderedNote) : ''}
            ${renderedInfoTitle ? infoBox(renderedInfoTitle, renderedInfoBody || '', branding) : ''}`;

    const html = emailWrap(renderedHeading, bodyHtml, branding);
    await sendMail({ to, subject: `[TEST] ${renderedSubject}`, html });
    res.json({ message: 'Testni e-mail poslan' });
  } catch (err) {
    console.error('sendTest error:', err.message);
    res.status(500).json({ message: 'Slanje nije uspjelo: ' + err.message });
  }
};
