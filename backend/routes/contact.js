const router = require('express').Router();
const { send: sendMail } = require('../config/mailer');

const SUBJECT_MAP = {
  support: 'Tehnička podrška',
  sales: 'Prodaja i pretplata',
  billing: 'Naplata i fakture',
  feature: 'Prijedlog funkcije',
  other: 'Ostalo',
};

router.post('/', async (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !message)
    return res.status(400).json({ message: 'Molimo popunite sva obavezna polja.' });

  const subjectLabel = SUBJECT_MAP[subject] || subject || 'Nije navedeno';

  try {
    await sendMail({
      to: process.env.MAIL_USER || 'klavio.app@gmail.com',
      replyTo: `${name} <${email}>`,
      subject: `[Klavio Kontakt] ${subjectLabel} — ${name}`,
      text: `Nova kontakt poruka\n\nIme: ${name}\nE-mail: ${email}\nPredmet: ${subjectLabel}\n\n${message}`,
      html: `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
        <h2 style="color:#111827;border-bottom:2px solid #e2e8f0;padding-bottom:8px;">Nova kontakt poruka</h2>
        <p style="margin:6px 0;"><strong>Ime:</strong> ${name}</p>
        <p style="margin:6px 0;"><strong>E-mail:</strong> <a href="mailto:${email}">${email}</a></p>
        <p style="margin:6px 0;"><strong>Predmet:</strong> ${subjectLabel}</p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;">
        <p style="margin:0 0 8px;"><strong>Poruka:</strong></p>
        <p style="white-space:pre-wrap;color:#374151;background:#f8fafc;padding:12px;border-radius:6px;">${message}</p>
      </body></html>`,
    });
    res.json({ message: 'Poruka uspješno poslana! Odgovorit ćemo u roku od 24 sata.' });
  } catch (err) {
    console.error('Contact mail error:', err.message);
    res.status(500).json({ message: 'Greška pri slanju. Kontaktirajte nas direktno na klavio.app@gmail.com' });
  }
});

module.exports = router;
