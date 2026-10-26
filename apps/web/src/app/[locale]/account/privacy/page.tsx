import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { CONSENT_TYPES } from '@paraapp/core';
import { requireActiveViewer } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { Card, buttonClass } from '@/components/ui';
import { signOutEverywhere } from '../../auth/actions';
import { setConsent } from '../actions';
import { DataRequestForm, DeleteAccountForm } from './forms';

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const viewer = await requireActiveViewer(locale);
  const t = await getTranslations();
  const format = await getFormatter();
  const supabase = await createClient();
  const [{ data: consents }, { data: requests }] = await Promise.all([
    supabase.from('current_consents').select('consent_type, granted').eq('user_id', viewer.user.id),
    supabase
      .from('data_requests')
      .select('id, request_type, status, received_at, due_at')
      .order('received_at', { ascending: false }),
  ]);
  const granted = new Map((consents ?? []).map((c) => [c.consent_type, c.granted]));
  // Feature-specific consents appear here once the user has been asked for them.
  const shown = CONSENT_TYPES.filter(
    (c) => ['marketing_notifications', 'analytics', 'public_profile'].includes(c) || granted.has(c),
  );

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">{t('account.privacy.consentsTitle')}</h2>
          <p className="text-sm text-muted">{t('account.privacy.consentsText')}</p>
        </div>
        <ul className="divide-y divide-border">
          {shown.map((type) => {
            const on = granted.get(type) ?? false;
            return (
              <li key={type} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="font-semibold">{t(`consentTypes.${type}.title`)}</p>
                  <p className="text-sm text-muted">{t(`consentTypes.${type}.text`)}</p>
                </div>
                <form action={setConsent}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="consent_type" value={type} />
                  <input type="hidden" name="granted" value={on ? 'false' : 'true'} />
                  <button
                    role="switch"
                    aria-checked={on}
                    aria-label={t(`consentTypes.${type}.title`)}
                    className={buttonClass(on ? 'primary' : 'secondary', 'min-w-20')}
                  >
                    {on ? t('account.privacy.on') : t('account.privacy.off')}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">{t('account.privacy.exportTitle')}</h2>
        <p className="text-sm text-muted">{t('account.privacy.exportText')}</p>
        <a href="/api/account/export" className={buttonClass('secondary')} download>
          {t('account.privacy.exportButton')}
        </a>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold">{t('account.privacy.requestTitle')}</h2>
        <p className="text-sm text-muted">{t('account.privacy.requestText')}</p>
        <DataRequestForm />
        {requests?.length ? (
          <div>
            <h3 className="mb-2 font-semibold">{t('account.privacy.requestsList')}</h3>
            <ul className="space-y-1 text-sm">
              {requests.map((r) => (
                <li key={r.id} className="flex justify-between gap-2">
                  <span>
                    {format.dateTime(new Date(r.received_at), { dateStyle: 'medium' })} ·{' '}
                    {t.has(`account.privacy.requestTypes.${r.request_type}`)
                      ? t(`account.privacy.requestTypes.${r.request_type}`)
                      : r.request_type}
                  </span>
                  <span className="font-medium">
                    {t(`account.privacy.requestStatus.${r.status}`)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">{t('auth.signOutAll')}</h2>
        <p className="text-sm text-muted">{t('auth.signOutAllHelp')}</p>
        <form action={signOutEverywhere}>
          <input type="hidden" name="locale" value={locale} />
          <button className={buttonClass('secondary')}>{t('auth.signOutAll')}</button>
        </form>
      </Card>

      <Card className="space-y-3 border-danger/40">
        <h2 className="text-lg font-semibold">{t('account.privacy.deleteTitle')}</h2>
        <p className="text-sm text-muted">{t('account.privacy.deleteText')}</p>
        <DeleteAccountForm />
      </Card>
    </div>
  );
}
