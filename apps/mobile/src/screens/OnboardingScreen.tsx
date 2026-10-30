import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { CONFIG } from '../config';
import { locale, t } from '../i18n';
import {
  SIGNUP_CONSENTS,
  acceptLegal,
  legalUrl,
  saveConsents,
  submitBirthDate,
  type OnboardingStep,
  type SignupConsent,
} from '../onboarding';
import { Body, Button, Link, Title, Toggle } from '../ui/kit';
import { useTheme } from '../ui/theme';

const open = (url: string) => void WebBrowser.openBrowserAsync(url);

export function OnboardingScreen({
  step,
  userId,
  onDone,
}: {
  step: OnboardingStep;
  userId: string;
  onDone: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
      <Body muted>{t('onboarding.title')}</Body>
      {step === 'age' ? <Age onDone={onDone} /> : null}
      {step === 'legal' ? <Legal userId={userId} onDone={onDone} /> : null}
      {step === 'consents' ? <Consents userId={userId} onDone={onDone} /> : null}
      {step === 'guardian' ? (
        <>
          <Title>{t('onboarding.guardianTitle')}</Title>
          <Body>{t('onboarding.guardianLead')}</Body>
          <Button
            label={t('onboarding.openWebsite')}
            onPress={() => open(`${CONFIG.webUrl}/${locale}/onboarding`)}
          />
          <Button label={t('onboarding.checkAgain')} kind="secondary" onPress={onDone} />
        </>
      ) : null}
    </ScrollView>
  );
}

function Age({ onDone }: { onDone: () => void }) {
  const c = useTheme();
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [busy, setBusy] = useState(false);
  const input = [s.input, { color: c.text, borderColor: c.border, backgroundColor: c.card }];

  async function submit() {
    const d = Number(day);
    const m = Number(month);
    const y = Number(year);
    const date = new Date(Date.UTC(y, m - 1, d));
    if (!d || !m || y < 1900 || date.getUTCDate() !== d || date.getUTCMonth() !== m - 1) {
      Alert.alert(t('onboarding.invalidDate'));
      return;
    }
    setBusy(true);
    const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const result = await submitBirthDate(iso);
    setBusy(false);
    if (result === 'ok') onDone();
    else if (result === 'tooYoung') Alert.alert(t('onboarding.tooYoung'));
    else Alert.alert(t(result === 'invalidDate' ? 'onboarding.invalidDate' : 'common.error'));
  }

  return (
    <>
      <Title>{t('onboarding.ageTitle')}</Title>
      <Body muted>{t('onboarding.ageLead')}</Body>
      <View style={s.row}>
        <TextInput
          accessibilityLabel={t('onboarding.day')}
          placeholder={t('onboarding.day')}
          placeholderTextColor={c.muted}
          keyboardType="number-pad"
          maxLength={2}
          value={day}
          onChangeText={setDay}
          style={[input, s.small]}
        />
        <TextInput
          accessibilityLabel={t('onboarding.month')}
          placeholder={t('onboarding.month')}
          placeholderTextColor={c.muted}
          keyboardType="number-pad"
          maxLength={2}
          value={month}
          onChangeText={setMonth}
          style={[input, s.small]}
        />
        <TextInput
          accessibilityLabel={t('onboarding.year')}
          placeholder={t('onboarding.year')}
          placeholderTextColor={c.muted}
          keyboardType="number-pad"
          maxLength={4}
          value={year}
          onChangeText={setYear}
          style={[input, s.year]}
        />
      </View>
      <Button label={t('common.continue')} busy={busy} onPress={() => void submit()} />
    </>
  );
}

function Legal({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [privacy, setPrivacy] = useState(false);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Title>{t('onboarding.legalTitle')}</Title>
      <Body muted>{t('onboarding.legalLead')}</Body>
      <Link label={t('onboarding.readPrivacy')} onPress={() => open(legalUrl('privacy_notice'))} />
      <Link label={t('onboarding.readTerms')} onPress={() => open(legalUrl('terms'))} />
      <Toggle label={t('onboarding.privacyAck')} value={privacy} onChange={setPrivacy} />
      <Toggle label={t('onboarding.termsAccept')} value={terms} onChange={setTerms} />
      <Button
        label={t('common.continue')}
        disabled={!privacy || !terms}
        busy={busy}
        onPress={() => {
          setBusy(true);
          void acceptLegal(userId).then((ok) => {
            setBusy(false);
            if (ok) onDone();
            else Alert.alert(t('common.error'));
          });
        }}
      />
    </>
  );
}

function Consents({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [choices, setChoices] = useState<Record<SignupConsent, boolean>>({
    marketing_notifications: false,
    analytics: false,
    public_profile: false,
  });
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Title>{t('onboarding.consentsTitle')}</Title>
      <Body muted>{t('onboarding.consentsLead')}</Body>
      <Link
        label={t('onboarding.readConsent')}
        onPress={() => open(legalUrl('explicit_consent'))}
      />
      {SIGNUP_CONSENTS.map((key) => (
        <Toggle
          key={key}
          label={t(`onboarding.${key}`)}
          value={choices[key]}
          onChange={(v) => setChoices((prev) => ({ ...prev, [key]: v }))}
        />
      ))}
      <Button
        label={t('common.continue')}
        busy={busy}
        onPress={() => {
          setBusy(true);
          void saveConsents(userId, choices).then((ok) => {
            setBusy(false);
            if (ok) onDone();
            else Alert.alert(t('common.error'));
          });
        }}
      />
    </>
  );
}

const s = StyleSheet.create({
  page: { padding: 16, gap: 4 },
  row: { flexDirection: 'row', gap: 8, marginVertical: 8 },
  input: {
    minHeight: 52,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 17,
  },
  small: { flex: 1 },
  year: { flex: 1.5 },
});
