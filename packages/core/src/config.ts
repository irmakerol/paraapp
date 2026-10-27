/**
 * Single source of truth for names and product-wide constants.
 * The app name is a placeholder until the club picks the real one.
 */
export const APP_CONFIG = {
  name: 'ParaApp',
  club: {
    legalName: 'Fly Anatolia Hava Sporları Kulübü',
    shortName: 'Fly Anatolia',
    legalForm: 'dernek',
    address: 'Kordonboyu Mah. Ankara Cd. No:27 D:108, 34862 Kartal / İstanbul, Türkiye',
    email: 'info@flyanatolia.com',
    website: 'https://flyanatolia.com',
  },
  locales: ['tr', 'en'] as const,
  defaultLocale: 'tr' as const,
  /** Youngest age allowed to register. 14–17 need guardian consent. */
  minimumAge: 14,
  adultAge: 18,
  /** Days between an account deletion request and the hard purge. */
  accountPurgeDays: 30,
  /** Metres hidden at the start and end of public tracks (protects home addresses). */
  publicTrackTrimMetres: 500,
  /** Days a guardian has to confirm consent before the link expires. */
  guardianLinkDays: 7,
} as const;

export type Locale = (typeof APP_CONFIG.locales)[number];
