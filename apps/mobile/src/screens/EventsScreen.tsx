import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { t, type MessageKey } from '../i18n';
import {
  RSVP_STATUSES,
  dateTimeLabel,
  listEvents,
  loadEvent,
  rsvp,
  rsvpOpen,
  type EventDetail,
  type EventItem,
  type RsvpStatus,
} from '../content';
import { Badge, Body, Button, Segmented, Title } from '../ui/kit';
import { Markdown } from '../ui/markdown';
import { BackBar, Fact, Meta, Row, screenStyles } from '../ui/screen';
import { useTheme } from '../ui/theme';

const kindLabel = (kind: string) => t(`events.kinds.${kind}` as MessageKey);

/** "Etkinlikler": club events with RSVP, as on the website. */
export function EventsScreen({
  userId,
  onBack,
  initialId,
}: {
  userId: string | null;
  onBack: () => void;
  initialId?: string | null;
}) {
  const [past, setPast] = useState(false);
  const [items, setItems] = useState<EventItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<string | null>(initialId ?? null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setItems(await listEvents(past));
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, [past]);

  useEffect(() => {
    void load();
  }, [load, userId]);

  if (open) return <EventView id={open} userId={userId} onBack={() => setOpen(null)} />;

  return (
    <FlatList
      contentContainerStyle={screenStyles.page}
      data={items ?? []}
      keyExtractor={(e) => e.id}
      refreshControl={<RefreshControl refreshing={busy} onRefresh={() => void load()} />}
      ListHeaderComponent={
        <View>
          <BackBar onBack={onBack} />
          <Title>{t('nav.events')}</Title>
          <Body muted>{t('events.lead')}</Body>
          <Segmented
            label={t('events.show')}
            options={[
              { value: 'upcoming', label: t('events.upcoming') },
              { value: 'past', label: t('events.past') },
            ]}
            value={past ? 'past' : 'upcoming'}
            onChange={(v) => setPast(v === 'past')}
          />
          {failed ? <Body muted>{t('common.offline')}</Body> : null}
          {busy && !items ? <ActivityIndicator /> : null}
          {items?.length === 0 ? (
            <Body muted>{past ? t('events.noPast') : t('events.empty')}</Body>
          ) : null}
        </View>
      }
      renderItem={({ item: e }) => <EventRow event={e} onPress={() => setOpen(e.id)} />}
    />
  );
}

export function EventRow({ event: e, onPress }: { event: EventItem; onPress: () => void }) {
  return (
    <Row
      title={e.title}
      struck={e.status === 'cancelled'}
      meta={[dateTimeLabel(e.startsAt), e.place].filter(Boolean).join(' · ')}
      badges={
        <>
          <Badge label={kindLabel(e.kind)} tone="strong" />
          {e.membersOnly ? <Badge label={t('events.membersOnly')} /> : null}
          {e.status === 'cancelled' ? <Badge label={t('events.cancelled')} /> : null}
        </>
      }
      onPress={onPress}
    />
  );
}

function EventView({
  id,
  userId,
  onBack,
}: {
  id: string;
  userId: string | null;
  onBack: () => void;
}) {
  const c = useTheme();
  const [e, setE] = useState<EventDetail | null | undefined>(undefined);
  const [choice, setChoice] = useState<RsvpStatus>('going');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await loadEvent(id);
      setE(d);
      if (d?.mine) setChoice(d.mine);
      setNote(d?.note ?? '');
    } catch {
      setE(null);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!e)
    return (
      <View style={screenStyles.page}>
        <BackBar label={t('nav.events')} onBack={onBack} />
        {e === undefined ? <ActivityIndicator /> : <Body muted>{t('common.error')}</Body>}
      </View>
    );

  const answer = async (status: RsvpStatus | 'withdraw') => {
    setBusy(true);
    setMessage(null);
    try {
      await rsvp(e.id, status, note);
      setMessage(t('events.saved'));
      await load();
    } catch (err) {
      const key = err instanceof Error ? err.message : 'generic';
      setMessage(
        key === 'events.full'
          ? t('events.full')
          : key === 'events.closed'
            ? t('events.closed')
            : t('common.error'),
      );
    } finally {
      setBusy(false);
    }
  };

  const open = rsvpOpen(e);
  return (
    <ScrollView contentContainerStyle={screenStyles.page} keyboardShouldPersistTaps="handled">
      <BackBar label={t('nav.events')} onBack={onBack} />
      <View style={s.badges}>
        <Badge label={kindLabel(e.kind)} tone="strong" />
        {e.membersOnly ? <Badge label={t('events.membersOnly')} /> : null}
      </View>
      <Title>{e.title}</Title>
      {e.status === 'cancelled' ? (
        <Body>
          <Body muted>{t('events.cancelledNotice')}</Body>
        </Body>
      ) : null}
      <View style={[screenStyles.facts, { borderColor: c.border }]}>
        <Fact
          label={t('events.when')}
          value={`${dateTimeLabel(e.startsAt)} – ${dateTimeLabel(e.endsAt)}`}
        />
        {e.place ? <Fact label={t('events.where')} value={e.place} /> : null}
        <Fact
          label={t('events.yourAnswer')}
          value={
            t('events.counts', { going: e.going, maybe: e.maybe }) +
            (e.capacity ? ` · ${t('events.capacity', { capacity: e.capacity })}` : '')
          }
        />
        {e.rsvpDeadline ? (
          <Meta>{t('events.deadline', { date: dateTimeLabel(e.rsvpDeadline) })}</Meta>
        ) : null}
      </View>
      <Markdown>{e.description}</Markdown>

      {!userId ? (
        <Body muted>{t('events.signIn')}</Body>
      ) : open ? (
        <View style={[s.form, { borderColor: c.border, backgroundColor: c.card }]}>
          <Segmented
            label={t('events.yourAnswer')}
            options={RSVP_STATUSES.map((r) => ({ value: r, label: t(`events.rsvp.${r}`) }))}
            value={choice}
            onChange={setChoice}
          />
          <TextInput
            accessibilityLabel={t('events.note')}
            placeholder={t('events.note')}
            placeholderTextColor={c.muted}
            value={note}
            onChangeText={setNote}
            maxLength={300}
            style={[s.input, { color: c.text, borderColor: c.border, backgroundColor: c.bg }]}
          />
          <Button label={t('events.send')} busy={busy} onPress={() => void answer(choice)} />
          {e.mine ? (
            <Button
              label={t('events.withdraw')}
              kind="secondary"
              disabled={busy}
              onPress={() => void answer('withdraw')}
            />
          ) : null}
          {message ? <Body>{message}</Body> : null}
        </View>
      ) : (
        <Body muted>{t('events.closed')}</Body>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  form: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, marginTop: 12 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 16,
    marginVertical: 8,
  },
});
