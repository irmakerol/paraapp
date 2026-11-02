import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/staff';
import { Card } from '@/components/ui';
import { GroupForm } from './group-form';

export default async function AdminGroupsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff(locale, 'groups');
  const t = await getTranslations('admin.groupsAdmin');
  const supabase = await createClient();
  const [{ data: groups }, { data: members }] = await Promise.all([
    supabase.from('user_groups').select('id, name, description').order('name'),
    supabase.from('user_group_members').select('group_id'),
  ]);
  const counts = new Map<string, number>();
  for (const m of members ?? []) counts.set(m.group_id, (counts.get(m.group_id) ?? 0) + 1);

  return (
    <div className="space-y-6">
      <p className="text-muted">{t('lead')}</p>
      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">{t('new')}</h2>
        <GroupForm id={null} values={{ name: '', description: '' }} />
      </Card>
      {groups?.length ? (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {groups.map((g) => (
            <li key={g.id}>
              <Link
                href={`/admin/groups/${g.id}`}
                className="flex min-h-11 flex-wrap items-center gap-3 px-4 py-3 hover:bg-background"
              >
                <span className="flex-1">
                  <span className="block font-semibold">{g.name}</span>
                  {g.description ? (
                    <span className="block text-sm text-muted">{g.description}</span>
                  ) : null}
                </span>
                <span className="rounded-full bg-background px-3 py-1 text-sm">
                  {t('memberCount', { count: counts.get(g.id) ?? 0 })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <p className="text-muted">{t('empty')}</p>
        </Card>
      )}
    </div>
  );
}
