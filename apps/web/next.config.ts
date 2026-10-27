import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const supabaseWs = supabase.replace(/^http/, 'ws');
const dev = process.env.NODE_ENV !== 'production';

/**
 * Content Security Policy: lists every third party the app may talk to (Supabase, map and airspace
 * tiles, click-to-load videos). Inline scripts stay allowed because Next.js and next-themes inject
 * small inline bootstraps; a nonce-based policy would make every page dynamic.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabase} https://tiles.openfreemap.org https://*.api.tiles.openaip.net https://s3.amazonaws.com/elevation-tiles-prod/`,
  "font-src 'self'",
  `connect-src 'self' ${supabase} ${supabaseWs} https://tiles.openfreemap.org https://*.api.tiles.openaip.net https://s3.amazonaws.com/elevation-tiles-prod/`,
  "worker-src 'self' blob:",
  'frame-src https://www.youtube-nocookie.com https://player.vimeo.com',
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(supabase.startsWith('https:') ? ['upgrade-insecure-requests'] : []),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
];

const nextConfig: NextConfig = {
  transpilePackages: ['@paraapp/core'],
  // A self-contained server in .next/standalone for the Docker image (see deploy/).
  output: 'standalone',
  outputFileTracingRoot: fileURLToPath(new URL('../..', import.meta.url)),
  poweredByHeader: false,
  images: { formats: ['image/avif', 'image/webp'] },
  experimental: {
    // Flight files (IGC/GPX) are posted to a server action and analysed on the server.
    serverActions: { bodySizeLimit: '9mb' },
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        source: '/brand/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
