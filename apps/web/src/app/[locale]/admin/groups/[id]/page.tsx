import { notFound } from 'next/navigation';
import { z } from 'zod';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/staff';
import { sampleLabel } from '@/lib/sample';
import { Button, Card, Select } from '@/components/ui';
import { GroupForm } from '../group-form';
import { deleteGroup, setGroupMember } from '../actions';

export default async function AdminGroupPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireStaff(locale, 'groups');
  if (!z.string().uuid().safeParse(id).success) notFound();
  const t = await getTranslations('admin.groupsAdmin');
  const supabase = await createClient();
  const [{ data: group }, { data: members }, { data: people }] = await Promise.all([
    supabase.from('user_groups').select('id, name, description').eq('id', id).maybeSingle(),
    supabase.from('user_group_members').select('user_id').eq('group_id', id),
    // Admins read all profiles; deleted accounts are left out.
    supabase
      .from('profiles')
      .select('id, display_name')
      .neq('status', 'deletion_requested')
      .order('display_name'),
  ]);
  if (!group) notFound();
  const inGroup = new Set((members ?? []).map((m) => m.user_id));
  const name = (p: { display_name: string }) => sampleLabel(p.display_name, locale);
  const current = (people ?? []).filter((p) => inGroup.has(p.id));
  const others = (people ?? []).filter((p) => !inGroup.has(p.id));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/admin/groups" className="text-sm underline">
        ← {t('back')}
      </Link>
      <Card className="space-y-3">
        <h2 className="text-xl font-bold">{group.name}</h2>
        <GroupForm
          id={group.id}
          values={{ name: group.name, description: group.description ?? '' }}
        />
      </Card>

      <Card className="space-y-4">
        <h3 className="text-lg font-semibold">
          {t('members')} · {current.length}
        </h3>
        {others.length ? (
          <form action={setGroupMember} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="group_id" value={group.id} />
            <input type="hidden" name="add" value="1" />
            <div className="min-w-56 flex-1 space-y-1.5">
              <label htmlFor="user_id" className="block text-sm font-semibold">
                {t('addPerson')}
              </label>
              <Select id="user_id" name="user_id" required defaultValue="">
                <option value="" disabled>
                  {t('choosePerson')}
                </option>
                {others.map((p) => (
                  <option key={p.id} value={p.id}>
                    {name(p)}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit">{t('add')}</Button>
          </form>
        ) : null}
        {current.length ? (
          <ul className="divide-y divide-border">
            {current.map((p) => (
              <li key={p.id} className="flex min-h-11 items-center justify-between gap-3 py-2">
                <Link href={`/admin/users/${p.id}`} className="font-medium hover:underline">
                  {name(p)}
                </Link>
                <form action={setGroupMember}>
                  <input type="hidden" name="group_id" value={group.id} />
                  <input type="hidden" name="user_id" value={p.id} />
                  <input type="hidden" name="add" value="0" />
                  <Button variant="ghost">{t('remove')}</Button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">{t('noMembers')}</p>
        )}
      </Card>

      <form action={deleteGroup}>
        <input type="hidden" name="id" value={group.id} />
        <input type="hidden" name="locale" value={locale} />
        <Button variant="ghost" className="text-danger">
          {t('delete')}
        </Button>
      </form>
    </div>
  );
}
