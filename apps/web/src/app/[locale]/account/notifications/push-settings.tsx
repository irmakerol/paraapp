'use client';
import { useActionState, useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { publicEnv } from '@/lib/env';
import { initialState } from '@/lib/action-state';
import { Link } from '@/i18n/navigation';
import { Alert, Button, Card } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { FormMessage } from '@/components/form-message';
import { removePushSubscription, saveNotificationPrefs, savePushSubscription } from './actions';

type DeviceState = 'loading' | 'unsupported' | 'denied' | 'off' | 'on';

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function PushSettings({
  prefs,
  hasNewsConsent,
}: {
  prefs: { messages: boolean; news: boolean; ads: boolean; equipment: boolean };
  hasNewsConsent: boolean;
}) {
  const t = useTranslations('notificationsSettings');
  const common = useTranslations('common');
  const [device, setDevice] = useState<DeviceState>('loading');
  const [pending, start] = useTransition();
  const [state, action] = useActionState(saveNotificationPrefs, initialState);
  const vapidKey = publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!vapidKey || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        return 'unsupported' as const;
      }
      if (Notification.permission === 'denied') return 'denied' as const;
      const registration = await navigator.serviceWorker.getRegistration('/');
      const subscription = await registration?.pushManager.getSubscription();
      return subscription ? ('on' as const) : ('off' as const);
    }
    void check().then((s) => !cancelled && setDevice(s));
    return () => {
      cancelled = true;
    };
  }, [vapidKey]);

  function enable() {
    start(async () => {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setDevice(permission === 'denied' ? 'denied' : 'off');
        return;
      }
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      const ok = await savePushSubscription(subscription.toJSON(), navigator.userAgent);
      setDevice(ok ? 'on' : 'off');
    });
  }

  function disable() {
    start(async () => {
      const registration = await navigator.serviceWorker.getRegistration('/');
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await removePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setDevice('off');
    });
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <h2 className="text-lg font-semibold">{t('title')}</h2>
        <p className="text-muted">{t('text')}</p>
        {device === 'unsupported' ? <Alert>{t('unsupported')}</Alert> : null}
        {device === 'denied' ? <Alert tone="error">{t('denied')}</Alert> : null}
        {device === 'on' ? (
          <div className="space-y-3">
            <Alert tone="success">{t('enabled')}</Alert>
            <Button variant="secondary" onClick={disable} disabled={pending}>
              {t('disable')}
            </Button>
          </div>
        ) : null}
        {device === 'off' ? (
          <Button onClick={enable} disabled={pending}>
            {t('enable')}
          </Button>
        ) : null}
      </Card>

      <Card>
        <form action={action} className="space-y-4">
          <h2 className="text-lg font-semibold">{t('topics')}</h2>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              name="messages"
              defaultChecked={prefs.messages}
              className="size-5"
            />
            {t('topicMessages')}
          </label>
          <label className="flex items-center gap-3">
            <input type="checkbox" name="news" defaultChecked={prefs.news} className="size-5" />
            {t('topicNews')}
          </label>
          {!hasNewsConsent ? (
            <p className="text-sm text-muted">
              <Link href="/account/privacy" className="underline">
                {t('consentLink')}
              </Link>
            </p>
          ) : null}
          <label className="flex items-center gap-3">
            <input type="checkbox" name="ads" defaultChecked={prefs.ads} className="size-5" />
            {t('topicAds')}
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              name="equipment"
              defaultChecked={prefs.equipment}
              className="size-5"
            />
            {t('topicEquipment')}
          </label>
          <FormMessage state={state} success={common('saved')} />
          <SubmitButton>{common('save')}</SubmitButton>
        </form>
      </Card>
    </div>
  );
}
