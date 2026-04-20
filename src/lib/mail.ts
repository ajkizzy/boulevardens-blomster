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

function getEnv(key: string): string | undefined {
  const fromProcess = typeof process !== 'undefined' ? process.env?.[key] : undefined;
  const fromImport = (import.meta.env as Record<string, string | undefined>)[key];
  return fromProcess || fromImport;
}

function getTransporter(): nodemailer.Transporter | null {
  if (cachedTransporter !== undefined) {
    return cachedTransporter;
  }

  const host = getEnv('SMTP_HOST');
  const user = getEnv('SMTP_USER');
  const pass = getEnv('SMTP_PASS');

  console.log('[mail] SMTP config check:', {
    hasHost: Boolean(host),
    hasUser: Boolean(user),
    hasPass: Boolean(pass),
    host: host || '(missing)',
    userPreview: user ? `${user.slice(0, 3)}***` : '(missing)',
  });

  if (!host || !user || !pass) {
    cachedTransporter = null;
    return cachedTransporter;
  }

  const port = Number(getEnv('SMTP_PORT') || 587);
  const secure =
    (getEnv('SMTP_SECURE') || '').toLowerCase() === 'true' || port === 465;

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
    getEnv('MAIL_FROM') ||
    `${SHOP_NAME} <${SHOP_NOTIFICATION_EMAIL}>`
  );
}

export async function sendMail(message: MailMessage): Promise<boolean> {
  console.log(`[mail] sendMail called: to=${message.to}, subject="${message.subject}"`);
  const transporter = getTransporter();

  if (!transporter) {
    console.warn(
      `[mail] SMTP is not configured. Skipping email "${message.subject}".`,
    );
    return false;
  }

  try {
    const info = await transporter.sendMail({
      from: getFromAddress(),
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      replyTo: message.replyTo,
    });
    console.log(`[mail] sent "${message.subject}" to ${message.to}: messageId=${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`[mail] Failed to send "${message.subject}" to ${message.to}:`, error);
    return false;
  }
}
