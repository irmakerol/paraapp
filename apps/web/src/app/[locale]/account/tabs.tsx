'use client';
import { Link, usePathname } from '@/i18n/navigation';

export function AccountTabs({
  profileLabel,
  privacyLabel,
}: {
  profileLabel: string;
  privacyLabel: string;
}) {
  const pathname = usePathname();
  const tabs = [
    { href: '/account', label: profileLabel },
    { href: '/account/privacy', label: privacyLabel },
  ];
  return (
    <nav className="flex gap-2 border-b border-border">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={`-mb-px border-b-2 px-4 py-2 font-semibold ${
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
