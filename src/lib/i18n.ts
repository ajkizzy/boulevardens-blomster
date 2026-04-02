export type Locale = 'da' | 'en';

export function getLocale(url: URL): Locale {
  const path = url.pathname;
  if (path.startsWith('/en')) return 'en';
  return 'da';
}

export function getLocalePath(locale: Locale, path: string): string {
  return `/${locale}${path}`;
}

export function getAlternateLocale(locale: Locale): Locale {
  return locale === 'da' ? 'en' : 'da';
}

// Map DA paths to EN paths and vice versa
const pathMap: Record<string, Record<Locale, string>> = {
  home: { da: '', en: '' },
  about: { da: '/om-os', en: '/about' },
  services: { da: '/services', en: '/services' },
  contact: { da: '/kontakt', en: '/contact' },
  order: { da: '/firma-bestilling', en: '/company-orders' },
  terms: { da: '/handelsbetingelser', en: '/terms-and-conditions' },
  privacy: { da: '/privatlivspolitik', en: '/privacy-policy' },
};

export function getAlternatePath(currentPath: string, currentLocale: Locale): string {
  const altLocale = getAlternateLocale(currentLocale);
  // Strip locale prefix and trailing slash
  let stripped = currentPath.replace(new RegExp(`^/${currentLocale}`), '').replace(/\/$/, '') || '';

  for (const [, paths] of Object.entries(pathMap)) {
    if (paths[currentLocale] === stripped) {
      return `/${altLocale}${paths[altLocale]}`;
    }
  }

  return `/${altLocale}`;
}

export function getPathForLocale(currentPath: string, currentLocale: Locale, targetLocale: Locale): string {
  if (currentLocale === targetLocale) return currentPath;
  return getAlternatePath(currentPath, currentLocale);
}

export function loadContent<T>(locale: Locale, file: string): T {
  const modules: Record<string, any> = import.meta.glob('../data/**/*.json', { eager: true });
  const key = `../data/${locale}/${file}.json`;
  return modules[key]?.default ?? modules[key];
}

export function getNavLinks(locale: Locale) {
  const site = loadContent<any>(locale, 'site');
  const base = `/${locale}`;
  const paths = locale === 'da'
    ? { about: '/om-os', services: '/services', contact: '/kontakt', order: '/firma-bestilling' }
    : { about: '/about', services: '/services', contact: '/contact', order: '/company-orders' };

  return {
    home: { label: site.nav.home, href: `${base}` },
    about: { label: site.nav.about, href: `${base}${paths.about}` },
    services: { label: site.nav.services, href: `${base}${paths.services}` },
    contact: { label: site.nav.contact, href: `${base}${paths.contact}` },
    order: { label: site.nav.order, href: `${base}${paths.order}` },
  };
}
