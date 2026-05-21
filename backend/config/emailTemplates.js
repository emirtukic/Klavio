const fs   = require('fs');
const path = require('path');

const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif`;

// Build a white monochrome base64 data URI from the icon SVG
const _iconPath = path.join(__dirname, '../../frontend/assets/img/klavio-icon.svg');
let _logoSrc = null;
if (fs.existsSync(_iconPath)) {
  const white = fs.readFileSync(_iconPath, 'utf8')
    .replace('.st0 { fill: #9b86f2; }', '.st0 { fill: #ffffff; }')
    .replace('.st1 { fill: #84f4d4; }', '.st1 { fill: #ffffff; }');
  _logoSrc = 'data:image/svg+xml;base64,' + Buffer.from(white).toString('base64');
}

// viewBox="55 190 370 120" → aspect ratio 370:120
function logoImg(w, h) {
  return _logoSrc
    ? `<img src="${_logoSrc}" alt="Klavio" width="${w}" height="${h}" style="display:block;width:${w}px;height:${h}px;border:0;">`
    : `<span style="font-size:20px;font-weight:900;color:#ffffff;font-family:Arial,sans-serif;letter-spacing:-0.5px;">KLAVIO</span>`;
}

function ctaButton(link, label) {
  return `
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 20px;">
              <tr>
                <td align="center" bgcolor="#2563eb"
                    style="background-color:#2563eb;border-radius:12px;">
                  <!--[if mso]>
                  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml"
                    xmlns:w="urn:schemas-microsoft-com:office:word"
                    href="${link}"
                    style="height:54px;v-text-anchor:middle;width:300px;"
                    arcsize="14%" stroke="f" fillcolor="#2563eb">
                    <w:anchorlock/>
                    <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">${label}</center>
                  </v:roundrect>
                  <![endif]-->
                  <!--[if !mso]><!-->
                  <a href="${link}"
                     style="display:inline-block;padding:16px 52px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.4px;border-radius:12px;font-family:${FONT};">
                    &#9993;&nbsp;&nbsp;${label}&nbsp;&nbsp;&#8594;
                  </a>
                  <!--<![endif]-->
                </td>
              </tr>
            </table>`;
}

function lockNote(html) {
  return `
            <p style="margin:0 0 28px;font-size:13px;color:#64748b;text-align:center;font-family:${FONT};">
              &#128274;&nbsp;&nbsp;${html}
            </p>`;
}

function infoBox(title, body) {
  return `
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td bgcolor="#0d1525"
                    style="background-color:#0d1525;border-radius:12px;border:1px solid #1e293b;padding:18px 22px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td width="28" valign="top" style="padding-right:12px;padding-top:1px;">
                        <span style="font-size:17px;line-height:1;">&#8505;</span>
                      </td>
                      <td>
                        <p style="margin:0 0 5px;font-size:13px;font-weight:700;color:#e2e8f0;font-family:${FONT};">${title}</p>
                        <p style="margin:0;font-size:13px;color:#64748b;line-height:1.65;font-family:${FONT};">${body}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>`;
}

function emailWrap(previewText, content) {
  return `<!DOCTYPE html>
<html lang="bs" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>Klavio</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table, td { mso-table-lspace:0; mso-table-rspace:0; }
    img { -ms-interpolation-mode:bicubic; border:0; height:auto; line-height:100%; outline:none; text-decoration:none; }
    @media only screen and (max-width:620px) {
      .card-pad { padding:32px 24px !important; }
      .heading  { font-size:24px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#07101e;">

<!-- Preview text -->
<div style="display:none;font-size:1px;color:#07101e;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${previewText}</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td bgcolor="#07101e" style="background-color:#07101e;padding:36px 20px 48px;">

      <!-- View in browser -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="600" style="max-width:600px;margin:0 auto 24px;">
        <tr><td align="center">
          <p style="margin:0;font-size:12px;color:#374151;font-family:${FONT};">
            Ako e-mail ne prikazuje ispravno,
            <a href="https://klavio.app" style="color:#4b5563;text-decoration:underline;">otvorite ga u pregledniku</a>.
          </p>
        </td></tr>
      </table>

      <!-- Tagline -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="600" style="max-width:600px;margin:0 auto 32px;">
        <tr><td align="center">
          <p style="margin:0;font-size:14px;font-weight:700;color:#e2e8f0;letter-spacing:0.05em;font-family:${FONT};">
            KLAVIO
          </p>
          <p style="margin:4px 0 0;font-size:10px;font-weight:600;color:#374151;letter-spacing:0.18em;text-transform:uppercase;font-family:${FONT};">
            Platforma za upravljanje fudbalskim klubom
          </p>
        </td></tr>
      </table>

      <!-- Card -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="600"
             style="max-width:600px;width:100%;background-color:#0f172a;border-radius:20px;border:1px solid #1e293b;">
        <tr>
          <td class="card-pad" style="padding:44px 52px 48px;">
            ${content}
          </td>
        </tr>
      </table>

      <!-- Footer -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="600"
             style="max-width:600px;margin:28px auto 0;">
        <tr>
          <td style="padding:0;">

            <!-- Footer brand row -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td valign="middle">
                  <p style="margin:0;font-size:13px;font-weight:700;color:#e2e8f0;font-family:${FONT};">KLAVIO</p>
                  <p style="margin:3px 0 0;font-size:9px;color:#1f2937;letter-spacing:0.14em;text-transform:uppercase;font-family:${FONT};">Platforma za upravljanje fudbalskim klubom</p>
                </td>
                <td align="right" valign="middle">
                  <a href="https://klavio.app"
                     style="display:inline-block;margin-left:8px;text-decoration:none;color:#4b5563;font-size:17px;line-height:1;">&#127760;</a>
                  <a href="https://www.instagram.com/klavio_app/"
                     style="display:inline-block;margin-left:10px;text-decoration:none;color:#4b5563;font-size:17px;line-height:1;">&#128247;</a>
                  <a href="https://www.facebook.com/people/Klavio/61590365125679/"
                     style="display:inline-block;margin-left:10px;text-decoration:none;color:#4b5563;font-size:17px;line-height:1;">&#128441;</a>
                </td>
              </tr>
            </table>

            <!-- Divider -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:20px;">
              <tr><td style="border-top:1px solid #111827;font-size:0;line-height:0;">&nbsp;</td></tr>
            </table>

            <!-- Copyright -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:16px;">
              <tr><td align="center">
                <p style="margin:0;font-size:12px;color:#374151;font-family:${FONT};">
                  &copy; 2026 Klavio. Sva prava zadr&#382;ana.
                </p>
              </td></tr>
            </table>

          </td>
        </tr>
      </table>

    </td>
  </tr>
</table>
</body>
</html>`;
}

/* ── 1. Email verification (club self-registration) ── */
function verifyEmailHtml(adminName, clubName, link) {
  const body = `
            <!-- Badge -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
              <tr>
                <td bgcolor="#1e293b"
                    style="background-color:#1e293b;border-radius:100px;border:1px solid #334155;padding:7px 18px;">
                  <span style="font-size:11px;font-weight:700;color:#e2e8f0;letter-spacing:0.12em;text-transform:uppercase;font-family:${FONT};">
                    &#128737;&nbsp;&nbsp;Potvrda e-mail adrese
                  </span>
                </td>
              </tr>
            </table>

            <!-- Heading -->
            <h1 class="heading"
                style="margin:0 0 18px;font-size:30px;font-weight:800;color:#f1f5f9;letter-spacing:-0.5px;line-height:1.2;font-family:${FONT};">
              Potvrdite svoju<br>
              <span style="color:#3b82f6;">e-mail</span> adresu
            </h1>

            <!-- Blue dot divider -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
              <tr>
                <td width="8" height="8" bgcolor="#3b82f6"
                    style="background-color:#3b82f6;border-radius:50%;font-size:0;line-height:0;">&nbsp;&nbsp;</td>
              </tr>
            </table>

            <!-- Welcome -->
            <p style="margin:0 0 16px;font-size:18px;font-weight:600;color:#f1f5f9;font-family:${FONT};">
              Dobro&#273;o&#353;li, <span style="color:#f97316;">${clubName}</span>!
            </p>

            <!-- Body text -->
            <p style="margin:0 0 8px;font-size:15px;color:#94a3b8;line-height:1.7;font-family:${FONT};">
              Va&#353; klub je uspje&#353;no kreiran na Klavio platformi.
            </p>
            <p style="margin:0 0 36px;font-size:15px;color:#94a3b8;line-height:1.7;font-family:${FONT};">
              Potvrdite e-mail adresu kako biste aktivirali ra&#269;un i po&#269;eli upravljati klubom.
            </p>

            ${ctaButton(link, 'Aktiviraj ra&#269;un')}
            ${lockNote('Link vrijedi <strong style="color:#e2e8f0;">24 sata</strong> iz sigurnosnih razloga.')}
            ${infoBox(
              'Niste kreirali ra&#269;un?',
              'Ako niste registrirali klub na Klavio platformi, slobodno ignori&#353;ite ovaj e-mail.'
            )}`;

  return emailWrap(`Potvrdite e-mail adresu za ${clubName}`, body);
}

/* ── 2. Invite / set-password (admin adds coach or member) ── */
function inviteEmailHtml(name, role, clubName, link) {
  const features = [
    { icon: '&#128197;', text: 'Rasporedu treninga'           },
    { icon: '&#128202;', text: 'Statistikama igra&#269;a'     },
    { icon: '&#9917;',   text: 'Me&#269;evima i rezultatima'  },
    { icon: '&#128101;', text: 'Administraciji kluba'         },
  ];

  const featureRows = features.map(f => `
                    <tr>
                      <td width="40" valign="middle" style="padding-bottom:18px;font-size:20px;line-height:1;">${f.icon}</td>
                      <td valign="middle" style="padding-bottom:18px;">
                        <p style="margin:0;font-size:15px;color:#e2e8f0;font-family:${FONT};">${f.text}</p>
                      </td>
                    </tr>`).join('');

  const body = `
            <!-- Badge -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
              <tr>
                <td bgcolor="#1e3a5f"
                    style="background-color:#1e3a5f;border-radius:100px;border:1px solid #2563eb;padding:8px 22px;">
                  <span style="font-size:11px;font-weight:700;color:#93c5fd;letter-spacing:0.14em;text-transform:uppercase;font-family:${FONT};">
                    Poziv u klub
                  </span>
                </td>
              </tr>
            </table>

            <!-- Heading -->
            <h1 class="heading"
                style="margin:0 0 18px;font-size:32px;font-weight:800;color:#f1f5f9;letter-spacing:-0.5px;line-height:1.2;font-family:${FONT};">
              Pozvani ste u klub<br>
              <span style="color:#3b82f6;">${clubName}</span>
            </h1>

            <!-- Blue dot divider -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
              <tr>
                <td width="8" height="8" bgcolor="#3b82f6"
                    style="background-color:#3b82f6;border-radius:50%;font-size:0;line-height:0;">&nbsp;&nbsp;</td>
              </tr>
            </table>

            <!-- Intro text -->
            <p style="margin:0 0 28px;font-size:15px;color:#94a3b8;line-height:1.7;text-align:center;font-family:${FONT};">
              Administrator vas je pozvao da se pridru&#382;ite klubu<br>na Klavio platformi.
            </p>

            <!-- Features -->
            <p style="margin:0 0 16px;font-size:14px;font-weight:700;color:#f1f5f9;font-family:${FONT};">
              Nakon prihvatanja poziva mo&#263;i &#263;ete pristupiti:
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:32px;">
              ${featureRows}
            </table>

            ${ctaButton(link, '&#9745;&nbsp;&nbsp;PRIHVATI POZIV')}

            <!-- Expiry -->
            <p style="margin:0 0 32px;font-size:13px;color:#64748b;text-align:center;font-family:${FONT};">
              Pozivnica isti&#269;e za <span style="color:#3b82f6;font-weight:600;">7 dana</span>.
            </p>

            <!-- Support -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="border-top:1px solid #1e293b;padding-top:24px;text-align:center;">
                  <p style="margin:0 0 6px;font-size:13px;color:#64748b;font-family:${FONT};">
                    Ako imate pitanja, slobodno nam se javite.
                  </p>
                  <p style="margin:0;font-size:13px;color:#64748b;font-family:${FONT};">
                    Podr&#353;ka:&nbsp;
                    <a href="mailto:klavio.app@gmail.com"
                       style="color:#3b82f6;text-decoration:none;font-weight:600;">klavio.app@gmail.com</a>
                  </p>
                </td>
              </tr>
            </table>`;

  return emailWrap(`Pozvani ste u ${clubName} na Klavio`, body);
}

module.exports = { verifyEmailHtml, inviteEmailHtml };
