import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, type MapType } from 'react-native-maps';
import { t } from '../i18n';
import { useTheme } from './theme';

export interface LatLng {
  latitude: number;
  longitude: number;
}

/**
 * Live map for the recorder: Apple Maps satellite imagery (free, no key), the track flown so far,
 * a green takeoff pin, and the pilot's position. It follows the pilot until they move the map;
 * "Centre" turns following back on.
 */
export function LiveMap({
  track,
  takeoff,
  position,
  height,
}: {
  track: LatLng[];
  takeoff: LatLng | null;
  position: LatLng | null;
  height: number;
}) {
  const c = useTheme();
  const map = useRef<MapView>(null);
  const [follow, setFollow] = useState(true);
  const [type, setType] = useState<MapType>('satellite');
  const [phone, setPhone] = useState<LatLng | null>(null);
  const centred = useRef(false);
  // Before recording there is no track yet: follow the phone's own position dot.
  const here = position ?? phone;

  useEffect(() => {
    if (!follow || !here) return;
    map.current?.animateCamera(
      { center: here, ...(centred.current ? {} : { altitude: 4_000 }) },
      { duration: centred.current ? 600 : 0 },
    );
    centred.current = true;
  }, [follow, here]);

  return (
    <View style={[s.wrap, { height, borderColor: c.border }]}>
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        mapType={type}
        showsUserLocation
        showsCompass
        showsScale
        pitchEnabled={false}
        onPanDrag={() => setFollow(false)}
        onUserLocationChange={(e) => {
          const p = e.nativeEvent.coordinate;
          if (!position && p) setPhone({ latitude: p.latitude, longitude: p.longitude });
        }}
        accessibilityLabel={t('map.label')}
      >
        {track.length > 1 ? (
          <Polyline coordinates={track} strokeColor="#facc15" strokeWidth={4} />
        ) : null}
        {takeoff ? (
          <Marker coordinate={takeoff} pinColor="#16a34a" title={t('map.takeoff')} />
        ) : null}
      </MapView>
      <View style={s.controls}>
        <MapButton
          label={type === 'satellite' ? t('map.standard') : t('map.satellite')}
          onPress={() => setType(type === 'satellite' ? 'standard' : 'satellite')}
        />
        {!follow ? <MapButton label={t('map.centre')} onPress={() => setFollow(true)} /> : null}
      </View>
    </View>
  );
}

function MapButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [s.button, { opacity: pressed ? 0.8 : 1 }]}
    >
      <Text style={s.buttonText}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    marginVertical: 8,
  },
  controls: { position: 'absolute', right: 8, top: 8, gap: 8, alignItems: 'flex-end' },
  button: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 14,
    borderRadius: 10,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  buttonText: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
});
