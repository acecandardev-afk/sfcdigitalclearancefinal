export type SendMailInput = {
  to: string;
  subject: string;
  html: string;
};

/**
 * Transactional mail: `MAIL_PROVIDER` = `resend` (default) or `smtp` / `gmail` (uses SMTP_* env).
 * Resend: set RESEND_API_KEY, optional RESEND_FROM.
 * SMTP: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, optional MAIL_FROM.
 */
export async function sendTransactionalEmail(
  input: SendMailInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const provider = (process.env.MAIL_PROVIDER || 'resend').toLowerCase();

  try {
    if (provider === 'smtp' || provider === 'gmail') {
      const nodemailer = await import('nodemailer');
      const host = process.env.SMTP_HOST || 'smtp.gmail.com';
      const port = Number(process.env.SMTP_PORT || 587);
      const user = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS;
      if (!user || !pass) {
        return { ok: false, error: 'SMTP_USER and SMTP_PASS must be set for SMTP mail' };
      }
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user, pass },
      });
      await transporter.sendMail({
        from: process.env.MAIL_FROM || user,
        to: input.to,
        subject: input.subject,
        html: input.html,
      });
      return { ok: true };
    }

    const key = process.env.RESEND_API_KEY;
    if (!key) {
      console.warn('[email] RESEND_API_KEY not set; skipping send to', input.to);
      return { ok: false, error: 'RESEND_API_KEY not set' };
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || 'Digital Clearance <onboarding@resend.dev>',
        to: [input.to],
        subject: input.subject,
        html: input.html,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      return { ok: false, error: t || res.statusText };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
