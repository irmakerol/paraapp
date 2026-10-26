'use client';
import { ThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';
import { ServiceWorker } from './service-worker';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
      <ServiceWorker />
    </ThemeProvider>
  );
}
