import type { APIRoute } from 'astro';
import type { Locale } from '@/lib/i18n';
import {
  createContactRecord,
  saveContactRecord,
  sendCustomerContactAcknowledgement,
  sendOwnerContactNotification,
} from '@/lib/submissions';

export const prerender = false;

interface ContactRequestBody {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
  locale?: Locale;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function parseLocale(locale: unknown): Locale {
  return locale === 'en' ? 'en' : 'da';
}

function getMessages(locale: Locale) {
  return locale === 'en'
    ? {
        required: 'Please complete all required fields.',
        error: 'An error occurred. Please try again.',
      }
    : {
        required: 'Udfyld venligst alle påkrævede felter.',
        error: 'Der opstod en fejl. Prøv venligst igen.',
      };
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = (await request.json()) as ContactRequestBody;
    const locale = parseLocale(body.locale);
    const messages = getMessages(locale);
    const name = body.name?.trim() || '';
    const email = body.email?.trim() || '';
    const subject =
      body.subject?.trim() ||
      (locale === 'en' ? 'General enquiry' : 'Generel forespørgsel');
    const message = body.message?.trim() || '';

    if (!name || !email || !message) {
      return json({ error: messages.required }, 400);
    }

    const record = createContactRecord({
      locale,
      name,
      email,
      subject,
      message,
    });

    await saveContactRecord(record);

    await Promise.allSettled([
      sendOwnerContactNotification(record),
      sendCustomerContactAcknowledgement(record),
    ]);

    await saveContactRecord(record);

    return json({ success: true, id: record.id });
  } catch (error) {
    console.error('Contact form error:', error);
    return json({ error: getMessages('da').error }, 500);
  }
};
