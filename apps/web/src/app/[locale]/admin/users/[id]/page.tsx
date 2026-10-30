import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { formatDuration, ROLES, type Role } from '@paraapp/core';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireStaff } from '@/lib/staff';
import { currentTime, formatDate, formatDateTime, formatPrice } from '@/lib/format';
import { sampleLabel } from '@/lib/sample';
import { Button, Field, Input } from '@/components/ui';
import { setGroupMember } from '../../groups/actions';
import { adminDeleteNotice, adminRemoveAd, setBan } from '../actions';
import { RoleToggles } from '../role-toggles';
import { UserForm } from './user-form';
import { DeleteAccountForm } from './delete-account';

interface Overview {
  profile: {
    id: string;
    display_name: string;
    full_name: string | null;
    avatar_path: string | null;
    country: string | null;
    city: string | null;
    home_site: string | null;
    pilot_level: string | null;
    flying_since: number | null;
    total_flight_hours: number;
    total_flights: number;
    wings: string | null;
    bio: string | null;
    locale: string;
    age_group: 'adult' | 'minor' | null;
    status: string;
    created_at: string;
    last_seen_at: string | null;
    licence_body: string | null;
    has_licence_number: boolean;
  };
  stats: {
    flights: number;
    seconds: number;
    last: string | null;
    max_distance_m: number | null;
    max_alt_m: number | null;
  };
  flights: {
    id: string;
    started_at: string;
    duration_s: number;
    distance_m: number | null;
    xc_distance_m: number | null;
    max_alt_m: number | null;
    visibility: string;
    source: string;
    glider: string | null;
    site: string | null;
  }[];
  equipment: {
    id: string;
    kind: string;
    brand: string | null;
    model: string;
    size: string | null;
    certification: string | null;
    last_check_on: string | null;
    last_repack_on: string | null;
    retired: boolean;
  }[];
  ads: {
    id: string;
    title: string;
    category: string;
    price: number;
    currency: string;
    status: string;
    removed: boolean;
    created_at: string;
  }[];
  notices: {
    id: string;
    title: string;
    category: string;
    kind: string;
    closed: boolean;
    expires_at: string;
    created_at: string;
  }[];
  reports_about: number;
}

const km = (m: number | null | undefined) => (m == null ? '—' : `${(m / 1000).toFixed(1)} km`);
const metres = (m: number | null | undefined) => (m == null ? '—' : `${Math.round(m)} m`);

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const viewer = await requireStaff(locale, 'users');
  if (!z.string().uuid().safeParse(id).success) notFound();
  const t = await getTranslations('admin.usersAdmin');
  const p = await getTranslations('account.profile');
  const roleNames = await getTranslations('roles');
  const g = await getTranslations('admin.groupsAdmin');
  const activityT = await getTranslations('admin.activity');
  const logbook = await getTranslations('logbook');
  const equipmentT = await getTranslations('equipment');
  const market = await getTranslations('market');
  const noticesT = await getTranslations('notices');
  const supabase = await createClient();

  const [
    { data: overviewJson },
    { data: roleRows },
    { data: groups },
    { data: memberships },
    { data: activity },
    { data: retention },
  ] = await Promise.all([
    supabase.rpc('admin_user_overview', { p_user: id }),
    supabase.from('user_roles').select('role').eq('user_id', id),
    supabase.from('user_groups').select('id, name').order('name'),
    supabase.from('user_group_members').select('group_id').eq('user_id', id),
    supabase
      .from('user_activity')
      .select('id, kind, created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('retention_policies')
      .select('retain_days')
      .eq('data_type', 'deleted_accounts')
      .maybeSingle(),
  ]);
  const overview = overviewJson as unknown as Overview | null;
  if (!overview?.profile) notFound();
  const { profile, stats } = overview;
  const roles = (roleRows ?? []).map((r) => r.role as Role);
  const inGroup = new Set((memberships ?? []).map((m) => m.group_id));
  const isSelf = id === viewer.user.id;
  const isSuperAdmin = viewer.roles.includes('super_admin');
  const targetIsAdmin = roles.includes('admin');
  const canManage = !isSelf && (!targetIsAdmin || isSuperAdmin);

  // Email, ban state and the photo are only reachable with the service role.
  const admin = createAdminClient();
  const [{ data: authUser }, photo] = await Promise.all([
    admin.auth.admin.getUserById(id),
    profile.avatar_path
      ? admin.storage.from('avatars').createSignedUrl(profile.avatar_path, 600)
      : Promise.resolve({ data: null }),
  ]);
  const bannedUntil = (authUser.user as { banned_until?: string } | null)?.banned_until;
  const banned = Boolean(bannedUntil && new Date(bannedUntil).getTime() > currentTime());
  const countryName = new Intl.DisplayNames([locale], { type: 'region' });
  const name = sampleLabel(profile.display_name, locale);

  const nav = [
    ['profile', t('profileSection')],
    ['roles', t('rolesSection')],
    ['flights', `${t('flightsSection')} (${stats.flights})`],
    ['equipment', `${t('equipmentSection')} (${overview.equipment.length})`],
    ['ads', `${t('adsSection')} (${overview.ads.length})`],
    ['notices', `${t('noticesSection')} (${overview.notices.length})`],
    ...(groups?.length ? [['groups', g('title')]] : []),
    ['activity', activityT('title')],
    ...(canManage ? [['danger', t('dangerSection')]] : []),
  ];

  return (
    <div className="space-y-6">
      <Link href="/admin/users" className="text-sm underline">
        ← {t('back')}
      </Link>

      {/* Header: who this is at a glance. */}
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start gap-4">
          {photo.data?.signedUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
            <img
              src={photo.data.signedUrl}
              alt=""
              className="size-20 shrink-0 rounded-full border border-border object-cover"
            />
          ) : (
            <div
              aria-hidden
              className="flex size-20 shrink-0 items-center justify-center rounded-full bg-background text-2xl font-bold text-muted"
            >
              {name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="text-2xl font-extrabold">
              {name}
              {profile.full_name ? (
                <span className="font-normal text-muted"> · {profile.full_name}</span>
              ) : null}
            </h2>
            <p className="text-sm">
              {authUser.user?.email ? (
                <a href={`mailto:${authUser.user.email}`} className="underline">
                  {authUser.user.email}
                </a>
              ) : null}
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {roles.map((r) => (
                <span
                  key={r}
                  className="rounded-full bg-brand-navy px-2.5 py-0.5 text-xs font-semibold text-white"
                >
                  {roleNames(r)}
                </span>
              ))}
              {banned ? (
                <span className="rounded-full bg-danger px-2.5 py-0.5 text-xs font-semibold text-white">
                  {t('banned')}
                </span>
              ) : null}
              {profile.age_group === 'minor' ? (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-900 dark:text-amber-100">
                  {t('ageGroups.minor')}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Fact label={t('status')}>
            {t.has(`statuses.${profile.status}`) ? t(`statuses.${profile.status}`) : profile.status}
          </Fact>
          <Fact label={t('memberSince')}>{formatDate(profile.created_at, locale)}</Fact>
          <Fact label={activityT('title')}>
            {profile.last_seen_at
              ? activityT('lastSeen', { time: formatDateTime(profile.last_seen_at, locale) })
              : activityT('neverSeen')}
          </Fact>
          <Fact label={t('ageGroup')}>
            {profile.age_group ? t(`ageGroups.${profile.age_group}`) : '—'}
          </Fact>
          <Fact label={p('pilotLevel')}>
            {profile.pilot_level ? p(`levels.${profile.pilot_level}` as 'levels.p2') : '—'}
          </Fact>
          <Fact label={t('licence')}>
            {profile.licence_body
              ? p(`licenceBodies.${profile.licence_body}` as 'licenceBodies.thk')
              : '—'}
            {' · '}
            {profile.has_licence_number ? t('licenceNumberSaved') : t('licenceNumberMissing')}
          </Fact>
          <Fact label={p('city')}>
            {[profile.city, profile.country ? countryName.of(profile.country) : null]
              .filter(Boolean)
              .join(', ') || '—'}
          </Fact>
          <Fact label={p('homeSite')}>{profile.home_site || '—'}</Fact>
          <Fact label={t('language')}>{profile.locale.toUpperCase()}</Fact>
        </dl>
        <p className="mt-3 text-sm text-muted">
          {t('reportsAbout', { count: overview.reports_about })}
        </p>
      </section>

      {/* Flying at a glance. */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label={t('flightsSection')}>
        <Stat label={t('stats.logged')} value={String(stats.flights)} />
        <Stat label={t('stats.loggedTime')} value={formatDuration(stats.seconds)} />
        <Stat
          label={t('stats.declared')}
          value={t('stats.declaredValue', {
            flights: profile.total_flights,
            hours: Math.round(Number(profile.total_flight_hours)),
          })}
        />
        <Stat
          label={t('stats.last')}
          value={stats.last ? formatDate(stats.last, locale) : t('stats.none')}
        />
        <Stat
          label={t('stats.maxDistance')}
          value={`${km(stats.max_distance_m)} · ${metres(stats.max_alt_m)}`}
        />
      </section>

      <nav
        aria-label={t('sections')}
        className="sticky top-16 z-10 -mx-1 overflow-x-auto bg-background/95 py-2 backdrop-blur"
      >
        <ul className="flex gap-2 px-1">
          {nav.map(([anchor, label]) => (
            <li key={anchor}>
              <a
                href={`#${anchor}`}
                className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-background"
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <Section id="profile" title={t('profileSection')}>
        {canManage || isSelf ? (
          <UserForm
            id={profile.id}
            photoUrl={photo.data?.signedUrl ?? null}
            values={{
              display_name: profile.display_name,
              full_name: profile.full_name ?? '',
              city: profile.city ?? '',
              home_site: profile.home_site ?? '',
              pilot_level: profile.pilot_level ?? '',
              bio: profile.bio ?? '',
              country: profile.country ?? '',
              flying_since: profile.flying_since?.toString() ?? '',
              licence_body: profile.licence_body ?? '',
            }}
          />
        ) : (
          <p className="text-sm text-muted">{t('adminNote')}</p>
        )}
      </Section>

      <Section id="roles" title={t('rolesSection')}>
        <RoleToggles
          userId={profile.id}
          roles={roles.filter((r) => (ROLES as readonly string[]).includes(r))}
          isSelf={isSelf}
          isSuperAdmin={isSuperAdmin}
        />
      </Section>

      <Section id="flights" title={t('flightsSection')} lead={t('flightsLead')}>
        {overview.flights.length ? (
          <Table
            head={[
              t('columns.date'),
              t('columns.site'),
              t('columns.duration'),
              t('columns.distance'),
              t('columns.maxAlt'),
              t('columns.glider'),
              t('columns.visibility'),
              t('columns.source'),
            ]}
            rows={overview.flights.map((f) => [
              formatDateTime(f.started_at, locale),
              f.site ? sampleLabel(f.site, locale) : '—',
              formatDuration(f.duration_s),
              km(f.xc_distance_m ?? f.distance_m),
              metres(f.max_alt_m),
              f.glider ?? '—',
              logbook.has(`visibility.${f.visibility}`)
                ? logbook(`visibility.${f.visibility}`)
                : f.visibility,
              t.has(`sources.${f.source}`) ? t(`sources.${f.source}`) : f.source,
            ])}
          />
        ) : (
          <p className="text-muted">{t('flightsEmpty')}</p>
        )}
      </Section>

      <Section id="equipment" title={t('equipmentSection')}>
        {overview.equipment.length ? (
          <Table
            head={[
              t('columns.kind'),
              t('columns.model'),
              equipmentT('certification'),
              t('columns.check'),
              t('columns.repack'),
              t('columns.status'),
            ]}
            rows={overview.equipment.map((e) => [
              equipmentT.has(`kinds.${e.kind}`) ? equipmentT(`kinds.${e.kind}`) : e.kind,
              [e.brand, e.model, e.size].filter(Boolean).join(' '),
              e.certification ?? '—',
              e.last_check_on ? formatDate(e.last_check_on, locale) : '—',
              e.last_repack_on ? formatDate(e.last_repack_on, locale) : '—',
              e.retired ? equipmentT('retired') : '✓',
            ])}
          />
        ) : (
          <p className="text-muted">{t('equipmentEmpty')}</p>
        )}
      </Section>

      <Section id="ads" title={t('adsSection')}>
        {overview.ads.length ? (
          <ul className="divide-y divide-border">
            {overview.ads.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/market/${a.id}`} className="font-semibold hover:underline">
                    {sampleLabel(a.title, locale)}
                  </Link>
                  <p className="text-sm text-muted">
                    {market.has(`categories.${a.category}`)
                      ? market(`categories.${a.category}`)
                      : a.category}
                    {' · '}
                    {formatPrice(Number(a.price), a.currency, locale)}
                    {' · '}
                    {a.removed
                      ? t('removed')
                      : market.has(`statuses.${a.status}`)
                        ? market(`statuses.${a.status}`)
                        : a.status}
                    {' · '}
                    {formatDate(a.created_at, locale)}
                  </p>
                </div>
                {!a.removed ? (
                  <form action={adminRemoveAd}>
                    <input type="hidden" name="id" value={a.id} />
                    <Button variant="secondary">{t('removeAd')}</Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">{t('adsEmpty')}</p>
        )}
      </Section>

      <Section id="notices" title={t('noticesSection')}>
        {overview.notices.length ? (
          <ul className="divide-y divide-border">
            {overview.notices.map((n) => {
              const open = !n.closed && new Date(n.expires_at).getTime() > currentTime();
              return (
                <li key={n.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{sampleLabel(n.title, locale)}</p>
                    <p className="text-sm text-muted">
                      {noticesT(`kindsShort.${n.kind}` as 'kindsShort.offer')} ·{' '}
                      {noticesT(`categories.${n.category}` as 'categories.gear')} ·{' '}
                      {open ? t('open') : t('closed')} · {formatDate(n.created_at, locale)}
                    </p>
                  </div>
                  <form action={adminDeleteNotice}>
                    <input type="hidden" name="id" value={n.id} />
                    <Button variant="secondary">{t('deleteNotice')}</Button>
                  </form>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-muted">{t('noticesEmpty')}</p>
        )}
      </Section>

      {groups?.length ? (
        <Section id="groups" title={g('title')}>
          <div className="flex flex-wrap gap-2">
            {groups.map((group) => {
              const has = inGroup.has(group.id);
              return (
                <form key={group.id} action={setGroupMember}>
                  <input type="hidden" name="group_id" value={group.id} />
                  <input type="hidden" name="user_id" value={profile.id} />
                  <input type="hidden" name="add" value={has ? '0' : '1'} />
                  <Button
                    variant={has ? 'primary' : 'secondary'}
                    aria-pressed={has}
                    className="rounded-full"
                  >
                    {has ? '✓ ' : '+ '}
                    {group.name}
                  </Button>
                </form>
              );
            })}
          </div>
        </Section>
      ) : null}

      <Section id="activity" title={activityT('title')} lead={activityT('retention')}>
        {activity?.length ? (
          <ol className="space-y-1 text-sm">
            {activity.map((a) => (
              <li key={a.id} className="flex flex-wrap gap-x-3">
                <span className="tabular-nums text-muted">
                  {formatDateTime(a.created_at, locale)}
                </span>
                <span>
                  {activityT.has(`kinds.${a.kind}`) ? activityT(`kinds.${a.kind}`) : a.kind}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-muted">{activityT('empty')}</p>
        )}
      </Section>

      {canManage ? (
        <section
          id="danger"
          className="scroll-mt-32 space-y-5 rounded-2xl border-2 border-danger/40 bg-card p-5"
        >
          <h3 className="text-lg font-bold">{t('dangerSection')}</h3>
          {!targetIsAdmin ? (
            <form action={setBan} className="space-y-3">
              <input type="hidden" name="user_id" value={profile.id} />
              <input type="hidden" name="ban" value={banned ? '0' : '1'} />
              <p className="text-sm">{banned ? t('isBanned') : t('banLead')}</p>
              {!banned ? (
                <Field id="ban-reason" label={t('banReason')}>
                  <Input id="ban-reason" name="reason" maxLength={500} />
                </Field>
              ) : null}
              <Button variant={banned ? 'secondary' : 'danger'} aria-pressed={banned}>
                {banned ? t('unban') : t('ban')}
              </Button>
            </form>
          ) : null}
          <hr className="border-border" />
          <DeleteAccountForm userId={profile.id} days={retention?.retain_days ?? 30} />
        </section>
      ) : (
        <p className="text-sm text-muted">{isSelf ? t('selfNote') : t('adminNote')}</p>
      )}
      <p className="text-xs text-muted">
        {t('viewAudited')} {t('auditNote')}
      </p>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-muted">{label}:</dt>
      <dd className="min-w-0 font-medium">{children}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-lg font-extrabold tabular-nums">{value}</p>
    </div>
  );
}

function Section({
  id,
  title,
  lead,
  children,
}: {
  id: string;
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="scroll-mt-32 space-y-3 rounded-2xl border border-border bg-card p-5"
    >
      <div>
        <h3 id={`${id}-heading`} className="text-lg font-bold">
          {title}
        </h3>
        {lead ? <p className="text-sm text-muted">{lead}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-muted">
            {head.map((h) => (
              <th key={h} scope="col" className="py-2 pr-4 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/60 last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="py-2 pr-4 tabular-nums">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
