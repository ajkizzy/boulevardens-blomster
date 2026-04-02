import type { Locale } from '@/lib/i18n';

export const SHOP_NAME = 'Boulevardens Blomster';
export const SHOP_NOTIFICATION_EMAIL =
  import.meta.env.SHOP_NOTIFICATION_EMAIL ||
  'online-shop@boulevardensblomster.dk';
export const DEFAULT_SITE_URL =
  import.meta.env.SITE_URL || 'https://boulevardensblomster.dk';

export function getRequestOrigin(request: Request): string {
  return new URL(request.url).origin;
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
