import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Sharing from 'expo-sharing';
import type { TrackPoint } from '@paraapp/core-tracks';
import { t } from '../i18n';
import { dateTime, duration, km, signed } from '../format';
import { addToTotals, loadTrack, type LogbookFlight } from '../logbook';
import { frameAt } from '../replay';
import { removeFlight } from '../tracker/flights';
import { uploadPending } from '../upload';
import { AltitudeScrubber } from '../ui/altitude-scrubber';
import { Body, Button, Card, Segmented, Title } from '../ui/kit';
import { useTheme } from '../ui/theme';

const SPEEDS = ['1', '5', '10', '20', '50'] as const;
type Speed = (typeof SPEEDS)[number];
const TICK_MS = 200;
const MAX_LINE_POINTS = 1_500;

function clock(ms: number) {
  return new Date(ms).toTimeString().slice(0, 8);
}

/**
 * One flight: its numbers, and a replay on Apple Maps' 3D satellite view (free, no key) where the
 * camera flies behind the glider, Google Earth style. 2D shows the whole track from above.
 */
export function FlightDetailScreen({
  flight,
  signedIn,
  onBack,
  onChanged,
}: {
  flight: LogbookFlight;
  signedIn: boolean;
  onBack: () => void;
  onChanged: () => void;
}) {
  const c = useTheme();
  const { height } = useWindowDimensions();
  const map = useRef<MapView>(null);
  const [points, setPoints] = useState<TrackPoint[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>('10');
  const [view3d, setView3d] = useState(true);
  const [busy, setBusy] = useState(false);
  const [counted, setCounted] = useState(flight.countedInTotals);

  useEffect(() => {
    let live = true;
    loadTrack(flight)
      .then((p) => {
        if (!live) return;
        setPoints(p);
        setTime(p[0]?.t ?? 0);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [flight]);

  const start = points?.[0]?.t ?? 0;
  const end = points?.[points.length - 1]?.t ?? 0;
  const frame = useMemo(() => (points ? frameAt(points, time) : null), [points, time]);

  // Thinned line for the map; the flown part is drawn on top while replaying.
  const step = points ? Math.max(1, Math.ceil(points.length / MAX_LINE_POINTS)) : 1;
  const line = useMemo(
    () =>
      (points ?? [])
        .filter((_, i) => i % step === 0)
        .map((p) => ({ latitude: p.lat, longitude: p.lng })),
    [points, step],
  );
  const flown = frame
    ? [
        ...line.slice(0, Math.floor(frame.index / step) + 1),
        { latitude: frame.lat, longitude: frame.lng },
      ]
    : [];
  const first = points?.[0];
  const last = points?.[points.length - 1];

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setTime((now) => {
        const next = now + Number(speed) * TICK_MS;
        if (next >= end) {
          setPlaying(false);
          return end;
        }
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [playing, speed, end]);

  // 3D: the camera follows behind the glider, looking the way it flies.
  useEffect(() => {
    if (!view3d || !frame) return;
    map.current?.animateCamera(
      {
        center: { latitude: frame.lat, longitude: frame.lng },
        heading: frame.heading,
        pitch: 65,
        altitude: 1_400,
      },
      { duration: playing ? TICK_MS : 400 },
    );
  }, [view3d, frame, playing]);

  function overview() {
    if (line.length < 2) return;
    map.current?.fitToCoordinates(line, {
      edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
      animated: true,
    });
  }

  function toggleView(next3d: boolean) {
    setView3d(next3d);
    if (!next3d) {
      map.current?.animateCamera({ pitch: 0, heading: 0 }, { duration: 300 });
      setTimeout(overview, 350);
    }
  }

  async function countIt() {
    if (!flight.id) return;
    setBusy(true);
    try {
      await addToTotals(flight.id);
      setCounted(true);
      onChanged();
    } catch {
      Alert.alert(t('common.error'));
    } finally {
      setBusy(false);
    }
  }

  const local = flight.local;
  const progress = end > start ? (time - start) / (end - start) : 0;

  return (
    <ScrollView contentContainerStyle={s.page}>
      <Button label={t('flights.back')} kind="secondary" onPress={onBack} />
      <Title>{dateTime(flight.startedAt)}</Title>
      {flight.site ? <Body muted>{flight.site}</Body> : null}

      <View style={[s.mapWrap, { height: Math.round(height * 0.45), borderColor: c.border }]}>
        {points && points.length > 1 ? (
          <>
            <MapView
              ref={map}
              style={StyleSheet.absoluteFill}
              mapType={view3d ? 'satelliteFlyover' : 'satellite'}
              showsCompass
              pitchEnabled
              onMapReady={() => {
                if (!view3d) overview();
              }}
              initialCamera={{
                center: { latitude: points[0]?.lat ?? 0, longitude: points[0]?.lng ?? 0 },
                heading: 0,
                pitch: 65,
                altitude: 1_400,
              }}
              accessibilityLabel={t('replay.mapLabel')}
            >
              <Polyline coordinates={line} strokeColor="rgba(250,204,21,0.75)" strokeWidth={3} />
              {flown.length > 1 ? (
                <Polyline coordinates={flown} strokeColor="#ef4444" strokeWidth={4} />
              ) : null}
              {first ? (
                <Marker
                  coordinate={{ latitude: first.lat, longitude: first.lng }}
                  pinColor="#16a34a"
                  title={t('map.takeoff')}
                />
              ) : null}
              {last ? (
                <Marker
                  coordinate={{ latitude: last.lat, longitude: last.lng }}
                  pinColor="#dc2626"
                  title={t('replay.landing')}
                />
              ) : null}
              {frame ? (
                <Marker
                  coordinate={{ latitude: frame.lat, longitude: frame.lng }}
                  anchor={{ x: 0.5, y: 0.5 }}
                  tracksViewChanges={false}
                >
                  <View style={s.glider} />
                </Marker>
              ) : null}
            </MapView>
            {frame ? (
              <View style={s.hud} pointerEvents="none">
                <Text style={s.hudText}>{clock(time)}</Text>
                <Text style={s.hudText}>{Math.round(frame.alt)} m</Text>
                <Text style={[s.hudText, { color: frame.climb >= 0 ? '#86efac' : '#fca5a5' }]}>
                  {signed(frame.climb)} m/s
                </Text>
                <Text style={s.hudText}>{Math.round(frame.speed)} km/h</Text>
              </View>
            ) : null}
          </>
        ) : (
          <View style={s.center}>
            {failed || (points && points.length < 2) ? (
              <Body muted>{t('replay.noTrack')}</Body>
            ) : (
              <ActivityIndicator />
            )}
          </View>
        )}
      </View>

      {points && points.length > 1 ? (
        <>
          <View style={s.controls}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={playing ? t('replay.pause') : t('replay.play')}
              onPress={() => {
                if (!playing && time >= end) setTime(start);
                setPlaying(!playing);
              }}
              style={({ pressed }) => [
                s.play,
                { backgroundColor: c.primary, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={[s.playText, { color: c.primaryText }]}>{playing ? '❚❚' : '▶'}</Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Segmented
                label={t('replay.speed')}
                options={SPEEDS.map((v) => ({ value: v, label: `×${v}` }))}
                value={speed}
                onChange={setSpeed}
              />
            </View>
          </View>
          <AltitudeScrubber
            points={points}
            progress={progress}
            onSeek={(f) => setTime(start + f * (end - start))}
          />
          <Segmented
            label={t('replay.view')}
            options={[
              { value: '3d', label: t('replay.view3d') },
              { value: '2d', label: t('replay.view2d') },
            ]}
            value={view3d ? '3d' : '2d'}
            onChange={(v) => toggleView(v === '3d')}
          />
        </>
      ) : null}

      <Card>
        <Row label={t('flights.duration')} value={duration(flight.durationS)} />
        {flight.distanceM != null ? (
          <Row label={t('flights.distance')} value={km(flight.distanceM)} />
        ) : null}
        {flight.xcDistanceM != null ? (
          <Row
            label={t('replay.xc')}
            value={`${km(flight.xcDistanceM)}${flight.xcPoints != null ? ` · ${flight.xcPoints.toFixed(1)} ${t('replay.points')}` : ''}`}
          />
        ) : null}
        {flight.maxAltM != null ? (
          <Row label={t('flights.maxAlt')} value={`${flight.maxAltM} m`} />
        ) : null}
        {flight.maxClimbMs != null ? (
          <Row label={t('flights.maxClimb')} value={`${signed(flight.maxClimbMs)} m/s`} />
        ) : null}
        {flight.glider ? <Row label={t('replay.glider')} value={flight.glider} /> : null}
      </Card>

      {flight.id && !counted ? (
        <Card>
          <Body>{t('fly.totalsQuestion')}</Body>
          <Button label={t('replay.addToTotals')} busy={busy} onPress={() => void countIt()} />
        </Card>
      ) : null}
      {flight.id && counted ? <Body muted>{t('replay.inTotals')}</Body> : null}

      {!flight.id && signedIn ? (
        <Button
          label={t('flights.uploadAll')}
          kind="secondary"
          busy={busy}
          onPress={() => {
            setBusy(true);
            void uploadPending()
              .then(onChanged)
              .finally(() => setBusy(false));
          }}
        />
      ) : null}
      {local ? (
        <>
          <Button
            label={t('flights.share')}
            kind="secondary"
            onPress={() =>
              void Sharing.shareAsync(local.igcUri, {
                mimeType: 'application/octet-stream',
                UTI: 'public.data',
                dialogTitle: t('flights.share'),
              })
            }
          />
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
                    void removeFlight(local.id).then(onChanged);
                    onBack();
                  },
                },
              ])
            }
          />
        </>
      ) : null}
    </ScrollView>
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
  page: { padding: 16, gap: 4, paddingBottom: 40 },
  mapWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    marginVertical: 8,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  glider: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ef4444',
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  hud: {
    position: 'absolute',
    left: 8,
    top: 8,
    padding: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(15,23,42,0.72)',
    gap: 2,
  },
  hudText: { color: '#ffffff', fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  controls: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  play: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  playText: { fontSize: 24, fontWeight: '800' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, gap: 12 },
  rowLabel: { fontSize: 16 },
  rowValue: {
    fontSize: 16,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
    textAlign: 'right',
  },
});
