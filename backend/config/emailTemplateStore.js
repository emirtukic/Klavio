const db = require('../config/db');
const { escapeHtml, ctaButton, noteText, infoBox, emailWrap, DEFAULT_BRANDING } = require('./emailTemplates');

const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// Single source of truth for every editable email's starting wording -
// used both to seed the DB migration and to power "reset to default" in the
// super-admin editor, so the two can never drift apart.
const DEFAULTS = {
  verify_email: {
    subject: 'Potvrdite vašu e-mail adresu – Klavio',
    heading: 'Potvrdite svoju e-mail adresu',
    intro_text: 'Dobrodošli, {{klub}}! Vaš klub je uspješno kreiran na Klavio platformi. Potvrdite e-mail adresu kako biste aktivirali račun i počeli upravljati klubom.',
    secondary_note: 'Link vrijedi 24 sata iz sigurnosnih razloga.',
    info_title: 'Niste kreirali račun?',
    info_body: 'Ako niste registrirali klub na Klavio platformi, slobodno ignorišite ovaj e-mail.',
    button_label: 'Aktiviraj račun',
    enabled: 1,
    always_send: 1,
  },
  welcome: {
    subject: 'Dobrodošli u Klavio, {{klub}} je spreman',
    heading: 'Dobrodošli u Klavio, {{ime}}!',
    intro_text: 'Vaš nalog je aktiviran i klub {{klub}} je spreman za upravljanje. Evo šta možete uraditi odmah:\n✓ Dodajte članove, trenere i selekcije kluba\n✓ Zakažite treninge i pratite prisustvo\n✓ Pratite utakmice u realnom vremenu\n✓ Upravljajte finansijama i članarinama',
    secondary_note: null,
    info_title: null,
    info_body: null,
    button_label: 'Otvori Klavio',
    enabled: 1,
    always_send: 0,
  },
  invite: {
    subject: 'Pozvani ste u {{klub}} na Klavio',
    heading: 'Pozvani ste u klub {{klub}}',
    intro_text: 'Pozdrav {{ime}}, administrator kluba {{klub}} je kreirao vaš nalog kao {{uloga}} na Klavio platformi. Postavite lozinku da aktivirate nalog.',
    secondary_note: 'Pozivnica ističe za 7 dana.',
    info_title: 'Imate pitanja?',
    info_body: 'Javite se administratoru vašeg kluba ili nam pišite na info@klavioclub.com.',
    button_label: 'Postavi lozinku',
    enabled: 1,
    always_send: 1,
  },
  reset_password: {
    subject: 'Resetovanje lozinke – Klavio',
    heading: 'Resetovanje lozinke',
    intro_text: 'Pozdrav {{ime}}, zatraženo je resetovanje lozinke za vaš Klavio nalog. Kliknite na dugme ispod da postavite novu lozinku.',
    secondary_note: 'Link važi 1 sat.',
    info_title: 'Niste tražili reset?',
    info_body: 'Ako niste zatražili resetovanje lozinke, slobodno ignorišite ovaj e-mail - vaš nalog je i dalje siguran.',
    button_label: 'Resetuj lozinku',
    enabled: 1,
    always_send: 1,
  },
  fee_reminder_upcoming: {
    subject: 'Rok za uplatu članarine uskoro dospijeva',
    heading: 'Rok za uplatu članarine uskoro dospijeva',
    intro_text: 'Pozdrav {{ime}}, u klubu {{klub}} rok za uplatu članarine uskoro dospijeva.',
    secondary_note: null, info_title: null, info_body: null,
    button_label: 'Pogledaj članarinu',
    enabled: 1, always_send: 0,
  },
  fee_reminder_overdue: {
    subject: 'Članarina je zakašnjela',
    heading: 'Članarina je zakašnjela',
    intro_text: 'Pozdrav {{ime}}, vaša članarina u klubu {{klub}} nije uplaćena na vrijeme.',
    secondary_note: null, info_title: null, info_body: null,
    button_label: 'Pogledaj članarinu',
    enabled: 1, always_send: 0,
  },
  fee_created: {
    subject: 'Nova članarina',
    heading: 'Nova članarina',
    intro_text: 'Dodana vam je nova članarina od {{iznos}} KM (rok uplate: {{rok}}).',
    secondary_note: null, info_title: null, info_body: null,
    button_label: 'Pogledaj članarinu',
    enabled: 1, always_send: 0,
  },
  fee_paid: {
    subject: 'Članarina označena kao plaćena',
    heading: 'Članarina označena kao plaćena',
    intro_text: 'Vaša članarina od {{iznos}} KM je označena kao plaćena.',
    secondary_note: null, info_title: null, info_body: null,
    button_label: 'Pogledaj članarinu',
    enabled: 1, always_send: 0,
  },
  ticket_reply: {
    subject: 'Odgovor na vaš tiket: {{naslov}}',
    heading: 'Odgovor na vaš upit',
    intro_text: 'Pozdrav {{ime}}, stigao je odgovor na vaš tiket "{{naslov}}".',
    secondary_note: null,
    info_title: 'Odgovor Klavio tima',
    info_body: '{{odgovor}}',
    button_label: 'Pogledaj u aplikaciji',
    enabled: 1, always_send: 0,
  },
  match_created: {
    subject: 'Nova utakmica zakazana',
    heading: 'Nova utakmica zakazana',
    intro_text: null,
    secondary_note: null, info_title: null, info_body: null,
    button_label: 'Pogledaj raspored',
    enabled: 1, always_send: 0,
  },
  training_created: {
    subject: 'Novi trening zakazan',
    heading: 'Novi trening zakazan',
    intro_text: null,
    secondary_note: null, info_title: null, info_body: null,
    button_label: 'Pogledaj raspored',
    enabled: 1, always_send: 0,
  },
  match_day_before: {
    subject: 'Utakmica sutra vs {{protivnik}}',
    heading: 'Utakmica sutra - podsjetnik',
    intro_text: 'Utakmica {{selekcija}} vs {{protivnik}} je sutra ({{datum}}).',
    secondary_note: null, info_title: null, info_body: null,
    button_label: 'Pogledaj detalje',
    enabled: 1, always_send: 0,
  },
  rsvp_decline: {
    subject: 'Otkazano prisustvo',
    heading: 'Otkazano prisustvo',
    intro_text: '{{ime}} neće doći na {{sta}} ({{datum}}). Razlog: {{razlog}}',
    secondary_note: null, info_title: null, info_body: null,
    button_label: 'Otvori',
    enabled: 1, always_send: 0,
  },
  lineup_reminder: {
    subject: 'Postava nije unesena - vs {{protivnik}}',
    heading: 'Postava nije unesena',
    intro_text: 'Utakmica vs {{protivnik}} ({{datum}}) počinje uskoro, a postava još nije unesena.',
    secondary_note: null, info_title: null, info_body: null,
    button_label: 'Otvori',
    enabled: 1, always_send: 0,
  },
  result_reminder_2h: {
    subject: 'Unesi rezultat - vs {{protivnik}}',
    heading: 'Unesi rezultat utakmice',
    intro_text: 'Utakmica vs {{protivnik}} ({{datum}}) je odigrana, a rezultat još nije unesen.',
    secondary_note: null, info_title: null, info_body: null,
    button_label: 'Otvori',
    enabled: 1, always_send: 0,
  },
  result_reminder_1d: {
    subject: 'Podsjetnik: rezultat i dalje nije unesen - vs {{protivnik}}',
    heading: 'Rezultat utakmice i dalje nije unesen',
    intro_text: 'Prošao je dan od utakmice vs {{protivnik}} ({{datum}}), a rezultat, strijelci i statistika i dalje nisu uneseni.',
    secondary_note: null, info_title: null, info_body: null,
    button_label: 'Otvori',
    enabled: 1, always_send: 0,
  },
  appointment_created: {
    subject: 'Novi termin zakazan',
    heading: 'Novi termin zakazan',
    intro_text: 'Termin "{{naziv}}" sa {{osoba}} - {{datum}}',
    secondary_note: null, info_title: null, info_body: null,
    button_label: 'Pogledaj termin',
    enabled: 1, always_send: 0,
  },
  tournament_invite: {
    subject: 'Pozvani ste na turnir {{turnir}}',
    heading: 'Pozvani ste na turnir',
    intro_text: 'Pozdrav {{ime}}, pozvani ste da učestvujete na turniru "{{turnir}}" sa selekcijom {{selekcija}} ({{datum_od}} - {{datum_do}}, {{lokacija}}). Potvrdite dolazak.',
    secondary_note: null, info_title: null, info_body: null,
    button_label: 'Potvrdi dolazak',
    enabled: 1, always_send: 0,
  },
  tournament_fee_created: {
    subject: 'Kotizacija za turnir {{turnir}}',
    heading: 'Kotizacija za turnir',
    intro_text: 'Kotizacija za turnir "{{turnir}}" iznosi {{iznos}} KM.',
    secondary_note: null, info_title: null, info_body: null,
    button_label: 'Pogledaj turnir',
    enabled: 1, always_send: 0,
  },
  tournament_fee_paid: {
    subject: 'Kotizacija plaćena - {{turnir}}',
    heading: 'Kotizacija plaćena',
    intro_text: 'Vaša kotizacija od {{iznos}} KM za turnir "{{turnir}}" je zabilježena kao plaćena.',
    secondary_note: null, info_title: null, info_body: null,
    button_label: 'Pogledaj turnir',
    enabled: 1, always_send: 0,
  },
};

const TEMPLATE_KEYS = Object.keys(DEFAULTS);

// Sample data for the "Pošalji test" button - independent of any real data,
// just needs to look plausible for a human reviewing the rendered email.
const SAMPLE_VARS = {
  verify_email: { ime: 'Emir', klub: 'FK Test' },
  welcome: { ime: 'Emir', klub: 'FK Test' },
  invite: { ime: 'Emir', klub: 'FK Test', uloga: 'trener' },
  reset_password: { ime: 'Emir' },
  fee_reminder_upcoming: { ime: 'Emir', klub: 'FK Test', iznos: '50', rok: '25.12.2026.' },
  fee_reminder_overdue: { ime: 'Emir', klub: 'FK Test', iznos: '50', rok: '10.11.2026.' },
  fee_created: { iznos: '50', rok: '25.12.2026.' },
  fee_paid: { iznos: '50', datum: '26.11.2026.' },
  ticket_reply: { ime: 'Emir', naslov: 'Pitanje o članarinama', odgovor: 'Ovo je primjer odgovora na vaš upit.' },
  match_created: { protivnik: 'Hajduk', datum: '24.12.2026. 18:00', lokacija: 'Gradski stadion' },
  training_created: { selekcija: 'Kadeti', naziv: 'Večernji trening', datum: '24.12.2026. 18:00', lokacija: 'Teren 1', opis: 'Taktički trening' },
  match_day_before: { protivnik: 'Hajduk', datum: '24.12.2026. 18:00', lokacija: 'Gradski stadion', domacin_gost: 'Domaćin', selekcija: 'Kadeti' },
  rsvp_decline: { ime: 'Emir Tukić', sta: 'trening "Večernji trening"', datum: '24.12.2026. 18:00', razlog: 'Bolestan sam.' },
  lineup_reminder: { protivnik: 'Hajduk', datum: '24.12.2026. 18:00' },
  result_reminder_2h: { protivnik: 'Hajduk', datum: '24.12.2026. 18:00' },
  result_reminder_1d: { protivnik: 'Hajduk', datum: '24.12.2026. 18:00' },
  appointment_created: { naziv: 'Individualni trening', osoba: 'Emir Tukić', datum: '24.12.2026. 17:00', napomena: 'Donijeti opremu' },
  tournament_invite: { ime: 'Emir', turnir: 'Ljetni kup 2026', selekcija: 'Kadeti', datum_od: '10.07.2026.', datum_do: '12.07.2026.', lokacija: 'Gradski stadion' },
  tournament_fee_created: { turnir: 'Ljetni kup 2026', iznos: '20' },
  tournament_fee_paid: { turnir: 'Ljetni kup 2026', iznos: '20' },
};

// Sample detail-rows per key, for the test-send preview only - mirrors what
// the real call sites build from live data (see each controller).
const SAMPLE_ROWS = {
  fee_reminder_upcoming: [['Iznos', '50 KM'], ['Rok uplate', '25.12.2026.']],
  fee_reminder_overdue: [['Iznos', '50 KM'], ['Rok uplate', '10.11.2026.']],
  fee_created: [['Iznos', '50 KM'], ['Rok uplate', '25.12.2026.']],
  fee_paid: [['Iznos', '50 KM'], ['Datum uplate', '26.11.2026.']],
  match_created: [['Protivnik', 'Hajduk'], ['Datum', '24.12.2026. 18:00'], ['Lokacija', 'Gradski stadion']],
  training_created: [['Selekcija', 'Kadeti'], ['Naziv', 'Večernji trening'], ['Datum i vrijeme', '24.12.2026. 18:00'], ['Lokacija', 'Teren 1'], ['Opis', 'Taktički trening']],
  appointment_created: [['Naziv', 'Individualni trening'], ['Datum i vrijeme', '24.12.2026. 17:00'], ['Napomena', 'Donijeti opremu']],
};

async function getBranding() {
  const [[row]] = await db.query('SELECT * FROM email_branding WHERE id = 1');
  return row || DEFAULT_BRANDING;
}

async function getTemplate(key) {
  const [[row]] = await db.query('SELECT * FROM email_templates WHERE template_key = ?', [key]);
  return row || null;
}

// Escape each variable value first, then substitute - the raw template text
// itself is never escaped (it already sits in the same HTML slots the old
// hardcoded strings used to), so this never double-escapes.
function renderPlaceholders(text, vars) {
  if (!text) return text;
  return text.replace(/\{\{(\w+)\}\}/g, (match, token) => {
    const v = vars[token];
    return v != null ? escapeHtml(String(v)) : match;
  });
}

// Core renderer every email call site goes through. Returns
// { enabled: false } if this template is turned off (caller should still
// write any in-app notification row, just skip the sendMail call), otherwise
// { enabled: true, subject, html }.
async function renderEmail(key, vars = {}, detailRows = null) {
  const tpl = await getTemplate(key);
  if (!tpl) throw new Error(`Unknown email template key: ${key}`);
  if (!tpl.enabled && !tpl.always_send) return { enabled: false };

  const branding = await getBranding();

  const subject = renderPlaceholders(tpl.subject, vars);
  const heading = renderPlaceholders(tpl.heading, vars);
  const introText = tpl.intro_text ? renderPlaceholders(tpl.intro_text, vars).replace(/\n/g, '<br>') : null;
  const secondaryNote = tpl.secondary_note ? renderPlaceholders(tpl.secondary_note, vars) : null;
  const infoTitle = tpl.info_title ? renderPlaceholders(tpl.info_title, vars) : null;
  const infoBodyText = tpl.info_body ? renderPlaceholders(tpl.info_body, vars).replace(/\n/g, '<br>') : null;
  const buttonLabel = renderPlaceholders(tpl.button_label, vars);

  const rowsHtml = (detailRows && detailRows.length) ? `
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0;">
              ${detailRows.map(([label, value]) => `
              <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;"><span style="font-size:13px;color:#94a3b8;">${escapeHtml(label)}</span><br><span style="font-size:15px;color:#0f172a;font-weight:600;">${escapeHtml(String(value))}</span></td></tr>`).join('')}
            </table>` : '';

  const bodyHtml = `
            <h1 class="heading" style="margin:0 0 14px;font-size:26px;font-weight:800;color:#0f172a;letter-spacing:-0.4px;line-height:1.25;text-align:center;">
              ${heading}
            </h1>
            ${introText ? `<p style="margin:0 0 8px;font-size:15px;color:#475569;line-height:1.7;text-align:center;">${introText}</p>` : ''}
            ${rowsHtml}
            ${ctaButton(`${vars.__link || ''}`, buttonLabel, branding)}
            ${secondaryNote ? noteText(secondaryNote) : ''}
            ${infoTitle ? infoBox(infoTitle, infoBodyText || '', branding) : ''}`;

  const html = emailWrap(heading, bodyHtml, branding);
  return { enabled: true, subject, html };
}

const ROLE_LABEL = { coach: 'trener', member: 'član', admin: 'administrator' };

// Thin async wrappers for the 3 always-on account-access emails - these keep
// their existing call sites' function names/signatures, just now backed by
// the editable templates instead of hardcoded strings. always_send=1 means
// `renderEmail` here is guaranteed enabled:true.
async function verifyEmailHtml(adminName, clubName, link) {
  const r = await renderEmail('verify_email', { ime: adminName, klub: clubName, __link: link });
  return r.html;
}
async function welcomeEmailHtml(adminName, clubName) {
  const r = await renderEmail('welcome', { ime: adminName, klub: clubName, __link: `${APP_URL}/app/` });
  return r.enabled ? r.html : null;
}
async function inviteEmailHtml(name, role, clubName, link) {
  const r = await renderEmail('invite', { ime: name, klub: clubName, uloga: ROLE_LABEL[role] || role, __link: link });
  return r.html;
}
async function resetPasswordEmailHtml(name, link) {
  const r = await renderEmail('reset_password', { ime: name, __link: link });
  return r.html;
}

module.exports = {
  DEFAULTS, TEMPLATE_KEYS, SAMPLE_VARS, SAMPLE_ROWS,
  getBranding, getTemplate, renderPlaceholders, renderEmail,
  verifyEmailHtml, welcomeEmailHtml, inviteEmailHtml, resetPasswordEmailHtml,
};
