import { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import { altitudeBars } from '../replay';
import type { TrackPoint } from '@paraapp/core-tracks';
import { t } from '../i18n';
import { useTheme } from './theme';

const BARS = 90;

/**
 * Altitude profile of the flight; the played part is coloured. Touch or drag anywhere on it to
 * jump to that moment of the replay.
 */
export function AltitudeScrubber({
  points,
  progress,
  onSeek,
}: {
  points: readonly TrackPoint[];
  /** 0–1 */
  progress: number;
  onSeek: (fraction: number) => void;
}) {
  const c = useTheme();
  const [width, setWidth] = useState(1);
  const widthRef = useRef(1);
  const seek = useRef(onSeek);
  seek.current = onSeek;
  const bars = useMemo(() => altitudeBars(points, BARS), [points]);
  const min = Math.min(...bars);
  const max = Math.max(...bars);
  const span = Math.max(1, max - min);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => seek.current(e.nativeEvent.locationX / widthRef.current),
        onPanResponderMove: (e) =>
          seek.current(Math.min(1, Math.max(0, e.nativeEvent.locationX / widthRef.current))),
      }),
    [],
  );

  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel={t('replay.scrub')}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) =>
        onSeek(
          Math.min(
            1,
            Math.max(0, progress + (e.nativeEvent.actionName === 'increment' ? 0.05 : -0.05)),
          ),
        )
      }
      onLayout={(e) => {
        widthRef.current = e.nativeEvent.layout.width || 1;
        setWidth(widthRef.current);
      }}
      style={[s.wrap, { borderColor: c.border, backgroundColor: c.card }]}
      {...responder.panHandlers}
    >
      <View style={s.bars} pointerEvents="none">
        {bars.map((alt, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: `${12 + ((alt - min) / span) * 88}%`,
              backgroundColor: i / BARS <= progress ? c.primary : c.border,
            }}
          />
        ))}
      </View>
      <View
        pointerEvents="none"
        style={[s.cursor, { left: Math.max(0, progress * width - 1), backgroundColor: c.text }]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    height: 72,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginVertical: 8,
  },
  bars: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 1, padding: 4 },
  cursor: { position: 'absolute', top: 0, bottom: 0, width: 2 },
});
