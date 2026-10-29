import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { CONFIG } from '../config';
import { locale, t, type MessageKey } from '../i18n';
import { dateTime, duration, km, signed } from '../format';
import { removeFlight, subscribeFlights, type LocalFlight } from '../tracker/flights';
import { uploadPending } from '../upload';
import { Body, Button, Card, Title } from '../ui/kit';
import { useTheme } from '../ui/theme';

function status(f: LocalFlight, signedIn: boolean): MessageKey {
  if (f.remoteId) return 'flights.uploaded';
  if (!signedIn) return 'flights.pending';
  if (f.uploadError === 'onboarding') return 'flights.onboarding';
  if (f.uploadError === 'noFlight') return 'flights.noFlight';
  if (f.uploadError === 'offline') return 'flights.pending';
  return f.uploadError ? 'flights.failed' : 'flights.pending';
}

export function FlightsScreen({ signedIn }: { signedIn: boolean }) {
  const c = useTheme();
  const [flights, setFlights] = useState<LocalFlight[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeFlights((list) => setFlights([...list])), []);

  async function upload() {
    setBusy(true);
    await uploadPending().finally(() => setBusy(false));
  }

  const selected = flights.find((f) => f.id === open);
  if (selected) {
    return (
      <View style={s.page}>
        <Button label={t('flights.back')} kind="secondary" onPress={() => setOpen(null)} />
        <Title>{dateTime(selected.startedAt)}</Title>
        <Card>
          <Row label={t('flights.duration')} value={duration(selected.durationS)} />
          <Row label={t('flights.maxAlt')} value={`${selected.maxAltM} m`} />
          <Row label={t('flights.distance')} value={km(selected.distanceM)} />
          <Row label={t('flights.maxClimb')} value={`${signed(selected.maxClimbMs)} m/s`} />
        </Card>
        <Body muted>{t(status(selected, signedIn))}</Body>
        <Button
          label={t('flights.share')}
          onPress={() =>
            void Sharing.shareAsync(selected.igcUri, {
              mimeType: 'application/octet-stream',
              UTI: 'public.data',
              dialogTitle: t('flights.share'),
            })
          }
        />
        {selected.remoteId ? (
          <Button
            label={t('flights.openLogbook')}
            kind="secondary"
            onPress={() =>
              void WebBrowser.openBrowserAsync(
                `${CONFIG.webUrl}/${locale}/flights/${selected.remoteId}`,
              )
            }
          />
        ) : signedIn ? (
          <Button
            label={t('flights.uploadAll')}
            kind="secondary"
            busy={busy}
            onPress={() => void upload()}
          />
        ) : null}
        <Button
          label={t('flights.delete')}
          kind="danger"
          onPress={() =>
            Alert.alert(t('flights.deleteConfirm'), undefined, [
              { text: t('common.cancel'), style: 'cancel' },
              {
                text: t('flights.delete'),
                style: 'destructive',
                onPress: () => {
                  setOpen(null);
                  void removeFlight(selected.id);
                },
              },
            ])
          }
        />
      </View>
    );
  }

  const waiting = signedIn && flights.some((f) => !f.remoteId);
  return (
    <FlatList
      contentContainerStyle={s.page}
      data={flights}
      keyExtractor={(f) => f.id}
      refreshControl={<RefreshControl refreshing={busy} onRefresh={() => void upload()} />}
      ListHeaderComponent={
        <View>
          <Title>{t('flights.title')}</Title>
          {!signedIn ? <Body muted>{t('flights.signInToUpload')}</Body> : null}
          {waiting ? (
            <Button
              label={t('flights.uploadAll')}
              kind="secondary"
              busy={busy}
              onPress={() => void upload()}
            />
          ) : null}
        </View>
      }
      ListEmptyComponent={<Body muted>{t('flights.empty')}</Body>}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          onPress={() => setOpen(item.id)}
          style={({ pressed }) => [
            s.item,
            { borderColor: c.border, backgroundColor: c.card, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Text style={[s.itemTitle, { color: c.text }]}>{dateTime(item.startedAt)}</Text>
          <Text style={[s.itemMeta, { color: c.muted }]}>
            {duration(item.durationS)} · {item.maxAltM} m · {km(item.distanceM)}
          </Text>
          <Text style={[s.itemMeta, { color: item.remoteId ? c.climb : c.muted }]}>
            {t(status(item, signedIn))}
          </Text>
        </Pressable>
      )}
    />
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const c = useTheme();
  return (
    <View style={s.row}>
      <Text style={[s.rowLabel, { color: c.muted }]}>{label}</Text>
      <Text style={[s.rowValue, { color: c.text }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  page: { padding: 16, gap: 8 },
  item: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
    minHeight: 64,
    gap: 2,
  },
  itemTitle: { fontSize: 17, fontWeight: '600' },
  itemMeta: { fontSize: 15 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  rowLabel: { fontSize: 16 },
  rowValue: { fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
