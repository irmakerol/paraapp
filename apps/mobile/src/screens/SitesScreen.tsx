import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { locale, t, type MessageKey } from '../i18n';
import { compass, listSites, siteForecast, type Forecast, type Site } from '../sites';
import { Badge, Body, Button, Card, Segmented, Title } from '../ui/kit';
import { useTheme } from '../ui/theme';
import { BackBar } from '../ui/screen';

const PIN: Record<Site['kind'], string> = {
  launch: '#16a34a',
  landing: '#dc2626',
  both: '#0b5fb0',
};

const dirLabel = (d: string) => t(`sites.compass.${d}` as MessageKey);
const kmh = (v: number | null) => (v == null ? '—' : `${Math.round(v)}`);

/** Flying sites with real weather numbers (wind, gusts, direction, rain); pilots judge for themselves. */
export function SitesScreen({ onBack }: { onBack?: () => void }) {
  const c = useTheme();
  const [sites, setSites] = useState<Site[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Site | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setSites(await listSites());
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (open) return <SiteDetail site={open} onBack={() => setOpen(null)} />;

  return (
    <FlatList
      contentContainerStyle={s.page}
      data={sites ?? []}
      keyExtractor={(x) => x.id}
      refreshControl={<RefreshControl refreshing={busy} onRefresh={() => void load()} />}
      ListHeaderComponent={
        <View>
          {onBack ? <BackBar onBack={onBack} /> : null}
          <Title>{t('sites.title')}</Title>
          {failed ? <Body muted>{t('common.offline')}</Body> : null}
          {!sites && !failed ? <ActivityIndicator /> : null}
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          onPress={() => setOpen(item)}
          style={({ pressed }) => [
            s.item,
            { borderColor: c.border, backgroundColor: c.card, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <View style={s.itemHead}>
            <View style={[s.dot, { backgroundColor: PIN[item.kind] }]} />
            <Text style={[s.itemTitle, { color: c.text }]} numberOfLines={1}>
              {item.name}
            </Text>
          </View>
          <Text style={[s.itemMeta, { color: c.muted }]}>
            {[
              t(`sites.kinds.${item.kind}`),
              item.elevationM != null ? `${item.elevationM} m` : null,
              item.region,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          {item.windDirections.length ? (
            <Text style={[s.itemMeta, { color: c.muted }]}>
              {t('sites.windFrom')}: {item.windDirections.map(dirLabel).join(', ')}
            </Text>
          ) : null}
        </Pressable>
      )}
    />
  );
}

function SiteDetail({ site, onBack }: { site: Site; onBack: () => void }) {
  const c = useTheme();
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [day, setDay] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void siteForecast(site.id).then((f) => {
      if (!live) return;
      setForecast(f);
      setState(f ? 'ready' : 'failed');
      setDay(f?.days[0]?.date ?? null);
    });
    return () => {
      live = false;
    };
  }, [site.id]);

  const dayName = (date: string) =>
    new Date(`${date}T12:00:00`).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  const hours = (forecast?.hours ?? []).filter((h) => {
    const hour = Number(h.time.slice(11, 13));
    return h.time.startsWith(day ?? '') && hour >= 8 && hour <= 19;
  });

  return (
    <ScrollView contentContainerStyle={s.page}>
      <Button label={t('flights.back')} kind="secondary" onPress={onBack} />
      <Title>{site.name}</Title>
      <View style={s.badges}>
        <Badge label={t(`sites.kinds.${site.kind}`)} tone="strong" />
        {site.elevationM != null ? <Badge label={`${site.elevationM} m`} /> : null}
        {site.region ? <Badge label={site.region} /> : null}
      </View>
      <View style={[s.map, { borderColor: c.border }]}>
        <MapView
          style={StyleSheet.absoluteFill}
          mapType="hybrid"
          initialRegion={{
            latitude: site.lat,
            longitude: site.lng,
            latitudeDelta: 0.04,
            longitudeDelta: 0.04,
          }}
          accessibilityLabel={t('sites.mapLabel', { name: site.name })}
        >
          <Marker
            coordinate={{ latitude: site.lat, longitude: site.lng }}
            pinColor={PIN[site.kind]}
            title={site.name}
          />
        </MapView>
      </View>
      {site.windDirections.length ? (
        <Body>
          {t('sites.windFrom')}: {site.windDirections.map(dirLabel).join(', ')}
        </Body>
      ) : null}

      <Title>{t('sites.weather')}</Title>
      {state === 'loading' ? <ActivityIndicator /> : null}
      {state === 'failed' ? <Body muted>{t('sites.weatherUnavailable')}</Body> : null}
      {forecast ? (
        <>
          <View style={s.days}>
            {forecast.days.map((d) => (
              <Card key={d.date} style={s.dayCard}>
                <Text style={[s.dayName, { color: c.text }]}>{dayName(d.date)}</Text>
                <Text style={[s.dayValue, { color: c.text }]}>
                  {kmh(d.windMinKmh)}–{kmh(d.windMaxKmh)}
                  <Text style={s.unit}> km/h</Text>
                </Text>
                <Text style={[s.dayMeta, { color: c.muted }]}>
                  {t('sites.gusts')} {kmh(d.gustMaxKmh)}
                </Text>
                <View style={s.dirRow}>
                  <Text style={[s.dayMeta, { color: c.muted }]}>
                    {d.directionDeg != null ? dirLabel(compass(d.directionDeg)) : '—'}
                  </Text>
                  {d.directionDeg != null ? (
                    // Arrow points where the wind blows to.
                    <View style={{ transform: [{ rotate: `${d.directionDeg}deg` }] }}>
                      <Text style={[s.arrow, { color: c.text }]}>↓</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[s.dayMeta, { color: d.rainMm > 0.2 ? c.danger : c.muted }]}>
                  {t('sites.rain')} {d.rainMm.toFixed(1)} mm
                </Text>
              </Card>
            ))}
          </View>
          {forecast.days.length ? (
            <Segmented
              label={t('sites.hourly')}
              options={forecast.days.map((d) => ({ value: d.date, label: dayName(d.date) }))}
              value={day ?? forecast.days[0]?.date ?? ''}
              onChange={setDay}
            />
          ) : null}
          <Card>
            <View style={s.hourRow}>
              {['hour', 'wind', 'gusts', 'direction', 'rain'].map((k) => (
                <Text key={k} style={[s.hourHead, { color: c.muted }]}>
                  {t(`sites.columns.${k}` as MessageKey)}
                </Text>
              ))}
            </View>
            {hours.map((h) => (
              <View key={h.time} style={s.hourRow}>
                <Text style={[s.hourCell, { color: c.text }]}>{h.time.slice(11, 16)}</Text>
                <Text style={[s.hourCell, { color: c.text }]}>{kmh(h.windKmh)}</Text>
                <Text style={[s.hourCell, { color: c.text }]}>{kmh(h.gustKmh)}</Text>
                <Text style={[s.hourCell, { color: c.text }]}>
                  {h.directionDeg != null ? dirLabel(compass(h.directionDeg)) : '—'}
                </Text>
                <Text
                  style={[s.hourCell, { color: (h.precipitation ?? 0) > 0.2 ? c.danger : c.text }]}
                >
                  {h.precipitation != null ? h.precipitation.toFixed(1) : '—'}
                </Text>
              </View>
            ))}
          </Card>
          <Body muted>{t('sites.weatherNote')}</Body>
        </>
      ) : null}

      {site.description ? (
        <>
          <Title>{t('sites.about')}</Title>
          <Body>{site.description}</Body>
        </>
      ) : null}
      {site.rules ? (
        <>
          <Title>{t('sites.rules')}</Title>
          <Body>{site.rules}</Body>
        </>
      ) : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { padding: 16, gap: 8, paddingBottom: 40 },
  item: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, gap: 2 },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  itemTitle: { fontSize: 17, fontWeight: '600', flex: 1 },
  itemMeta: { fontSize: 15 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  map: { height: 220, borderRadius: 14, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  days: { flexDirection: 'row', gap: 8 },
  dayCard: { flex: 1, padding: 10, gap: 2 },
  dayName: { fontSize: 14, fontWeight: '700' },
  dayValue: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  unit: { fontSize: 12, fontWeight: '600' },
  dayMeta: { fontSize: 13 },
  dirRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  arrow: { fontSize: 16, fontWeight: '800' },
  hourRow: { flexDirection: 'row', paddingVertical: 5 },
  hourHead: { flex: 1, fontSize: 13, fontWeight: '700' },
  hourCell: { flex: 1, fontSize: 15, fontVariant: ['tabular-nums'] },
});
