import { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { t } from '../i18n';
import { CLUB_EMAIL, EMERGENCY_NUMBERS } from '../safety';
import { osmLink, toDms } from '../position';
import { Body, Button, Card } from '../ui/kit';
import { BackBar, Meta, screenStyles } from '../ui/screen';
import { useTheme } from '../ui/theme';

const SOS_RED = '#c81e1e';

interface Fix {
  lat: number;
  lng: number;
  accuracy: number | null;
  altitude: number | null;
}

/** Emergency help: call numbers and read out or share the exact position. Nothing is sent to us. */
export function SosScreen({ onBack }: { onBack: () => void }) {
  const c = useTheme();
  const [fix, setFix] = useState<Fix | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState(false);
  const [first, ...others] = EMERGENCY_NUMBERS;

  const locate = async () => {
    setLocating(true);
    setError(false);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') throw new Error('denied');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      setFix({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        altitude: pos.coords.altitude,
      });
    } catch {
      setError(true);
    } finally {
      setLocating(false);
    }
  };

  const decimal = fix ? `${fix.lat.toFixed(5)}, ${fix.lng.toFixed(5)}` : '';
  const dms = fix ? toDms(fix.lat, fix.lng) : '';
  const message = fix ? t('sos.message', { decimal, dms, link: osmLink(fix.lat, fix.lng) }) : '';

  return (
    <ScrollView contentContainerStyle={screenStyles.page}>
      <BackBar onBack={onBack} />
      <Text accessibilityRole="header" style={[s.title, { color: c.text }]}>
        🆘 {t('sos.title')}
      </Text>
      <Body muted>{t('sos.lead')}</Body>
      <Pressable
        accessibilityRole="button"
        onPress={() => void Linking.openURL(`tel:${first.number}`)}
        style={({ pressed }) => [s.call, { opacity: pressed ? 0.85 : 1 }]}
      >
        <Text style={s.callText}>📞 {t('sos.call', { number: first.number })}</Text>
      </Pressable>
      {others.map((n) => (
        <Pressable
          key={n.key}
          accessibilityRole="button"
          onPress={() => void Linking.openURL(`tel:${n.number}`)}
          style={({ pressed }) => [s.other, { opacity: pressed ? 0.8 : 1 }]}
        >
          <Text style={[s.otherLabel, { color: c.text }]}>{t(`sos.numbers.${n.key}`)}</Text>
          <Text style={[s.otherNumber, { color: c.text }]}>{n.number}</Text>
        </Pressable>
      ))}

      <Card>
        <Text accessibilityRole="header" style={[s.h2, { color: c.text }]}>
          {t('sos.positionTitle')}
        </Text>
        {!fix ? <Meta>{t('sos.positionHelp')}</Meta> : null}
        {locating ? <ActivityIndicator /> : null}
        {error ? (
          <Text style={{ color: c.danger, fontSize: 16 }}>{t('sos.positionError')}</Text>
        ) : null}
        {fix ? (
          <View style={{ gap: 6 }}>
            <Meta>{t('sos.decimal')}</Meta>
            <Text selectable style={[s.coords, { color: c.text }]}>
              {decimal}
            </Text>
            <Meta>{t('sos.dms')}</Meta>
            <Text selectable style={[s.coords, { color: c.text }]}>
              {dms}
            </Text>
            <Meta>
              {[
                fix.accuracy != null ? `${t('sos.accuracy')} ±${Math.round(fix.accuracy)} m` : null,
                fix.altitude != null ? t('sos.altitude', { m: Math.round(fix.altitude) }) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Meta>
            <Button label={t('sos.share')} onPress={() => void Share.share({ message })} />
            <Button
              label={t('sos.sms')}
              kind="secondary"
              onPress={() => void Linking.openURL(`sms:&body=${encodeURIComponent(message)}`)}
            />
            <Button
              label={t('sos.openMap')}
              kind="secondary"
              onPress={() => void Linking.openURL(`maps://?ll=${fix.lat},${fix.lng}&q=SOS`)}
            />
          </View>
        ) : null}
        <Button
          label={fix ? t('sos.refresh') : t('sos.locate')}
          kind={fix ? 'secondary' : 'primary'}
          busy={locating}
          onPress={() => void locate()}
        />
      </Card>

      <Card>
        <Text accessibilityRole="header" style={[s.h2, { color: c.text }]}>
          {t('sos.tellTitle')}
        </Text>
        {(['what', 'where', 'who', 'injuries', 'callback'] as const).map((k, i) => (
          <Body key={k}>
            {i + 1}. {t(`sos.tell.${k}`)}
          </Body>
        ))}
      </Card>
      <Card>
        <Text accessibilityRole="header" style={[s.h2, { color: c.text }]}>
          {t('sos.tipsTitle')}
        </Text>
        {(['tree', 'water', 'wing', 'battery', 'helicopter'] as const).map((k) => (
          <Body key={k}>• {t(`sos.tips.${k}`)}</Body>
        ))}
      </Card>
      <Meta>
        {t('sos.clubContact', { club: 'Fly Anatolia' })}{' '}
        <Text
          style={{ color: c.primary }}
          onPress={() => void Linking.openURL(`mailto:${CLUB_EMAIL}`)}
        >
          {CLUB_EMAIL}
        </Text>
      </Meta>
      <Meta>{t('sos.privacy')}</Meta>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', marginBottom: 4 },
  call: {
    minHeight: 80,
    borderRadius: 18,
    backgroundColor: SOS_RED,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  callText: { color: '#ffffff', fontSize: 26, fontWeight: '800' },
  other: {
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: SOS_RED,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginVertical: 4,
  },
  otherLabel: { fontSize: 17, fontWeight: '700' },
  otherNumber: { fontSize: 22, fontWeight: '800' },
  h2: { fontSize: 19, fontWeight: '800', marginBottom: 6 },
  coords: { fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
