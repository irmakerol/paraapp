import type { MetadataRoute } from 'next';
import { publicEnv } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Personal and staff areas are never useful in search results.
      disallow: [
        '/api/',
        '/*/account',
        '/*/admin',
        '/*/messages',
        '/*/logbook',
        '/*/onboarding',
        '/*/guardian',
        '/*/auth',
        '/*/rides',
        '/*/offline',
      ],
    },
    sitemap: `${publicEnv.NEXT_PUBLIC_SITE_URL}/sitemap.xml`,
  };
}
