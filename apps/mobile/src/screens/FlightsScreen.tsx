import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { t, type MessageKey } from '../i18n';
import { dateTime, duration, km } from '../format';
import { loadLogbook, type LogbookFlight, type Totals } from '../logbook';
import { subscribeFlights, type LocalFlight } from '../tracker/flights';
import { uploadPending } from '../upload';
import { Body, Button, Card, Title } from '../ui/kit';
import { useTheme } from '../ui/theme';
import { FlightDetailScreen } from './FlightDetailScreen';

function status(f: LocalFlight, signedIn: boolean): MessageKey {
  if (!signedIn) return 'flights.pending';
  if (f.uploadError === 'onboarding') return 'flights.onboarding';
  if (f.uploadError === 'noFlight') return 'flights.noFlight';
  if (f.uploadError === 'offline') return 'flights.pending';
  return f.uploadError ? 'flights.failed' : 'flights.pending';
}

/** The logbook: every flight in the pilot's logbook plus those still only on this phone. */
export function FlightsScreen({ userId }: { userId: string | null }) {
  const c = useTheme();
  const signedIn = userId !== null;
  const [local, setLocal] = useState<LocalFlight[]>([]);
  const [flights, setFlights] = useState<LogbookFlight[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [open, setOpen] = useState<LogbookFlight | null>(null);
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => subscribeFlights((list) => setLocal([...list])), []);

  const reload = useCallback(async () => {
    try {
      const result = await loadLogbook(userId, local);
      setFlights(result.flights);
      setTotals(result.totals);
      setOffline(false);
    } catch {
      // Offline: still show what is on the phone.
      const result = await loadLogbook(null, local);
      setFlights(result.flights);
      setOffline(true);
    }
  }, [userId, local]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function refresh() {
    setBusy(true);
    if (signedIn) await uploadPending().catch(() => undefined);
    await reload().finally(() => setBusy(false));
  }

  if (open) {
    return (
      <FlightDetailScreen
        flight={open}
        signedIn={signedIn}
        onBack={() => setOpen(null)}
        onChanged={() => void reload()}
      />
    );
  }

  const waiting = signedIn && flights.some((f) => !f.id);
  return (
    <FlatList
      contentContainerStyle={s.page}
      data={flights}
      keyExtractor={(f) => f.id ?? `local-${f.local?.id ?? f.startedAt}`}
      refreshControl={<RefreshControl refreshing={busy} onRefresh={() => void refresh()} />}
      ListHeaderComponent={
        <View>
          <Title>{t('flights.title')}</Title>
          {totals ? (
            <View style={s.totals}>
              <Card style={s.total}>
                <Text style={[s.totalValue, { color: c.text }]}>
                  {totals.hours.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                </Text>
                <Text style={[s.totalLabel, { color: c.muted }]}>{t('flights.totalHours')}</Text>
              </Card>
              <Card style={s.total}>
                <Text style={[s.totalValue, { color: c.text }]}>{totals.flights}</Text>
                <Text style={[s.totalLabel, { color: c.muted }]}>{t('flights.totalFlights')}</Text>
              </Card>
            </View>
          ) : null}
          {!signedIn ? <Body muted>{t('flights.signInToUpload')}</Body> : null}
          {offline ? <Body muted>{t('common.offline')}</Body> : null}
          {waiting ? (
            <Button
              label={t('flights.uploadAll')}
              kind="secondary"
              busy={busy}
              onPress={() => void refresh()}
            />
          ) : null}
        </View>
      }
      ListEmptyComponent={<Body muted>{t('flights.empty')}</Body>}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          onPress={() => setOpen(item)}
          style={({ pressed }) => [
            s.item,
            { borderColor: c.border, backgroundColor: c.card, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Text style={[s.itemTitle, { color: c.text }]}>{dateTime(item.startedAt)}</Text>
          {item.site ? (
            <Text style={[s.itemMeta, { color: c.text }]} numberOfLines={1}>
              {item.site}
            </Text>
          ) : null}
          <Text style={[s.itemMeta, { color: c.muted }]}>
            {[
              duration(item.durationS),
              item.maxAltM != null ? `${item.maxAltM} m` : null,
              item.xcDistanceM != null
                ? `XC ${km(item.xcDistanceM)}`
                : item.distanceM != null
                  ? km(item.distanceM)
                  : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          {item.id === null && item.local ? (
            <Text style={[s.itemMeta, { color: c.muted }]}>{t(status(item.local, signedIn))}</Text>
          ) : null}
        </Pressable>
      )}
    />
  );
}

const s = StyleSheet.create({
  page: { padding: 16, gap: 8 },
  totals: { flexDirection: 'row', gap: 8 },
  total: { flex: 1, alignItems: 'center' },
  totalValue: { fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
  totalLabel: { fontSize: 14, fontWeight: '600' },
  item: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
    minHeight: 64,
    gap: 2,
  },
  itemTitle: { fontSize: 17, fontWeight: '600' },
  itemMeta: { fontSize: 15 },
});
