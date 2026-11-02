import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { signed } from '../format';
import {
  CLIMB_START_RANGE,
  DAMPINGS,
  DEFAULT_VARIO,
  SINK_ALARM_RANGE,
  VOLUMES,
  stepValue,
} from '../tracker/vario-settings';
import { saveVarioSettings, useVarioSettings } from '../tracker/vario-settings-store';
import { Body, Button, Card, Segmented, Stepper, Title, Toggle } from '../ui/kit';
import { useTheme } from '../ui/theme';

/** Vario settings page: when the beeps start, the sink alarm, volume, smoothing, test sound. */
export function VarioSettingsScreen({
  visible,
  onClose,
  onTest,
}: {
  visible: boolean;
  onClose: () => void;
  onTest: () => Promise<void>;
}) {
  const c = useTheme();
  const v = useVarioSettings();
  const [testing, setTesting] = useState(false);
  const ms = (n: number) => `${signed(n)} m/s`;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[s.page, { backgroundColor: c.bg }]} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={s.content}>
          <Title>{t('vario.title')}</Title>
          <Card>
            <Toggle
              label={t('fly.sound')}
              value={v.sound}
              onChange={(sound) => void saveVarioSettings({ sound })}
            />
            <Stepper
              label={t('vario.climbStart')}
              help={t('vario.climbStartHelp')}
              value={ms(v.climbStart)}
              canDown={v.climbStart > CLIMB_START_RANGE.min}
              canUp={v.climbStart < CLIMB_START_RANGE.max}
              onStep={(d) =>
                void saveVarioSettings({
                  climbStart: stepValue(v.climbStart, d, CLIMB_START_RANGE),
                })
              }
            />
            <Stepper
              label={t('vario.sinkAlarm')}
              help={t('vario.sinkAlarmHelp')}
              value={ms(v.sinkAlarm)}
              canDown={v.sinkAlarm > SINK_ALARM_RANGE.min}
              canUp={v.sinkAlarm < SINK_ALARM_RANGE.max}
              onStep={(d) =>
                void saveVarioSettings({ sinkAlarm: stepValue(v.sinkAlarm, d, SINK_ALARM_RANGE) })
              }
            />
            <Segmented
              label={t('vario.volume')}
              options={VOLUMES.map((value) => ({ value, label: t(`vario.volumes.${value}`) }))}
              value={v.volume}
              onChange={(volume) => void saveVarioSettings({ volume })}
            />
            <Button
              label={testing ? t('vario.testing') : t('vario.test')}
              kind="secondary"
              busy={testing}
              onPress={() => {
                setTesting(true);
                void onTest().finally(() => setTesting(false));
              }}
            />
          </Card>
          <Card>
            <Segmented
              label={t('vario.damping')}
              help={t('vario.dampingHelp')}
              options={DAMPINGS.map((value) => ({ value, label: t(`vario.dampings.${value}`) }))}
              value={v.damping}
              onChange={(damping) => void saveVarioSettings({ damping })}
            />
            <Toggle
              label={t('fly.keepAwake')}
              value={v.keepAwake}
              onChange={(keepAwake) => void saveVarioSettings({ keepAwake })}
            />
          </Card>
          <Body muted>{t('vario.note')}</Body>
          <View style={s.actions}>
            <Button
              label={t('vario.reset')}
              kind="secondary"
              onPress={() => void saveVarioSettings(DEFAULT_VARIO)}
            />
            <Button label={t('vario.done')} onPress={onClose} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  actions: { marginTop: 12 },
});
