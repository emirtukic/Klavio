const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif`;
const SITE = 'https://klavioclub.com';
const LOGO_URL = `${SITE}/assets/img/favicon-192.png`;

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

function logoRow() {
  return `
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 28px;">
              <tr>
                <td valign="middle" style="padding-right:10px;">
                  <img src="${LOGO_URL}" alt="Klavio" width="36" height="36" style="display:block;width:36px;height:36px;border:0;border-radius:8px;">
                </td>
                <td valign="middle">
                  <span style="font-size:19px;font-weight:800;color:#0f172a;letter-spacing:-0.3px;font-family:${FONT};">KLAVIO</span>
                </td>
              </tr>
            </table>`;
}

function ctaButton(link, label) {
  return `
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 24px;">
              <tr>
                <td align="center" bgcolor="#2563eb"
                    style="background-color:#2563eb;border-radius:10px;">
                  <!--[if mso]>
                  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml"
                    xmlns:w="urn:schemas-microsoft-com:office:word"
                    href="${link}"
                    style="height:50px;v-text-anchor:middle;width:280px;"
                    arcsize="10%" stroke="f" fillcolor="#2563eb">
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
            ${logoRow()}
            ${content}
          </td>
        </tr>
      </table>

      <!-- Footer -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="560"
             style="max-width:560px;margin:28px auto 0;">
        <tr>
          <td align="center">
            <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#334155;font-family:${FONT};">KLAVIO</p>
            <p style="margin:0 0 14px;font-size:11px;color:#94a3b8;letter-spacing:0.08em;text-transform:uppercase;font-family:${FONT};">Platforma za upravljanje fudbalskim klubom</p>
            <p style="margin:0;font-size:12px;color:#94a3b8;font-family:${FONT};">
              Sarajevo, Bosna i Hercegovina &middot;
              <a href="mailto:info@klavioclub.com" style="color:#64748b;text-decoration:none;">info@klavioclub.com</a>
            </p>
            <p style="margin:12px 0 0;font-size:12px;color:#cbd5e1;font-family:${FONT};">
              &copy; 2026 Klavio. Sva prava zadr&#382;ana.
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

/* ── 1. Email verification (club self-registration) ── */
function verifyEmailHtml(adminName, clubName, link) {
  const body = `
            <h1 class="heading" style="margin:0 0 14px;font-size:26px;font-weight:800;color:#0f172a;letter-spacing:-0.4px;line-height:1.25;text-align:center;font-family:${FONT};">
              Potvrdite svoju e-mail adresu
            </h1>
            <p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.7;text-align:center;font-family:${FONT};">
              Dobro&#273;o&#353;li, <strong style="color:#0f172a;">${clubName}</strong>! Va&#353; klub je uspje&#353;no kreiran na Klavio platformi.
              Potvrdite e-mail adresu kako biste aktivirali ra&#269;un i po&#269;eli upravljati klubom.
            </p>
            ${ctaButton(link, 'Aktiviraj ra&#269;un')}
            ${noteText('Link vrijedi <strong style="color:#475569;">24 sata</strong> iz sigurnosnih razloga.')}
            ${infoBox('Niste kreirali ra&#269;un?', 'Ako niste registrirali klub na Klavio platformi, slobodno ignori&#353;ite ovaj e-mail.')}`;

  return emailWrap(`Potvrdite e-mail adresu za ${clubName}`, body);
}

/* ── 2. Welcome (sent right after successful e-mail verification) ── */
function welcomeEmailHtml(adminName, clubName) {
  const items = [
    'Dodajte &#269;lanove, trenere i selekcije kluba',
    'Zaka&#382;ite treninge i pratite prisustvo',
    'Pratite utakmice u realnom vremenu',
    'Upravljajte finansijama i &#269;lanarinama',
  ];
  const itemRows = items.map(t => `
                    <tr>
                      <td width="22" valign="top" style="padding-bottom:12px;color:#2563eb;font-weight:700;font-size:14px;">&#10003;</td>
                      <td valign="top" style="padding-bottom:12px;">
                        <p style="margin:0;font-size:14px;color:#334155;line-height:1.5;font-family:${FONT};">${t}</p>
                      </td>
                    </tr>`).join('');

  const body = `
            <h1 class="heading" style="margin:0 0 14px;font-size:26px;font-weight:800;color:#0f172a;letter-spacing:-0.4px;line-height:1.25;text-align:center;font-family:${FONT};">
              Dobro&#273;o&#353;li u Klavio, ${adminName}!
            </h1>
            <p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.7;text-align:center;font-family:${FONT};">
              Va&#353; nalog je aktiviran i klub <strong style="color:#0f172a;">${clubName}</strong> je spreman za upravljanje. Evo &#353;ta mo&#382;ete uraditi odmah:
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:8px;">
              ${itemRows}
            </table>
            ${ctaButton(`${SITE}/app/`, 'Otvori Klavio')}`;

  return emailWrap(`Dobrodošli u Klavio, ${clubName} je spreman`, body);
}

/* ── 3. Invite / set-password (admin adds coach or member) ── */
function inviteEmailHtml(name, role, clubName, link) {
  const ROLE_LABEL = { coach: 'trener', member: '&#269;lan', admin: 'administrator' };
  const roleLabel = ROLE_LABEL[role] || role;

  const body = `
            <h1 class="heading" style="margin:0 0 14px;font-size:26px;font-weight:800;color:#0f172a;letter-spacing:-0.4px;line-height:1.25;text-align:center;font-family:${FONT};">
              Pozvani ste u klub ${clubName}
            </h1>
            <p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.7;text-align:center;font-family:${FONT};">
              Pozdrav ${name}, administrator kluba <strong style="color:#0f172a;">${clubName}</strong> je kreirao va&#353; nalog kao <strong style="color:#0f172a;">${roleLabel}</strong> na Klavio platformi. Postavite lozinku da aktivirate nalog.
            </p>
            ${ctaButton(link, 'Postavi lozinku')}
            ${noteText('Pozivnica isti&#269;e za <strong style="color:#475569;">7 dana</strong>.')}
            ${infoBox('Imate pitanja?', 'Javite se administratoru va&#353;eg kluba ili nam pi&#353;ite na <a href="mailto:info@klavioclub.com" style="color:#2563eb;text-decoration:none;">info@klavioclub.com</a>.')}`;

  return emailWrap(`Pozvani ste u ${clubName} na Klavio`, body);
}

/* ── 4. Password reset ── */
function resetPasswordEmailHtml(name, link) {
  const body = `
            <h1 class="heading" style="margin:0 0 14px;font-size:26px;font-weight:800;color:#0f172a;letter-spacing:-0.4px;line-height:1.25;text-align:center;font-family:${FONT};">
              Resetovanje lozinke
            </h1>
            <p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.7;text-align:center;font-family:${FONT};">
              Pozdrav ${name}, zatra&#382;eno je resetovanje lozinke za va&#353; Klavio nalog. Kliknite na dugme ispod da postavite novu lozinku.
            </p>
            ${ctaButton(link, 'Resetuj lozinku')}
            ${noteText('Link va&#382;i <strong style="color:#475569;">1 sat</strong>.')}
            ${infoBox('Niste tra&#382;ili reset?', 'Ako niste zatra&#382;ili resetovanje lozinke, slobodno ignori&#353;ite ovaj e-mail - va&#353; nalog je i dalje siguran.')}`;

  return emailWrap('Resetovanje lozinke za vaš Klavio nalog', body);
}

/* ── 5. Internal notification - new club registered (sent to the Klavio team) ── */
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

/* ── 6. Internal notification - new support ticket (sent to the Klavio team) ── */
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

/* ── 7. Reply to support ticket (sent to the club admin who opened it) ── */
function ticketReplyEmailHtml(userName, subject, body) {
  const safeSubject = escapeHtml(subject);
  const safeBody = escapeHtml(body).replace(/\n/g, '<br>');
  const bodyHtml = `
            <h1 class="heading" style="margin:0 0 14px;font-size:26px;font-weight:800;color:#0f172a;letter-spacing:-0.4px;line-height:1.25;text-align:center;font-family:${FONT};">
              Odgovor na va&#353; upit
            </h1>
            <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.7;text-align:center;font-family:${FONT};">
              Pozdrav ${escapeHtml(userName)}, stigao je odgovor na va&#353; tiket <strong style="color:#0f172a;">"${safeSubject}"</strong>.
            </p>
            ${infoBox('Odgovor Klavio tima', safeBody)}
            ${ctaButton(`${SITE}/pages/support/index.html`, 'Pogledaj u aplikaciji')}`;

  return emailWrap(`Odgovor na vaš tiket: ${safeSubject}`, bodyHtml);
}

/* ── 8. Membership fee reminder ── */
function feeReminderEmailHtml(name, clubName, amount, dueDateStr, isOverdue) {
  const amountStr = Number(amount).toFixed(2);
  const heading = isOverdue ? 'Članarina je zakašnjela' : 'Rok za uplatu članarine uskoro dospijeva';
  const intro = isOverdue
    ? `Pozdrav ${escapeHtml(name)}, va&scaron;a &#269;lanarina u klubu <strong style="color:#0f172a;">${escapeHtml(clubName)}</strong> nije upla&#263;ena na vrijeme.`
    : `Pozdrav ${escapeHtml(name)}, u klubu <strong style="color:#0f172a;">${escapeHtml(clubName)}</strong> rok za uplatu &#269;lanarine uskoro dospijeva.`;

  const bodyHtml = `
            <h1 class="heading" style="margin:0 0 14px;font-size:26px;font-weight:800;color:${isOverdue ? '#b91c1c' : '#0f172a'};letter-spacing:-0.4px;line-height:1.25;text-align:center;font-family:${FONT};">
              ${heading}
            </h1>
            <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.7;text-align:center;font-family:${FONT};">
              ${intro}
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px;">
              <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;"><span style="font-size:13px;color:#94a3b8;font-family:${FONT};">Iznos</span><br><span style="font-size:15px;color:#0f172a;font-weight:600;font-family:${FONT};">${amountStr} KM</span></td></tr>
              <tr><td style="padding:8px 0;"><span style="font-size:13px;color:#94a3b8;font-family:${FONT};">Rok uplate</span><br><span style="font-size:15px;color:${isOverdue ? '#b91c1c' : '#0f172a'};font-weight:600;font-family:${FONT};">${escapeHtml(dueDateStr)}</span></td></tr>
            </table>
            ${ctaButton(`${SITE}/pages/my-fees/index.html`, 'Pogledaj članarinu')}`;

  return emailWrap(`${heading} - ${amountStr} KM`, bodyHtml);
}

module.exports = { verifyEmailHtml, welcomeEmailHtml, inviteEmailHtml, resetPasswordEmailHtml, newClubNotificationHtml, newTicketNotificationHtml, ticketReplyEmailHtml, feeReminderEmailHtml };
