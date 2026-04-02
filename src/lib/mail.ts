import nodemailer from 'nodemailer';
import { SHOP_NAME, SHOP_NOTIFICATION_EMAIL } from '@/lib/config';

export interface MailMessage {
  to: string | string[];
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}

let cachedTransporter: nodemailer.Transporter | null | undefined;

function getTransporter(): nodemailer.Transporter | null {
  if (cachedTransporter !== undefined) {
    return cachedTransporter;
  }

  const host = import.meta.env.SMTP_HOST;
  const user = import.meta.env.SMTP_USER;
  const pass = import.meta.env.SMTP_PASS;

  if (!host || !user || !pass) {
    cachedTransporter = null;
    return cachedTransporter;
  }

  const port = Number(import.meta.env.SMTP_PORT || 587);
  const secure =
    (import.meta.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });

  return cachedTransporter;
}

function getFromAddress(): string {
  return (
    import.meta.env.MAIL_FROM ||
    `${SHOP_NAME} <${SHOP_NOTIFICATION_EMAIL}>`
  );
}

export async function sendMail(message: MailMessage): Promise<boolean> {
  const transporter = getTransporter();

  if (!transporter) {
    console.warn(
      `SMTP is not configured. Skipping email "${message.subject}".`,
    );
    return false;
  }

  await transporter.sendMail({
    from: getFromAddress(),
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
    replyTo: message.replyTo,
  });

  return true;
}
