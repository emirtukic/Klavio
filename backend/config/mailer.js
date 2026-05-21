const FROM_NAME  = 'Klavio';
const FROM_EMAIL = process.env.MAIL_USER || 'klavio.app@gmail.com';

async function send(options) {
  const to = Array.isArray(options.to)
    ? options.to.map(e => ({ email: e }))
    : [{ email: options.to }];

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': process.env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender:      { name: FROM_NAME, email: FROM_EMAIL },
      to,
      subject:     options.subject,
      htmlContent: options.html,
      textContent: options.text,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Brevo API error ${res.status}`);
  }

  return res.json();
}

module.exports = { send };
