'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

/**
 * The header's dropdown menu (<details>). Closes when a link inside it is chosen, when the page
 * changes, on Escape and on a click outside, so it never stays open over the new page.
 */
export function MenuDetails({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);

  useEffect(() => {
    const close = (event: Event) => {
      const details = ref.current;
      if (!details?.open) return;
      if (event instanceof KeyboardEvent) {
        if (event.key === 'Escape') {
          details.open = false;
          details.querySelector('summary')?.focus();
        }
        return;
      }
      if (!details.contains(event.target as Node)) details.open = false;
    };
    document.addEventListener('click', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', close);
    };
  }, []);

  return (
    <details
      ref={ref}
      className={className}
      onClick={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest('a') && ref.current) ref.current.open = false;
      }}
    >
      {children}
    </details>
  );
}
