import type { Locale } from '@/lib/i18n';

export const SHOP_NAME = 'Boulevardens Blomster';
export const SHOP_PHONE = '+45 61 51 74 00';
export const SHOP_NOTIFICATION_EMAIL =
  import.meta.env.SHOP_NOTIFICATION_EMAIL ||
  'online-shop@boulevardensblomster.dk';
export const DEFAULT_SITE_URL =
  import.meta.env.SITE_URL || 'https://boulevardensblomster.dk';

export function getRequestOrigin(request: Request): string {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';

  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const url = new URL(request.url);

  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    return DEFAULT_SITE_URL;
  }

  return url.origin;
}

export function getOrderPagePath(locale: Locale): string {
  return locale === 'en' ? '/en/company-orders' : '/da/firma-bestilling';
}

export function getTermsPagePath(locale: Locale): string {
  return locale === 'en'
    ? '/en/terms-and-conditions'
    : '/da/handelsbetingelser';
}

export function getPrivacyPagePath(locale: Locale): string {
  return locale === 'en' ? '/en/privacy-policy' : '/da/privatlivspolitik';
}

export function formatDkkFromOre(amountOre: number, locale = 'da-DK'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'DKK',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountOre / 100);
}
