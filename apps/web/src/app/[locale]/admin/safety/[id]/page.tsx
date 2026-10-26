import { notFound } from 'next/navigation';
import { z } from 'zod';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { INCIDENT_STATUSES } from '@paraapp/core';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/staff';
import { displayNames } from '@/lib/people';
import { decryptField } from '@/lib/crypto';
import { serverEnv } from '@/lib/env';
import { formatDate, formatDateTime } from '@/lib/format';
import { Alert, Button, buttonClass, Card, Textarea } from '@/components/ui';
import { addIncidentNote, updateIncident } from '../actions';

export default async function IncidentPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ injury?: string }>;
}) {
  const { locale, id } = await params;
  const { injury } = await searchParams;
  setRequestLocale(locale);
  await requireStaff(locale, 'safety');
  if (!z.string().uuid().safeParse(id).success) notFound();
  const t = await getTranslations('safety');
  const a = await getTranslations('admin.safetyAdmin');
  const supabase = await createClient();
  const { data: report } = await supabase
    .from('incident_reports')
    .select('*, sites:site_id(name, slug)')
    .eq('id', id)
    .maybeSingle();
  if (!report) notFound();
  // Every time a safety officer opens a report, it is written to the audit log.
  await supabase.rpc('log_incident_view', { p_incident: id });

  const [{ data: notes }, names] = await Promise.all([
    supabase
      .from('incident_notes')
      .select('id, body, author_id, created_at')
      .eq('incident_id', id)
      .order('created_at'),
    displayNames(supabase, [report.reporter_id, report.assigned_to]),
  ]);
  const noteAuthors = await displayNames(
    supabase,
    (notes ?? []).map((n) => n.author_id),
  );

  // Injury details are decrypted only on request (and that read is audited too).
  let injuryText: string | null = null;
  let injuryError = false;
  if (injury === '1' && report.special_category_consent) {
    const { data: enc } = await supabase.rpc('read_incident_injury', { p_incident: id });
    const key = serverEnv().INCIDENT_ENCRYPTION_KEY;
    if (enc && key) {
      try {
        injuryText = decryptField(enc, key);
      } catch {
        injuryError = true;
      }
    } else if (enc) {
      injuryError = true;
    }
  }

  const reporter =
    report.anonymity === 'fully_anonymous'
      ? a('reporterUnknown')
      : report.reporter_id
        ? (names.get(report.reporter_id) ?? '—')
        : a('reporterPurged');

  const facts: [string, string | null][] = [
    [a('occurred'), formatDate(report.occurred_on, locale)],
    [a('site'), report.sites?.name ?? report.site_name],
    [a('category'), t(`categories.${report.category}`)],
    [a('severity'), t(`severities.${report.severity}`)],
    [a('anonymity'), t(`anonymity.${report.anonymity}`)],
    [a('reporter'), reporter],
    [a('contact'), report.contact_ok ? a('yes') : a('no')],
    [a('received'), formatDateTime(report.created_at, locale)],
    [a('assigned'), report.assigned_to ? (names.get(report.assigned_to) ?? '—') : '—'],
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/admin/safety" className="text-sm text-muted hover:underline">
        ← {a('back')}
      </Link>
      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="space-y-5">
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {facts
              .filter(([, v]) => v)
              .map(([label, value]) => (
                <div
                  key={label}
                  className="flex justify-between gap-4 border-b border-border py-1.5"
                >
                  <dt className="text-muted">{label}</dt>
                  <dd className="text-right font-medium">{value}</dd>
                </div>
              ))}
          </dl>
          <section>
            <h2 className="mb-2 text-lg font-bold">{a('description')}</h2>
            <p className="whitespace-pre-line">{report.description}</p>
          </section>
          {report.conditions ? (
            <section>
              <h2 className="mb-2 text-lg font-bold">{a('conditions')}</h2>
              <p className="whitespace-pre-line">{report.conditions}</p>
            </section>
          ) : null}
          {report.equipment ? (
            <section>
              <h2 className="mb-2 text-lg font-bold">{a('equipment')}</h2>
              <p className="whitespace-pre-line">{report.equipment}</p>
            </section>
          ) : null}
          {report.lessons ? (
            <section>
              <h2 className="mb-2 text-lg font-bold">{a('reporterLessons')}</h2>
              <p className="whitespace-pre-line">{report.lessons}</p>
            </section>
          ) : null}
          {report.injured ? (
            <Card className="space-y-2">
              <h2 className="text-lg font-bold">{a('injury')}</h2>
              {!report.special_category_consent ? (
                <p className="text-sm text-muted">{a('noInjuryDetails')}</p>
              ) : injuryText ? (
                <p className="whitespace-pre-line">{injuryText}</p>
              ) : injuryError ? (
                <Alert tone="error">{a('injuryUnreadable')}</Alert>
              ) : (
                <>
                  <p className="text-sm text-muted">{a('injuryAudited')}</p>
                  <Link href={`/admin/safety/${id}?injury=1`} className={buttonClass('secondary')}>
                    {a('showInjury')}
                  </Link>
                </>
              )}
            </Card>
          ) : null}
          <section className="space-y-3">
            <h2 className="text-lg font-bold">{a('notes')}</h2>
            <ul className="space-y-2">
              {(notes ?? []).map((n) => (
                <li key={n.id} className="rounded-xl border border-border bg-card p-3">
                  <p className="text-xs text-muted">
                    {(n.author_id && noteAuthors.get(n.author_id)) || '—'} ·{' '}
                    {formatDateTime(n.created_at, locale)}
                  </p>
                  <p className="whitespace-pre-line">{n.body}</p>
                </li>
              ))}
            </ul>
            <form action={addIncidentNote} className="space-y-2">
              <input type="hidden" name="id" value={id} />
              <label htmlFor="note-body" className="sr-only">
                {a('addNote')}
              </label>
              <Textarea id="note-body" name="body" rows={3} maxLength={4000} required />
              <Button variant="secondary">{a('addNote')}</Button>
            </form>
          </section>
        </div>
        <aside className="space-y-4">
          <Card className="space-y-3">
            <form action={updateIncident} className="space-y-3">
              <input type="hidden" name="id" value={id} />
              <label htmlFor="status" className="block text-sm font-semibold">
                {a('status')}
              </label>
              <select
                id="status"
                name="status"
                defaultValue={report.status}
                className="min-h-11 w-full rounded-lg border border-border bg-card px-3"
              >
                {INCIDENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`statuses.${s}`)}
                  </option>
                ))}
              </select>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" name="assign" value="me" className="size-5" />
                {a('assignMe')}
              </label>
              <Button className="w-full">{a('update')}</Button>
            </form>
          </Card>
          <Link href="/admin/safety/lessons/new" className={buttonClass('secondary', 'w-full')}>
            {a('writeLesson')}
          </Link>
          <p className="text-xs text-muted">{a('retentionNote')}</p>
        </aside>
      </div>
    </div>
  );
}
