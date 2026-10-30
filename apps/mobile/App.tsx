import { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { loadSavedLocale, locale, setLocale, t, type Locale, type MessageKey } from './src/i18n';
import { supabase } from './src/supabase';
import { onboardingStep, type OnboardingStep } from './src/onboarding';
import { uploadPending } from './src/upload';
import { PILOT_NAME_KEY, subscribeRecorder } from './src/tracker/recorder';
import { FlyScreen } from './src/screens/FlyScreen';
import { FlightsScreen } from './src/screens/FlightsScreen';
import { SignIn } from './src/screens/AccountScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { SitesScreen } from './src/screens/SitesScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { useTheme } from './src/ui/theme';

type Tab = 'fly' | 'flights' | 'sites' | 'account';
const TABS: { id: Tab; label: MessageKey }[] = [
  { id: 'fly', label: 'tabs.fly' },
  { id: 'flights', label: 'tabs.flights' },
  { id: 'sites', label: 'tabs.sites' },
  { id: 'account', label: 'tabs.account' },
];

export default function App() {
  return (
    <SafeAreaProvider>
      <Main />
    </SafeAreaProvider>
  );
}

function Main() {
  const c = useTheme();
  const [tab, setTab] = useState<Tab>('fly');
  const [session, setSession] = useState<Session | null>(null);
  const [step, setStep] = useState<OnboardingStep | null>(null);
  const [recording, setRecording] = useState(false);
  // Changing it re-renders every screen in the new language.
  const [, setLang] = useState<Locale>(locale);

  useEffect(() => {
    void loadSavedLocale().then(setLang);
  }, []);

  useEffect(
    () =>
      subscribeRecorder((event) => {
        if (event.type === 'state') setRecording(event.recording);
      }),
    [],
  );

  const refresh = useCallback(async (s: Session | null) => {
    if (!s) {
      setStep(null);
      return;
    }
    try {
      const next = await onboardingStep(s.user.id);
      setStep(next);
      const { data } = await supabase
        .from('profiles')
        .select('display_name, locale')
        .eq('id', s.user.id)
        .maybeSingle();
      const row = data as { display_name: string; locale: string } | null;
      const display = row?.display_name ?? null;
      // The language saved in the profile (also chosen on the website) wins.
      if (setLocale(row?.locale)) setLang(locale);
      if (display) await AsyncStorage.setItem(PILOT_NAME_KEY, display);
      if (!next) void uploadPending();
    } catch {
      // Offline: keep what we have; the next foreground retries.
    }
  }, []);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setTab('account');
      void refresh(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') void refresh(s);
    });
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active')
        void supabase.auth.getSession().then(({ data: d }) => refresh(d.session));
    });
    return () => {
      data.subscription.unsubscribe();
      app.remove();
    };
  }, [refresh]);

  const signedIn = Boolean(session) && !step;

  return (
    <SafeAreaView style={[s.root, { backgroundColor: c.bg }]} edges={['top', 'left', 'right']}>
      <StatusBar style="auto" />
      {/* All tabs stay mounted so the recorder screen keeps listening while another tab is open. */}
      <View style={[s.screen, tab !== 'fly' && s.hidden]}>
        <FlyScreen />
      </View>
      <View style={[s.screen, tab !== 'flights' && s.hidden]}>
        <FlightsScreen userId={signedIn && session ? session.user.id : null} />
      </View>
      <View style={[s.screen, tab !== 'sites' && s.hidden]}>
        <SitesScreen />
      </View>
      <View style={[s.screen, tab !== 'account' && s.hidden]}>
        {!session ? (
          <SignIn />
        ) : step ? (
          <OnboardingScreen
            step={step}
            userId={session.user.id}
            onDone={() => void refresh(session)}
          />
        ) : (
          <ProfileScreen
            session={session}
            onLocaleChange={(l) => {
              setLocale(l);
              setLang(l);
            }}
          />
        )}
      </View>
      <SafeAreaView
        edges={['bottom']}
        style={[s.tabs, { borderColor: c.border, backgroundColor: c.card }]}
      >
        {TABS.filter((item) => item.id !== 'fly' || signedIn || recording).map((item) => {
          const active = tab === item.id;
          const flying = item.id === 'fly' && recording;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setTab(item.id)}
              style={s.tab}
            >
              <Text style={[s.tabText, { color: active ? c.primary : c.muted }]}>
                {t(item.label)}
              </Text>
            </Pressable>
          );
        })}
      </SafeAreaView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  screen: { flex: 1 },
  hidden: { display: 'none' },
  tabs: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 16, fontWeight: '700' },
});
