import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ROLES, SUPER_ADMIN_ONLY_ROLES } from '@paraapp/core';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireStaff } from '@/lib/staff';
import { currentTime, formatDate } from '@/lib/format';
import { Button, Input } from '@/components/ui';
import { Pagination } from '@/components/pagination';
import { setBan, setRole } from './actions';

const PAGE_SIZE = 30;

export default async function UsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const viewer = await requireStaff(locale, 'users');
  const t = await getTranslations('admin.usersAdmin');
  const roleNames = await getTranslations('roles');
  const common = await getTranslations('common');
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().slice(0, 60);
  const page = Math.max(1, Math.min(500, Number(sp.page) || 1));

  const supabase = await createClient();
  let query = supabase
    .from('profiles')
    .select('id, display_name, full_name, status, age_group, created_at')
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  if (q) {
    const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    query = query.ilike('display_name', pattern);
  }
  const { data } = await query;
  const users = (data ?? []).slice(0, PAGE_SIZE);
  const ids = users.map((u) => u.id);
  const { data: roles } = ids.length
    ? await supabase.from('user_roles').select('user_id, role').in('user_id', ids)
    : { data: [] };

  // Ban state and email live in auth.users, only reachable with the service role.
  const admin = createAdminClient();
  const authInfo = new Map<string, { email?: string; bannedUntil?: string }>();
  await Promise.all(
    ids.map(async (id) => {
      const { data: u } = await admin.auth.admin.getUserById(id);
      if (u.user) {
        authInfo.set(id, {
          email: u.user.email,
          bannedUntil: (u.user as { banned_until?: string }).banned_until,
        });
      }
    }),
  );
  const now = currentTime();
  const isSuperAdmin = viewer.roles.includes('super_admin');

  return (
    <div className="space-y-4">
      <form method="get" className="flex max-w-md gap-2" role="search">
        <label htmlFor="q" className="sr-only">
          {t('search')}
        </label>
        <Input id="q" name="q" defaultValue={q} placeholder={t('search')} />
        <Button type="submit" variant="secondary">
          {common('search')}
        </Button>
      </form>
      <ul className="space-y-3">
        {users.map((u) => {
          const mine = (roles ?? []).filter((r) => r.user_id === u.id).map((r) => r.role);
          const info = authInfo.get(u.id);
          const banned = info?.bannedUntil && new Date(info.bannedUntil).getTime() > now;
          return (
            <li key={u.id} className="space-y-3 rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">
                  {u.display_name}
                  {u.full_name ? (
                    <span className="font-normal text-muted"> · {u.full_name}</span>
                  ) : null}
                </p>
                <p className="text-xs text-muted">
                  {info?.email} · {u.status} · {u.age_group ?? '—'} ·{' '}
                  {formatDate(u.created_at, locale)}
                  {banned ? ` · ${t('banned')}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {ROLES.map((role) => {
                  const has = mine.includes(role);
                  const superOnly = SUPER_ADMIN_ONLY_ROLES.includes(role);
                  // Admins see who is admin but only the super admin can change it.
                  if (superOnly && !isSuperAdmin && !has) return null;
                  return (
                    <form key={role} action={setRole}>
                      <input type="hidden" name="user_id" value={u.id} />
                      <input type="hidden" name="role" value={role} />
                      <input type="hidden" name="grant" value={has ? '0' : '1'} />
                      <button
                        className={`rounded-full border px-3 py-1 text-sm ${
                          has
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border'
                        }`}
                        aria-pressed={has}
                        title={has ? t('revoke') : t('grant')}
                        disabled={superOnly && (!isSuperAdmin || (has && u.id === viewer.user.id))}
                      >
                        {roleNames(role)}
                      </button>
                    </form>
                  );
                })}
              </div>
              {u.id !== viewer.user.id && !mine.includes('admin') ? (
                <form action={setBan} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="user_id" value={u.id} />
                  {banned ? (
                    <Button name="days" value="0" variant="secondary">
                      {t('unban')}
                    </Button>
                  ) : (
                    <>
                      <Button name="days" value="7" variant="ghost">
                        {t('ban')} 7d
                      </Button>
                      <Button name="days" value="30" variant="ghost">
                        {t('ban')} 30d
                      </Button>
                    </>
                  )}
                </form>
              ) : null}
            </li>
          );
        })}
      </ul>
      <Pagination
        pathname="/admin/users"
        params={{ q: q || undefined }}
        page={page}
        hasNext={(data ?? []).length > PAGE_SIZE}
      />
    </div>
  );
}
