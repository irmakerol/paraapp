import { getTranslations, setRequestLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireStaff } from '@/lib/staff';
import { currentTime, formatDate, formatDateTime } from '@/lib/format';
import { Link } from '@/i18n/navigation';
import { sampleLabel } from '@/lib/sample';
import { Alert, Button, buttonClass, Input } from '@/components/ui';
import { Pagination } from '@/components/pagination';
import { RoleBadges } from '@/components/role-badges';

const PAGE_SIZE = 30;

export default async function UsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; page?: string; deleted?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff(locale, 'users');
  const t = await getTranslations('admin.usersAdmin');
  const common = await getTranslations('common');
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().slice(0, 60);
  const page = Math.max(1, Math.min(500, Number(sp.page) || 1));

  const supabase = await createClient();
  let query = supabase
    .from('profiles')
    .select(
      'id, display_name, avatar_path, status, age_group, created_at, last_seen_at, pilot_level, training_level, is_instructor',
    )
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
  // Profile photos may be private, so admins see them through short-lived signed URLs.
  const photoPaths = users.map((u) => u.avatar_path).filter((p): p is string => Boolean(p));
  const photos = new Map<string, string>();
  if (photoPaths.length) {
    const { data: signed } = await admin.storage.from('avatars').createSignedUrls(photoPaths, 600);
    for (const s of signed ?? []) if (s.path && s.signedUrl) photos.set(s.path, s.signedUrl);
  }
  const now = currentTime();

  return (
    <div className="space-y-4">
      {sp.deleted === '1' ? <Alert tone="success">{t('deleted')}</Alert> : null}
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
              <div className="flex flex-wrap items-center gap-3">
                {u.avatar_path && photos.get(u.avatar_path) ? (
                  // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                  <img
                    src={photos.get(u.avatar_path)}
                    alt=""
                    className="size-12 shrink-0 rounded-full border border-border object-cover"
                  />
                ) : (
                  <div
                    aria-hidden
                    className="flex size-12 shrink-0 items-center justify-center rounded-full bg-background font-bold text-muted"
                  >
                    {u.display_name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{sampleLabel(u.display_name, locale)}</p>
                  <p className="text-xs text-muted">
                    {[
                      info?.email,
                      u.status,
                      u.age_group ?? '—',
                      formatDate(u.created_at, locale),
                      u.last_seen_at
                        ? t('lastSeen', { time: formatDateTime(u.last_seen_at, locale) })
                        : t('neverSeen'),
                      banned ? t('banned') : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  <RoleBadges
                    roles={mine}
                    level={u.pilot_level}
                    trainingLevel={u.training_level}
                    instructor={u.is_instructor}
                    className="pt-1"
                  />
                </div>
                <Link href={`/admin/users/${u.id}`} className={buttonClass('secondary')}>
                  {t('edit')}
                </Link>
              </div>
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
