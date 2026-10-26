'use client';
import { Link, usePathname } from '@/i18n/navigation';

/** Underlined tab links. Deeper pages (e.g. /admin/news/new) keep their section's tab active. */
export function Tabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-2 overflow-x-auto border-b border-border">
      {tabs.map((tab) => {
        const nested = tab.href.split('/').length > 2 && pathname.startsWith(`${tab.href}/`);
        const active = pathname === tab.href || nested;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 font-semibold ${
              active
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted hover:text-foreground'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
