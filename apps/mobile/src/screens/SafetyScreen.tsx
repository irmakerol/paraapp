import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { t } from '../i18n';
import { dateLabel, listLessons, loadLessonBody, type LessonItem } from '../content';
import { listSites, type Site } from '../sites';
import {
  INCIDENT_ANONYMITY,
  INCIDENT_CATEGORIES,
  INCIDENT_SEVERITIES,
  myReports,
  submitIncident,
  type IncidentForm,
  type MyReport,
} from '../safety';
import { Badge, Body, Button, Chips, Field, Segmented, Title, Toggle } from '../ui/kit';
import { Markdown } from '../ui/markdown';
import { BackBar, Meta, Row, screenStyles } from '../ui/screen';
import { useTheme } from '../ui/theme';

type Mode = { kind: 'home' } | { kind: 'lesson'; lesson: LessonItem } | { kind: 'report' };

/** "Güvenlik": report incidents and near misses, read the lessons, reach SOS. */
export function SafetyScreen({
  userId,
  onBack,
  onSos,
}: {
  userId: string | null;
  onBack: () => void;
  onSos: () => void;
}) {
  const c = useTheme();
  const [mode, setMode] = useState<Mode>({ kind: 'home' });
  const [lessons, setLessons] = useState<LessonItem[] | null>(null);
  const [reports, setReports] = useState<MyReport[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [sent, setSent] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [l, r] = await Promise.all([
        listLessons(),
        userId ? myReports(userId) : Promise.resolve([]),
      ]);
      setLessons(l);
      setReports(r);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (mode.kind === 'lesson')
    return <LessonView lesson={mode.lesson} onBack={() => setMode({ kind: 'home' })} />;
  if (mode.kind === 'report')
    return (
      <ReportForm
        onBack={() => setMode({ kind: 'home' })}
        onSent={() => {
          setSent(true);
          setMode({ kind: 'home' });
          void load();
        }}
      />
    );

  return (
    <ScrollView
      contentContainerStyle={screenStyles.page}
      refreshControl={<RefreshControl refreshing={busy} onRefresh={() => void load()} />}
    >
      <BackBar onBack={onBack} />
      <Title>{t('nav.safety')}</Title>
      <Body muted>{t('safety.lead')}</Body>
      {sent ? (
        <View style={[s.sent, { borderColor: c.climb }]}>
          <Body>{t('safety.sent')}</Body>
        </View>
      ) : null}
      <View style={s.actions}>
        {userId ? (
          <Button label={t('safety.reportButton')} onPress={() => setMode({ kind: 'report' })} />
        ) : (
          <Body muted>{t('safety.report.signIn')}</Body>
        )}
        <Button label={`🆘 ${t('safety.sosButton')}`} kind="danger" onPress={onSos} />
      </View>
      <Meta>{t('safety.justCulture')}</Meta>

      {userId && reports.length ? (
        <>
          <Text accessibilityRole="header" style={[s.h2, { color: c.text }]}>
            {t('safety.myReports')}
          </Text>
          {reports.map((r) => (
            <View key={r.id} style={[s.report, { borderColor: c.border }]}>
              <Text style={[s.reportTitle, { color: c.text }]}>
                {t(`safety.categories.${r.category}`)} · {dateLabel(`${r.occurredOn}T12:00:00`)}
              </Text>
              <View style={s.badges}>
                <Badge label={t(`safety.statuses.${r.status}`)} tone="strong" />
                <Badge label={t(`safety.anonymity.${r.anonymity}`)} />
              </View>
            </View>
          ))}
          <Meta>{t('safety.anonymousNotListed')}</Meta>
        </>
      ) : null}

      <Text accessibilityRole="header" style={[s.h2, { color: c.text }]}>
        {t('safety.lessons')}
      </Text>
      {failed ? <Body muted>{t('common.offline')}</Body> : null}
      {busy && !lessons ? <ActivityIndicator /> : null}
      {lessons?.length === 0 ? <Body muted>{t('safety.noLessons')}</Body> : null}
      {lessons?.map((l) => (
        <Row
          key={l.id}
          title={l.title}
          summary={l.summary}
          meta={dateLabel(l.publishedAt)}
          badges={
            <>
              <Badge
                label={t(`safety.categories.${l.category as (typeof INCIDENT_CATEGORIES)[number]}`)}
                tone="strong"
              />
              <Badge
                label={t(`safety.severities.${l.severity as (typeof INCIDENT_SEVERITIES)[number]}`)}
              />
            </>
          }
          onPress={() => setMode({ kind: 'lesson', lesson: l })}
        />
      ))}
    </ScrollView>
  );
}

function LessonView({ lesson, onBack }: { lesson: LessonItem; onBack: () => void }) {
  const [body, setBody] = useState<string | null>(null);
  useEffect(() => {
    loadLessonBody(lesson.id).then(setBody, () => setBody(''));
  }, [lesson.id]);
  return (
    <ScrollView contentContainerStyle={screenStyles.page}>
      <BackBar label={t('nav.safety')} onBack={onBack} />
      <Title>{lesson.title}</Title>
      <Meta>{dateLabel(lesson.publishedAt)}</Meta>
      {lesson.summary ? <Body muted>{lesson.summary}</Body> : null}
      {body === null ? <ActivityIndicator /> : <Markdown>{body}</Markdown>}
      <Meta>{t('safety.lessonNote')}</Meta>
    </ScrollView>
  );
}

const today = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

function ReportForm({ onBack, onSent }: { onBack: () => void; onSent: () => void }) {
  const c = useTheme();
  const [sites, setSites] = useState<Site[]>([]);
  const [form, setForm] = useState<IncidentForm>({
    anonymity: 'named',
    occurred_on: today(),
    site_id: null,
    site_name: '',
    category: 'other',
    severity: 'near_miss',
    injured: false,
    description: '',
    conditions: '',
    equipment: '',
    lessons: '',
    contact_ok: true,
    special_category_consent: false,
    injury_details: '',
  });
  const [errors, setErrors] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listSites().then(setSites, () => undefined);
  }, []);

  const set = <K extends keyof IncidentForm>(key: K, value: IncidentForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const bad = (k: string) => (errors.has(k) ? t('safety.report.failed') : undefined);

  const submit = async () => {
    const local = new Set<string>();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.occurred_on) || form.occurred_on > today())
      local.add('occurred_on');
    if (form.description.trim().length < 20) local.add('description');
    if (form.injured && form.injury_details.trim() && !form.special_category_consent)
      local.add('special_category_consent');
    setErrors(local);
    if (local.size) {
      setMessage(t('safety.report.failed'));
      return;
    }
    setBusy(true);
    setMessage(null);
    const result = await submitIncident(form);
    setBusy(false);
    if (result.ok) {
      onSent();
      return;
    }
    setErrors(new Set(result.fields));
    setMessage(
      result.error === 'offline'
        ? t('common.offline')
        : result.error === 'safety.report.encryptionMissing'
          ? t('safety.report.encryptionMissing')
          : t('safety.report.failed'),
    );
  };

  return (
    <ScrollView contentContainerStyle={screenStyles.page} keyboardShouldPersistTaps="handled">
      <BackBar label={t('nav.safety')} onBack={onBack} />
      <Title>{t('safety.report.title')}</Title>
      <Body muted>{t('safety.report.lead')}</Body>
      <View style={[s.emergency, { borderColor: c.danger }]}>
        <Text style={{ color: c.danger, fontWeight: '700', fontSize: 16 }}>
          {t('safety.report.emergency')}
        </Text>
      </View>

      <Text style={[s.label, { color: c.text }]}>{t('safety.report.who')}</Text>
      {INCIDENT_ANONYMITY.map((a) => {
        const on = form.anonymity === a;
        return (
          <Pressable
            key={a}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => set('anonymity', a)}
            style={[
              s.option,
              { borderColor: on ? c.primary : c.border, backgroundColor: on ? c.card : c.bg },
            ]}
          >
            <Text style={[s.optionTitle, { color: c.text }]}>
              {on ? '● ' : '○ '}
              {t(`safety.anonymity.${a}`)}
            </Text>
            <Meta>{t(`safety.report.anonymityHelp.${a}`)}</Meta>
          </Pressable>
        );
      })}

      <Field
        label={t('safety.report.date')}
        value={form.occurred_on}
        onChangeText={(v) => set('occurred_on', v)}
        placeholder="2026-10-30"
        keyboardType="numbers-and-punctuation"
        maxLength={10}
        error={bad('occurred_on')}
      />
      <Chips
        label={t('safety.report.site')}
        options={[
          ...sites.map((site) => ({ value: site.id, label: site.name })),
          { value: null, label: t('safety.report.otherSite') },
        ]}
        value={form.site_id}
        onChange={(v) => set('site_id', v)}
      />
      {form.site_id === null ? (
        <Field
          label={t('safety.report.siteName')}
          value={form.site_name}
          onChangeText={(v) => set('site_name', v)}
          maxLength={120}
        />
      ) : null}
      <Chips
        label={t('safety.report.category')}
        options={INCIDENT_CATEGORIES.map((cat) => ({
          value: cat,
          label: t(`safety.categories.${cat}`),
        }))}
        value={form.category}
        onChange={(v) => v && set('category', v)}
      />
      <Segmented
        label={t('safety.report.severity')}
        options={INCIDENT_SEVERITIES.map((sev) => ({
          value: sev,
          label: t(`safety.severities.${sev}`),
        }))}
        value={form.severity}
        onChange={(v) => set('severity', v)}
      />
      <Field
        label={t('safety.report.description')}
        value={form.description}
        onChangeText={(v) => set('description', v)}
        multiline
        maxLength={8000}
        error={bad('description')}
      />
      <Meta>{t('safety.report.descriptionHelp')}</Meta>
      <Field
        label={t('safety.report.conditions')}
        value={form.conditions}
        onChangeText={(v) => set('conditions', v)}
        multiline
        maxLength={2000}
        placeholder={t('safety.report.conditionsHelp')}
      />
      <Field
        label={t('safety.report.equipment')}
        value={form.equipment}
        onChangeText={(v) => set('equipment', v)}
        maxLength={500}
        placeholder={t('safety.report.equipmentHelp')}
      />
      <Field
        label={t('safety.report.lessons')}
        value={form.lessons}
        onChangeText={(v) => set('lessons', v)}
        multiline
        maxLength={4000}
        placeholder={t('safety.report.lessonsHelp')}
      />
      <Meta>{t('safety.report.noNames')}</Meta>

      <Toggle
        label={t('safety.report.injured')}
        value={form.injured}
        onChange={(v) => set('injured', v)}
      />
      {form.injured ? (
        <View style={[s.injury, { borderColor: c.border, backgroundColor: c.card }]}>
          <Meta>{t('safety.report.injuryIntro')}</Meta>
          <Toggle
            label={t('safety.report.injuryConsent')}
            value={form.special_category_consent}
            onChange={(v) => set('special_category_consent', v)}
          />
          {form.special_category_consent ? (
            <>
              <Field
                label={t('safety.report.injuryDetails')}
                value={form.injury_details}
                onChangeText={(v) => set('injury_details', v)}
                multiline
                maxLength={4000}
                placeholder={t('safety.report.injuryDetailsHelp')}
              />
            </>
          ) : (
            <Meta>{t('safety.report.consentNeeded')}</Meta>
          )}
          {errors.has('special_category_consent') ? (
            <Text style={{ color: c.danger }}>{t('safety.report.consentNeeded')}</Text>
          ) : null}
        </View>
      ) : null}
      {form.anonymity !== 'fully_anonymous' ? (
        <Toggle
          label={t('safety.report.contactOk')}
          value={form.contact_ok}
          onChange={(v) => set('contact_ok', v)}
        />
      ) : null}

      <Button label={t('safety.report.submit')} busy={busy} onPress={() => void submit()} />
      {message ? (
        <Text style={{ color: c.danger, fontSize: 16 }} accessibilityLiveRegion="polite">
          {message}
        </Text>
      ) : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  actions: { marginVertical: 8 },
  sent: { borderWidth: 1, borderRadius: 12, padding: 12, marginVertical: 8 },
  h2: { fontSize: 20, fontWeight: '800', marginTop: 20, marginBottom: 8 },
  report: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10, gap: 6 },
  reportTitle: { fontSize: 16, fontWeight: '700' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  emergency: { borderWidth: 1, borderRadius: 12, padding: 12, marginVertical: 10 },
  label: { fontSize: 16, fontWeight: '600', marginTop: 8, marginBottom: 4 },
  option: { borderWidth: 1, borderRadius: 12, padding: 12, marginVertical: 4, minHeight: 44 },
  optionTitle: { fontSize: 16, fontWeight: '700' },
  injury: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
    marginVertical: 6,
  },
});
