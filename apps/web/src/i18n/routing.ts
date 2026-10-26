import { defineRouting } from 'next-intl/routing';
import { APP_CONFIG } from '@paraapp/core';

export const routing = defineRouting({
  locales: APP_CONFIG.locales,
  defaultLocale: APP_CONFIG.defaultLocale,
  localePrefix: 'always',
});
