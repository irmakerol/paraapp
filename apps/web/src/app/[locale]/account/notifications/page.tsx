import { setRequestLocale } from 'next-intl/server';
import { requireActiveViewer } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { PushSettings } from './push-settings';

export default async function NotificationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const viewer = await requireActiveViewer(locale);
  const supabase = await createClient();
  const { data: consent } = await supabase
    .from('current_consents')
    .select('granted')
    .eq('user_id', viewer.user.id)
    .eq('consent_type', 'marketing_notifications')
    .maybeSingle();
  const prefs = (viewer.profile.notification_prefs ?? {}) as Record<string, unknown>;
  return (
    <PushSettings
      prefs={{
        messages: prefs.messages !== false,
        news: prefs.news !== false,
        ads: prefs.ads !== false,
        equipment: prefs.equipment !== false,
      }}
      hasNewsConsent={Boolean(consent?.granted)}
    />
  );
}
