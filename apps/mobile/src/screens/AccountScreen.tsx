import { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import type { Session } from '@supabase/supabase-js';
import { CONFIG } from '../config';
import { locale, t } from '../i18n';
import {
  signInWithApple,
  signInWithEmail,
  signInWithGoogle,
  signOut,
  type SignInResult,
} from '../auth';
import { Body, Button, Card, Link, Title } from '../ui/kit';
import { useTheme } from '../ui/theme';

const web = (path: string) => void WebBrowser.openBrowserAsync(`${CONFIG.webUrl}/${locale}${path}`);

function report(result: SignInResult) {
  if (result === 'ok' || result === 'cancelled') return;
  const key =
    result === 'wrongPassword'
      ? 'auth.wrongPassword'
      : result === 'notConfigured'
        ? 'auth.notConfigured'
        : 'auth.failed';
  Alert.alert(t(key));
}

export function SignIn() {
  const c = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'google' | 'email' | null>(null);

  const input = [s.input, { color: c.text, borderColor: c.border, backgroundColor: c.card }];
  return (
    <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
      <Title>{t('account.signInTitle')}</Title>
      <Body muted>{t('account.signInLead')}</Body>
      <View style={s.gap} />
      {Platform.OS === 'ios' ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={12}
          style={s.apple}
          onPress={() => void signInWithApple().then(report)}
        />
      ) : null}
      <Button
        label={t('auth.google')}
        kind="secondary"
        busy={busy === 'google'}
        onPress={() => {
          setBusy('google');
          void signInWithGoogle()
            .then(report)
            .finally(() => setBusy(null));
        }}
      />
      <Text style={[s.or, { color: c.muted }]}>{t('auth.or')}</Text>
      <TextInput
        accessibilityLabel={t('auth.email')}
        placeholder={t('auth.email')}
        placeholderTextColor={c.muted}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="username"
        value={email}
        onChangeText={setEmail}
        style={input}
      />
      <TextInput
        accessibilityLabel={t('auth.password')}
        placeholder={t('auth.password')}
        placeholderTextColor={c.muted}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        value={password}
        onChangeText={setPassword}
        style={input}
      />
      <Button
        label={t('auth.signIn')}
        busy={busy === 'email'}
        disabled={!email || !password}
        onPress={() => {
          setBusy('email');
          void signInWithEmail(email, password)
            .then(report)
            .finally(() => setBusy(null));
        }}
      />
      <Link label={t('auth.signUpOnWeb')} onPress={() => web('/auth/sign-up')} />
    </ScrollView>
  );
}

export function AccountScreen({ session, name }: { session: Session; name: string | null }) {
  return (
    <ScrollView contentContainerStyle={s.page}>
      <Card>
        <Body muted>{t('account.signedInAs')}</Body>
        <Title>{name ?? session.user.email ?? ''}</Title>
        {name && session.user.email ? <Body muted>{session.user.email}</Body> : null}
      </Card>
      <Button label={t('account.logbook')} kind="secondary" onPress={() => web('/logbook')} />
      <Button label={t('account.website')} kind="secondary" onPress={() => web('')} />
      <Button label={t('account.signOut')} kind="secondary" onPress={() => void signOut()} />
      <Link label={t('account.deleteAccount')} onPress={() => web('/account/privacy')} />
      <View style={s.gap} />
      <Body muted>
        {t('account.version', {
          v: `${Constants.expoConfig?.version ?? ''} (${Constants.expoConfig?.ios?.buildNumber ?? ''})`,
        })}
      </Body>
      <Body muted>{t('account.testBuild')}</Body>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { padding: 16, gap: 4 },
  gap: { height: 12 },
  apple: { height: 52, marginVertical: 6 },
  or: { textAlign: 'center', marginVertical: 10, fontSize: 15 },
  input: {
    minHeight: 52,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 17,
    marginVertical: 6,
  },
});
