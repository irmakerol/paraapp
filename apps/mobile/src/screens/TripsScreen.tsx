import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { locale, t, type MessageKey } from '../i18n';
import { dateLabel, dateTimeLabel, dayLabel } from '../content';
import { money } from '../board';
import {
  cancelRegistration,
  listTrips,
  loadTrip,
  register,
  registrationOpen,
  setInterest,
  updateRegistration,
  validPhone,
  type TripDetail,
  type TripItem,
} from '../trips';
import { Badge, Body, Button, Field, Segmented, Stepper, Title, Toggle } from '../ui/kit';
import { Markdown } from '../ui/markdown';
import { BackBar, Fact, Meta, Row, screenStyles } from '../ui/screen';
import { useTheme } from '../ui/theme';

type View_ = 'upcoming' | 'past' | 'mine';

const levelName = (l: string) => l.toUpperCase();
const range = (a: string, b: string) => (a === b ? dayLabel(a) : `${dayLabel(a)} – ${dayLabel(b)}`);
const days = (a: string, b: string) =>
  Math.round(
    (new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 86_400_000,
  ) + 1;
const errorText = (e: unknown) =>
  t(`trips.errors.${e instanceof Error ? e.message : 'generic'}` as MessageKey);

/** "Geziler": club trips with interest, sign-up and the waiting list, as on the website. */
export function TripsScreen({ userId, onBack }: { userId: string | null; onBack: () => void }) {
  const [view, setView] = useState<View_>('upcoming');
  const [items, setItems] = useState<TripItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setItems(await listTrips(view));
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, [view]);

  useEffect(() => {
    void load();
  }, [load, userId]);

  if (open)
    return (
      <TripView
        id={open}
        userId={userId}
        onBack={() => {
          setOpen(null);
          void load();
        }}
      />
    );

  const empty =
    view === 'past' ? t('trips.noPast') : view === 'mine' ? t('trips.noMine') : t('trips.empty');
  return (
    <FlatList
      contentContainerStyle={screenStyles.page}
      data={items ?? []}
      keyExtractor={(i) => i.id}
      refreshControl={<RefreshControl refreshing={busy} onRefresh={() => void load()} />}
      ListHeaderComponent={
        <View>
          <BackBar onBack={onBack} />
          <Title>{t('nav.trips')}</Title>
          <Body muted>{t('trips.lead')}</Body>
          <Segmented
            label={t('trips.show')}
            options={[
              { value: 'upcoming' as View_, label: t('trips.upcoming') },
              { value: 'past' as View_, label: t('trips.past') },
              ...(userId ? [{ value: 'mine' as View_, label: t('trips.mine') }] : []),
            ]}
            value={view}
            onChange={setView}
          />
          {failed ? <Body muted>{t('common.offline')}</Body> : null}
          {busy && !items ? <ActivityIndicator /> : null}
          {items?.length === 0 ? <Body muted>{empty}</Body> : null}
        </View>
      }
      renderItem={({ item: trip }) => (
        <Row
          title={trip.title}
          image={trip.cover}
          struck={trip.status === 'cancelled'}
          meta={[range(trip.startsOn, trip.endsOn), trip.destination].filter(Boolean).join(' · ')}
          summary={trip.summary}
          badges={
            <>
              {trip.price != null ? (
                <Badge label={money(trip.price, trip.currency, locale)} tone="strong" />
              ) : null}
              {trip.minLevel ? <Badge label={`${levelName(trip.minLevel)}+`} /> : null}
              {trip.membersOnly ? <Badge label={t('trips.membersOnly')} /> : null}
            </>
          }
          onPress={() => setOpen(trip.id)}
        />
      )}
    />
  );
}

function TripView({
  id,
  userId,
  onBack,
}: {
  id: string;
  userId: string | null;
  onBack: () => void;
}) {
  const c = useTheme();
  const [trip, setTrip] = useState<TripDetail | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setTrip(await loadTrip(id));
    } catch {
      setTrip(null);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!trip)
    return (
      <View style={screenStyles.page}>
        <BackBar label={t('nav.trips')} onBack={onBack} />
        {trip === undefined ? <ActivityIndicator /> : <Body muted>{t('common.error')}</Body>}
      </View>
    );

  const price = (n: number | null) => (n == null ? null : money(n, trip.currency, locale));
  const active = trip.mine && !['cancelled', 'declined'].includes(trip.mine.status);
  const open = registrationOpen(trip);

  const toggleInterest = async () => {
    setBusy(true);
    try {
      await setInterest(trip.id, !trip.interested);
      await load();
    } catch (e) {
      Alert.alert(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const cancel = () =>
    Alert.alert(t('trips.cancelRegistration'), t('trips.cancelConfirm'), [
      { text: t('common.no'), style: 'cancel' },
      {
        text: t('trips.cancelRegistration'),
        style: 'destructive',
        onPress: () =>
          void cancelRegistration(trip.id).then(load, (e: unknown) => Alert.alert(errorText(e))),
      },
    ]);

  return (
    <ScrollView contentContainerStyle={screenStyles.page} keyboardShouldPersistTaps="handled">
      <BackBar label={t('nav.trips')} onBack={onBack} />
      {trip.cover ? (
        <Image source={{ uri: trip.cover }} style={screenStyles.hero} resizeMode="cover" />
      ) : null}
      <Meta>
        {[trip.destination, trip.membersOnly ? t('trips.membersOnly') : null]
          .filter(Boolean)
          .join(' · ')}
      </Meta>
      <Title>{trip.title}</Title>
      <Text style={[s.lead, { color: c.text }]}>
        {range(trip.startsOn, trip.endsOn)} ·{' '}
        {t('trips.days', { count: days(trip.startsOn, trip.endsOn) })}
      </Text>
      {trip.summary ? <Body muted>{trip.summary}</Body> : null}
      {trip.status === 'cancelled' ? (
        <View style={[s.notice, { borderColor: c.danger }]}>
          <Text style={{ color: c.danger, fontWeight: '700' }}>{t('trips.cancelledNotice')}</Text>
        </View>
      ) : null}

      {/* Seats and actions first: that is what people open a trip for. */}
      <View style={[s.box, { borderColor: c.border, backgroundColor: c.card }]}>
        <Text style={[s.seats, { color: c.text }]}>
          {trip.seatsLeft > 0
            ? t('trips.seatsLeft', { count: trip.seatsLeft, max: trip.maxPilots })
            : t('trips.full')}
        </Text>
        <Meta>
          {[
            trip.waitlisted ? t('trips.waitlistCount', { count: trip.waitlisted }) : null,
            t('trips.interestedCount', { count: trip.interestedCount }),
          ]
            .filter(Boolean)
            .join(' · ')}
        </Meta>
        {trip.deadline ? (
          <Meta>{t('trips.deadline', { date: dateTimeLabel(trip.deadline) })}</Meta>
        ) : null}
        {trip.opensAt && new Date(trip.opensAt).getTime() > Date.now() ? (
          <Meta>{t('trips.opensAt', { date: dateTimeLabel(trip.opensAt) })}</Meta>
        ) : null}

        {!userId ? (
          <Body muted>{t('trips.signIn')}</Body>
        ) : (
          <>
            {trip.mine ? (
              <View style={s.status}>
                <Text style={[s.statusTitle, { color: c.text }]}>
                  {t('trips.yourRegistration')}: {t(`trips.status.${trip.mine.status}`)}
                </Text>
                <Meta>{t(`trips.statusHelp.${trip.mine.status}`)}</Meta>
                {active ? (
                  <Meta>
                    {t('trips.payment')}:{' '}
                    {t(`trips.paymentStatus.${trip.mine.payment}` as MessageKey)}
                  </Meta>
                ) : null}
              </View>
            ) : null}
            {!active ? (
              <>
                <Button
                  label={trip.interested ? t('trips.interested') : t('trips.showInterest')}
                  kind={trip.interested ? 'primary' : 'secondary'}
                  busy={busy}
                  onPress={() => void toggleInterest()}
                />
                <Meta>{t('trips.interestHelp')}</Meta>
              </>
            ) : null}
            {active ? (
              <>
                <RegistrationForm trip={trip} onDone={load} />
                <Button label={t('trips.cancelRegistration')} kind="danger" onPress={cancel} />
              </>
            ) : open && trip.mine?.status !== 'declined' ? (
              <RegistrationForm trip={trip} onDone={load} />
            ) : !open ? (
              <Body muted>{t('trips.closedNotice')}</Body>
            ) : null}
          </>
        )}
      </View>

      {trip.description ? <Markdown>{trip.description}</Markdown> : null}

      {trip.sites.length ? (
        <Section title={t('trips.sites')}>
          {trip.sites.map((site) => (
            <Fact key={site.id} label={site.region ?? ''} value={site.name} />
          ))}
        </Section>
      ) : null}
      {trip.itinerary ? (
        <Section title={t('trips.itinerary')}>
          <Markdown>{trip.itinerary}</Markdown>
        </Section>
      ) : null}
      <Section title={t('trips.requirements')}>
        {trip.minLevel ? (
          <Bullet text={t('trips.minLevel', { level: levelName(trip.minLevel) })} />
        ) : null}
        {trip.minYears != null ? (
          <Bullet text={t('trips.minYears', { count: trip.minYears })} />
        ) : null}
        {trip.minFlights != null ? (
          <Bullet text={t('trips.minFlights', { count: trip.minFlights })} />
        ) : null}
        {trip.equipment.map((e) => (
          <Bullet key={e} text={t(`trips.equipment.${e}` as MessageKey)} />
        ))}
        <Bullet text={trip.allowMinors ? t('trips.minorsAllowed') : t('trips.adultsOnly')} />
        {trip.requirements ? <Markdown>{trip.requirements}</Markdown> : null}
      </Section>
      {trip.guides.length ? (
        <Section title={t('trips.guides')}>
          {trip.guides.map((g) => (
            <Fact key={g.id} label={g.role ?? ''} value={g.name ?? '—'} />
          ))}
        </Section>
      ) : null}
      <Section title={t('trips.price')}>
        <Fact label={t('trips.price')} value={price(trip.price) ?? t('trips.priceTbd')} />
        {trip.deposit != null ? (
          <Fact label={t('trips.deposit')} value={price(trip.deposit) ?? ''} />
        ) : null}
        {trip.paymentDeadline ? (
          <Fact
            label={t('trips.paymentDeadline')}
            value={dateLabel(`${trip.paymentDeadline}T12:00:00`)}
          />
        ) : null}
        {trip.includes ? <Fact label={t('trips.includes')} value={trip.includes} /> : null}
        {trip.excludes ? <Fact label={t('trips.excludes')} value={trip.excludes} /> : null}
        {active && trip.paymentInfo ? <Markdown>{trip.paymentInfo}</Markdown> : null}
        {trip.cancellation ? (
          <Fact label={t('trips.cancellationPolicy')} value={trip.cancellation} />
        ) : null}
        <Meta>{t('trips.paymentOffline')}</Meta>
      </Section>
      {trip.meetingPoint || trip.meetingAt || trip.accommodation || trip.transport ? (
        <Section title={t('trips.meeting')}>
          {trip.meetingPoint || trip.meetingAt ? (
            <Fact
              label={t('trips.meeting')}
              value={[trip.meetingPoint, trip.meetingAt ? dateTimeLabel(trip.meetingAt) : null]
                .filter(Boolean)
                .join(' · ')}
            />
          ) : null}
          {trip.accommodation ? (
            <Fact label={t('trips.accommodation')} value={trip.accommodation} />
          ) : null}
          {trip.transport ? <Fact label={t('trips.transport')} value={trip.transport} /> : null}
        </Section>
      ) : null}
    </ScrollView>
  );
}

/** Sign-up form; for an active registration it edits the contact details instead. */
function RegistrationForm({ trip, onDone }: { trip: TripDetail; onDone: () => Promise<void> }) {
  const c = useTheme();
  const editing = Boolean(trip.mine && !['cancelled', 'declined'].includes(trip.mine.status));
  const [phone, setPhone] = useState(trip.mine?.phone ?? '');
  const [emergencyName, setEmergencyName] = useState(trip.mine?.emergencyName ?? '');
  const [emergencyPhone, setEmergencyPhone] = useState(trip.mine?.emergencyPhone ?? '');
  const [note, setNote] = useState(trip.mine?.note ?? '');
  const [companions, setCompanions] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const phoneError = validPhone(phone) ? undefined : t('trips.phoneInvalid');
  const emergencyError = validPhone(emergencyPhone) ? undefined : t('trips.phoneInvalid');

  const submit = async () => {
    if (phoneError || emergencyError) return;
    if (!editing && !confirm) {
      setMessage(t('trips.confirmRequired'));
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      if (editing) {
        await updateRegistration(trip.id, { phone, emergencyName, emergencyPhone, note });
        setMessage(t('trips.saved'));
      } else {
        await register(trip.id, { phone, emergencyName, emergencyPhone, note, companions });
      }
      await onDone();
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[s.form, { borderColor: c.border }]}>
      {!editing && trip.seatsLeft === 0 ? <Body>{t('trips.waitlistNotice')}</Body> : null}
      <Field
        label={t('trips.phone')}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoComplete="tel"
        maxLength={30}
        error={phoneError}
      />
      <Meta>{t('trips.phoneHelp')}</Meta>
      <Field
        label={t('trips.emergencyName')}
        value={emergencyName}
        onChangeText={setEmergencyName}
        maxLength={100}
      />
      <Field
        label={t('trips.emergencyPhone')}
        value={emergencyPhone}
        onChangeText={setEmergencyPhone}
        keyboardType="phone-pad"
        maxLength={30}
        error={emergencyError}
      />
      <Field
        label={t('trips.note')}
        value={note}
        onChangeText={setNote}
        maxLength={500}
        multiline
      />
      {!editing && trip.companionsAllowed ? (
        <Stepper
          label={t('trips.companions')}
          value={String(companions)}
          onStep={(d) => setCompanions((n) => Math.max(0, Math.min(5, n + d)))}
          canDown={companions > 0}
          canUp={companions < 5}
        />
      ) : null}
      {!editing ? (
        <Toggle label={t('trips.confirm')} value={confirm} onChange={setConfirm} />
      ) : null}
      <Button
        label={
          editing
            ? t('trips.saveDetails')
            : trip.seatsLeft === 0
              ? t('trips.joinWaitlist')
              : t('trips.subscribe')
        }
        busy={busy}
        onPress={() => void submit()}
      />
      {!editing ? <Meta>{t('trips.subscribeHelp')}</Meta> : null}
      {message ? <Body>{message}</Body> : null}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const c = useTheme();
  return (
    <View style={[s.section, { borderColor: c.border }]}>
      <Text accessibilityRole="header" style={[s.h2, { color: c.text }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Bullet({ text }: { text: string }) {
  const c = useTheme();
  return (
    <View style={s.bullet}>
      <Text style={[s.bulletText, { color: c.muted }]}>•</Text>
      <Text style={[s.bulletText, { color: c.text, flex: 1 }]}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  lead: { fontSize: 18, fontWeight: '600', marginBottom: 6 },
  notice: { borderWidth: 1, borderRadius: 12, padding: 12, marginVertical: 8 },
  box: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
    marginVertical: 12,
    gap: 4,
  },
  seats: { fontSize: 20, fontWeight: '800' },
  status: { marginTop: 8, gap: 2 },
  statusTitle: { fontSize: 17, fontWeight: '700' },
  form: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 10, paddingTop: 6 },
  section: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 16, paddingTop: 8 },
  h2: { fontSize: 20, fontWeight: '800', marginBottom: 6 },
  bullet: { flexDirection: 'row', gap: 8, paddingVertical: 3 },
  bulletText: { fontSize: 16, lineHeight: 22 },
});
