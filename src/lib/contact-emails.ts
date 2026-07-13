import type { ContactRecord } from '@/lib/submissions';
import {
  SHOP_NOTIFICATION_EMAIL,
  SHOP_NAME,
  SHOP_PHONE,
} from '@/lib/config';
import { sendMail } from '@/lib/mail';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function contactText(locale: ContactRecord['locale']) {
  return locale === 'en'
    ? {
        ownerSubject: 'New contact form message',
        customerSubject: 'We received your message',
        customerHeading: 'Thank you for your message',
        customerBody:
          'We have received your enquiry and will get back to you as soon as possible.',
        name: 'Name',
        email: 'Email',
        time: 'Time',
        message: 'Your message',
      }
    : {
        ownerSubject: 'Ny besked fra kontaktformularen',
        customerSubject: 'Vi har modtaget din besked',
        customerHeading: 'Tak for din besked',
        customerBody:
          'Vi har modtaget din henvendelse og vender tilbage hurtigst muligt.',
        name: 'Navn',
        email: 'Email',
        time: 'Tidspunkt',
        message: 'Din besked',
      };
}

function wrapContactEmail(content: string): string {
  return `
    <div style="margin:0; padding:24px 12px; background-color:#f4f4ef; font-family:Arial,Helvetica,sans-serif; color:#1f2937;">
      <div style="max-width:640px; margin:0 auto; background-color:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 8px 24px rgba(31,41,55,0.10); border:1px solid #e7e8df;">
        <div style="background-color:#526349; padding:28px 24px; text-align:center; border-bottom:3px solid #46553f;">
          <div style="font-family:Georgia,'Times New Roman',serif; font-size:30px; line-height:1.1; font-weight:600; color:#ffffff; letter-spacing:0.2px;">Boulevardens Blomster</div>
          <div style="margin-top:8px; font-size:13px; color:#edf1e9; letter-spacing:0.8px; text-transform:uppercase;">Blomster med omtanke</div>
        </div>
        <div style="padding:30px 26px;">
          ${content}
        </div>
        <div style="background-color:#f4f4ef; padding:18px 24px; border-top:1px solid #e1e4da; text-align:center; font-size:12px; line-height:1.6; color:#6b7280;">
          <div style="font-weight:600; color:#526349;">${SHOP_NAME}</div>
          <div>Høje Taastrup Boulevard 55, 2630 Høje Taastrup</div>
          <div>${SHOP_PHONE} · boulevardensblomster.dk</div>
        </div>
      </div>
    </div>
  `;
}

function renderMessageBox(label: string, message: string): string {
  return `
    <div style="margin-top:22px;">
      <div style="margin-bottom:8px; color:#526349; font-size:12px; font-weight:700; letter-spacing:0.5px; text-transform:uppercase;">${escapeHtml(label)}</div>
      <div style="padding:18px; background-color:#f8f8f3; border:1px solid #dfe3d8; border-left:4px solid #526349; border-radius:10px; color:#263126; font-size:15px; line-height:1.7; white-space:pre-wrap;">${escapeHtml(message)}</div>
    </div>
  `;
}

export async function sendBrandedOwnerContactNotification(
  record: ContactRecord,
): Promise<boolean> {
  const text = contactText(record.locale);
  const subject = `${text.ownerSubject} ${record.id}`;
  const emailContent = `
    <div style="display:inline-block; margin-bottom:16px; padding:6px 10px; background-color:#e8eee4; border-radius:999px; color:#526349; font-size:12px; font-weight:700;">${escapeHtml(record.id)}</div>
    <h1 style="margin:0 0 10px; font-family:Georgia,'Times New Roman',serif; font-size:26px; line-height:1.25; color:#263126;">${escapeHtml(text.ownerSubject)}</h1>
    <p style="margin:0 0 20px; color:#667064; font-size:15px; line-height:1.6;">En kunde har sendt en besked via hjemmesiden.</p>
    <table role="presentation" style="width:100%; border-collapse:collapse; background:#fbfbf8; border:1px solid #e7e8df; border-radius:10px; overflow:hidden;">
      <tr><td style="padding:11px 14px; width:110px; color:#6b7280; border-bottom:1px solid #eceee7;"><strong>${escapeHtml(text.name)}</strong></td><td style="padding:11px 14px; color:#263126; border-bottom:1px solid #eceee7;">${escapeHtml(record.name)}</td></tr>
      <tr><td style="padding:11px 14px; color:#6b7280; border-bottom:1px solid #eceee7;"><strong>${escapeHtml(text.email)}</strong></td><td style="padding:11px 14px; color:#263126; border-bottom:1px solid #eceee7;"><a href="mailto:${escapeHtml(record.email)}" style="color:#526349; text-decoration:none;">${escapeHtml(record.email)}</a></td></tr>
      <tr><td style="padding:11px 14px; color:#6b7280;"><strong>${escapeHtml(text.time)}</strong></td><td style="padding:11px 14px; color:#263126;">${escapeHtml(new Date(record.createdAt).toLocaleString(record.locale === 'en' ? 'en-DK' : 'da-DK'))}</td></tr>
    </table>
    ${renderMessageBox(text.message, record.message)}
  `;

  const sent = await sendMail({
    to: SHOP_NOTIFICATION_EMAIL,
    subject,
    replyTo: record.email,
    text: [
      `ID: ${record.id}`,
      `${text.name}: ${record.name}`,
      `${text.email}: ${record.email}`,
      `${text.time}: ${record.createdAt}`,
      '',
      record.message,
    ].join('\n'),
    html: wrapContactEmail(emailContent),
  });

  if (sent) {
    record.notifications.ownerNotifiedAt = new Date().toISOString();
  }

  return sent;
}

export async function sendBrandedCustomerContactAcknowledgement(
  record: ContactRecord,
): Promise<boolean> {
  const text = contactText(record.locale);
  const subject = `${text.customerSubject} ${record.id}`;
  const emailContent = `
    <div style="display:inline-block; margin-bottom:16px; padding:6px 10px; background-color:#e8eee4; border-radius:999px; color:#526349; font-size:12px; font-weight:700;">${escapeHtml(record.id)}</div>
    <h1 style="margin:0 0 12px; font-family:Georgia,'Times New Roman',serif; font-size:28px; line-height:1.25; color:#263126;">${escapeHtml(text.customerHeading)}</h1>
    <p style="margin:0; color:#667064; font-size:16px; line-height:1.7;">${escapeHtml(text.customerBody)}</p>
    ${renderMessageBox(text.message, record.message)}
    <div style="margin-top:24px; padding-top:18px; border-top:1px solid #e7e8df; color:#6b7280; font-size:13px; line-height:1.6;">
      Du kan besvare denne mail, hvis du ønsker at tilføje noget til din henvendelse.
    </div>
  `;

  const sent = await sendMail({
    to: record.email,
    subject,
    replyTo: SHOP_NOTIFICATION_EMAIL,
    text: [
      text.customerHeading,
      text.customerBody,
      '',
      `ID: ${record.id}`,
      '',
      record.message,
    ].join('\n'),
    html: wrapContactEmail(emailContent),
  });

  if (sent) {
    record.notifications.customerAcknowledgedAt = new Date().toISOString();
  }

  return sent;
}
