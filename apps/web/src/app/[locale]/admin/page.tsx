import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { canUse, requireStaff } from '@/lib/staff';

export default async function AdminHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const viewer = await requireStaff(locale);
  const t = await getTranslations('admin');
  const supabase = await createClient();
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;

  const tiles: { label: string; value: number; href: string }[] = [];
  if (canUse(viewer, 'reports')) {
    tiles.push({
      label: t('stats.openReports'),
      href: '/admin/reports',
      value: await count(
        supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      ),
    });
  }
  if (canUse(viewer, 'tips')) {
    tiles.push({
      label: t('stats.pendingTips'),
      href: '/admin/tips',
      value: await count(
        supabase
          .from('tips')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending_review'),
      ),
    });
  }
  if (canUse(viewer, 'requests')) {
    tiles.push({
      label: t('stats.openRequests'),
      href: '/admin/requests',
      value: await count(
        supabase
          .from('data_requests')
          .select('id', { count: 'exact', head: true })
          .in('status', ['received', 'in_progress']),
      ),
    });
  }
  if (canUse(viewer, 'users')) {
    tiles.push({
      label: t('stats.users'),
      href: '/admin/users',
      value: await count(supabase.from('profiles').select('id', { count: 'exact', head: true })),
    });
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((tile) => (
        <li key={tile.href}>
          <Link
            href={tile.href}
            className="block rounded-2xl border border-border bg-card p-5 hover:shadow-md"
          >
            <p className="text-sm text-muted">{tile.label}</p>
            <p className="text-3xl font-extrabold">{tile.value}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
