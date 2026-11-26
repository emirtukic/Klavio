const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif`;
const SITE = 'https://klavioclub.com';

const DEFAULT_BRANDING = {
  logo_url: `${SITE}/assets/img/favicon-192.png`,
  brand_name: 'KLAVIO',
  accent_color: '#2563eb',
  footer_tagline: 'Platforma za upravljanje fudbalskim klubom',
  footer_address: 'Sarajevo, Bosna i Hercegovina',
  footer_email: 'info@klavioclub.com',
};

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

function logoRow(branding = DEFAULT_BRANDING) {
  return `
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 28px;">
              <tr>
                <td valign="middle" style="padding-right:10px;">
                  <img src="${branding.logo_url}" alt="${escapeHtml(branding.brand_name)}" width="36" height="36" style="display:block;width:36px;height:36px;border:0;border-radius:8px;">
                </td>
                <td valign="middle">
                  <span style="font-size:19px;font-weight:800;color:#0f172a;letter-spacing:-0.3px;font-family:${FONT};">${escapeHtml(branding.brand_name)}</span>
                </td>
              </tr>
            </table>`;
}

function ctaButton(link, label, branding = DEFAULT_BRANDING) {
  const color = branding.accent_color || DEFAULT_BRANDING.accent_color;
  return `
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 24px;">
              <tr>
                <td align="center" bgcolor="${color}"
                    style="background-color:${color};border-radius:10px;">
                  <!--[if mso]>
                  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml"
                    xmlns:w="urn:schemas-microsoft-com:office:word"
                    href="${link}"
                    style="height:50px;v-text-anchor:middle;width:280px;"
                    arcsize="10%" stroke="f" fillcolor="${color}">
                    <w:anchorlock/>
                    <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">${label}</center>
                  </v:roundrect>
                  <![endif]-->
                  <!--[if !mso]><!-->
                  <a href="${link}"
                     style="display:inline-block;padding:14px 40px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;font-family:${FONT};">
                    ${label}
                  </a>
                  <!--<![endif]-->
                </td>
              </tr>
            </table>`;
}

function noteText(html) {
  return `
            <p style="margin:0 0 4px;font-size:13px;color:#94a3b8;text-align:center;font-family:${FONT};">
              ${html}
            </p>`;
}

function infoBox(title, body) {
  return `
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:28px;">
              <tr>
                <td bgcolor="#f8fafc"
                    style="background-color:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;padding:16px 20px;">
                  <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#334155;font-family:${FONT};">${title}</p>
                  <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;font-family:${FONT};">${body}</p>
                </td>
              </tr>
            </table>`;
}

function emailWrap(previewText, content, branding = DEFAULT_BRANDING) {
  return `<!DOCTYPE html>
<html lang="bs" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>${escapeHtml(branding.brand_name)}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table, td { mso-table-lspace:0; mso-table-rspace:0; }
    img { -ms-interpolation-mode:bicubic; border:0; height:auto; line-height:100%; outline:none; text-decoration:none; }
    @media only screen and (max-width:620px) {
      .card-pad { padding:32px 24px !important; }
      .heading  { font-size:22px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;">

<div style="display:none;font-size:1px;color:#f1f5f9;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${previewText}</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td bgcolor="#f1f5f9" style="background-color:#f1f5f9;padding:40px 20px 48px;">

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="560" style="max-width:560px;margin:0 auto;">
        <tr><td align="center" style="padding-bottom:28px;">
          <p style="margin:0;font-size:12px;color:#94a3b8;font-family:${FONT};">
            Ako e-mail ne prikazuje ispravno, <a href="${SITE}" style="color:#64748b;text-decoration:underline;">otvorite ga u pregledniku</a>.
          </p>
        </td></tr>
      </table>

      <!-- Card -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="560"
             style="max-width:560px;width:100%;background-color:#ffffff;border-radius:16px;box-shadow:0 4px 24px rgba(15,23,42,0.06);border:1px solid #e2e8f0;">
        <tr>
          <td class="card-pad" style="padding:40px 44px 44px;">
            ${logoRow(branding)}
            ${content}
          </td>
        </tr>
      </table>

      <!-- Footer -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="560"
             style="max-width:560px;margin:28px auto 0;">
        <tr>
          <td align="center">
            <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#334155;font-family:${FONT};">${escapeHtml(branding.brand_name)}</p>
            <p style="margin:0 0 14px;font-size:11px;color:#94a3b8;letter-spacing:0.08em;text-transform:uppercase;font-family:${FONT};">${escapeHtml(branding.footer_tagline)}</p>
            <p style="margin:0;font-size:12px;color:#94a3b8;font-family:${FONT};">
              ${escapeHtml(branding.footer_address)} &middot;
              <a href="mailto:${escapeHtml(branding.footer_email)}" style="color:#64748b;text-decoration:none;">${escapeHtml(branding.footer_email)}</a>
            </p>
            <p style="margin:12px 0 0;font-size:12px;color:#cbd5e1;font-family:${FONT};">
              &copy; 2026 ${escapeHtml(branding.brand_name)}. Sva prava zadr&#382;ana.
            </p>
          </td>
        </tr>
      </table>

    </td>
  </tr>
</table>
</body>
</html>`;
}

/* ── Internal notification - new club registered (sent to the Klavio team) ── */
function newClubNotificationHtml(clubName, clubCity, adminName, adminEmail) {
  const body = `
            <h1 class="heading" style="margin:0 0 14px;font-size:24px;font-weight:800;color:#0f172a;letter-spacing:-0.4px;line-height:1.25;text-align:center;font-family:${FONT};">
              Novi klub registrovan &#127881;
            </h1>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0;">
              <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;"><span style="font-size:13px;color:#94a3b8;font-family:${FONT};">Klub</span><br><span style="font-size:15px;color:#0f172a;font-weight:600;font-family:${FONT};">${clubName}</span></td></tr>
              <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;"><span style="font-size:13px;color:#94a3b8;font-family:${FONT};">Grad</span><br><span style="font-size:15px;color:#0f172a;font-weight:600;font-family:${FONT};">${clubCity || '-'}</span></td></tr>
              <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;"><span style="font-size:13px;color:#94a3b8;font-family:${FONT};">Administrator</span><br><span style="font-size:15px;color:#0f172a;font-weight:600;font-family:${FONT};">${adminName}</span></td></tr>
              <tr><td style="padding:8px 0;"><span style="font-size:13px;color:#94a3b8;font-family:${FONT};">E-mail</span><br><span style="font-size:15px;color:#0f172a;font-weight:600;font-family:${FONT};">${adminEmail}</span></td></tr>
            </table>`;

  return emailWrap(`Novi klub: ${clubName}`, body);
}

/* ── Internal notification - new support ticket (sent to the Klavio team) ── */
function newTicketNotificationHtml(clubName, userName, subject, body) {
  const safeSubject = escapeHtml(subject);
  const safeBody = escapeHtml(body).replace(/\n/g, '<br>');
  const bodyHtml = `
            <h1 class="heading" style="margin:0 0 14px;font-size:24px;font-weight:800;color:#0f172a;letter-spacing:-0.4px;line-height:1.25;text-align:center;font-family:${FONT};">
              Novi support tiket &#128172;
            </h1>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0;">
              <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;"><span style="font-size:13px;color:#94a3b8;font-family:${FONT};">Klub</span><br><span style="font-size:15px;color:#0f172a;font-weight:600;font-family:${FONT};">${escapeHtml(clubName)}</span></td></tr>
              <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;"><span style="font-size:13px;color:#94a3b8;font-family:${FONT};">Od</span><br><span style="font-size:15px;color:#0f172a;font-weight:600;font-family:${FONT};">${escapeHtml(userName)}</span></td></tr>
              <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;"><span style="font-size:13px;color:#94a3b8;font-family:${FONT};">Naslov</span><br><span style="font-size:15px;color:#0f172a;font-weight:600;font-family:${FONT};">${safeSubject}</span></td></tr>
            </table>
            ${infoBox('Poruka', safeBody || '-')}
            ${ctaButton(`${SITE}/pages/support-tickets/index.html`, 'Otvori tiket')}`;

  return emailWrap(`Novi tiket: ${safeSubject}`, bodyHtml);
}

module.exports = { escapeHtml, logoRow, ctaButton, noteText, infoBox, emailWrap, DEFAULT_BRANDING, newClubNotificationHtml, newTicketNotificationHtml };
