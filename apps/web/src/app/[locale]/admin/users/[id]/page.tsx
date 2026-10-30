import { notFound } from 'next/navigation';
import { z } from 'zod';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireStaff } from '@/lib/staff';
import { formatDate } from '@/lib/format';
import { sampleLabel } from '@/lib/sample';
import { UserForm } from './user-form';

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireStaff(locale, 'users');
  if (!z.string().uuid().safeParse(id).success) notFound();
  const t = await getTranslations('admin.usersAdmin');
  const roleNames = await getTranslations('roles');
  const supabase = await createClient();
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'id, display_name, full_name, city, home_site, pilot_level, bio, avatar_path, status, created_at',
      )
      .eq('id', id)
      .maybeSingle(),
    supabase.from('user_roles').select('role').eq('user_id', id),
  ]);
  if (!profile || profile.status === 'deletion_requested') notFound();

  // Email and the photo are only reachable with the service role (the photo may be private).
  const admin = createAdminClient();
  const [{ data: authUser }, photo] = await Promise.all([
    admin.auth.admin.getUserById(id),
    profile.avatar_path
      ? admin.storage.from('avatars').createSignedUrl(profile.avatar_path, 600)
      : Promise.resolve({ data: null }),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <Link href="/admin/users" className="text-sm underline">
          ← {t('back')}
        </Link>
        <h2 className="text-xl font-bold">{sampleLabel(profile.display_name, locale)}</h2>
        <p className="text-sm text-muted">
          {authUser.user?.email} · {formatDate(profile.created_at, locale)}
          {roles?.length ? ` · ${roles.map((r) => roleNames(r.role)).join(', ')}` : ''}
        </p>
      </div>
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
        }}
      />
    </div>
  );
}
