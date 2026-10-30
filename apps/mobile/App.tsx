import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  Easing,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
import { HomeScreen } from './src/screens/HomeScreen';
import { MessagesScreen } from './src/screens/MessagesScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { useTheme } from './src/ui/theme';

// Home holds every club section of the website (news, Ground School, sites, notices, …).
type Tab = 'home' | 'fly' | 'flights' | 'messages' | 'account';
const TABS: { id: Tab; label: MessageKey; icon: string }[] = [
  { id: 'home', label: 'tabs.home', icon: '🏠' },
  { id: 'fly', label: 'tabs.fly', icon: '🪂' },
  { id: 'flights', label: 'tabs.flights', icon: '📒' },
  { id: 'messages', label: 'tabs.messages', icon: '📣' },
  { id: 'account', label: 'tabs.account', icon: '👤' },
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
  const [tab, setTab] = useState<Tab>('home');
  const [name, setName] = useState<string | null>(null);
  const [homeTaps, setHomeTaps] = useState(0);
  const [unread, setUnread] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [step, setStep] = useState<OnboardingStep | null>(null);
  const [recording, setRecording] = useState(false);
  // Changing it re-renders every screen in the new language.
  const [, setLang] = useState<Locale>(locale);

  useEffect(() => {
    void loadSavedLocale().then(setLang);
    // The website's "Fly now" opens flyanatolia:// — land on the recorder.
    const sub = Linking.addEventListener('url', () => setTab('fly'));
    return () => sub.remove();
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
      setName(null);
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
      setName(display);
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
      <View style={[s.screen, tab !== 'home' && s.hidden]}>
        <HomeScreen
          userId={signedIn && session ? session.user.id : null}
          name={signedIn ? name : null}
          onFly={() => setTab('fly')}
          onSignIn={() => setTab('account')}
          homeTaps={homeTaps}
        />
      </View>
      <View style={[s.screen, tab !== 'messages' && s.hidden]}>
        <MessagesScreen
          userId={signedIn && session ? session.user.id : null}
          onUnread={setUnread}
          active={tab === 'messages'}
        />
      </View>
      <View style={[s.screen, tab !== 'fly' && s.hidden]}>
        <FlyScreen />
      </View>
      <View style={[s.screen, tab !== 'flights' && s.hidden]}>
        <FlightsScreen userId={signedIn && session ? session.user.id : null} />
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
              onPress={() => {
                // Home always goes back to the home page, whatever section is open.
                if (item.id === 'home') setHomeTaps((n) => n + 1);
                setTab(item.id);
              }}
              style={s.tab}
            >
              <TabIcon icon={flying ? '🔴' : item.icon} bounce={item.id === 'messages' && unread} />
              {item.id === 'messages' && unread ? (
                <View style={[s.badge, { backgroundColor: c.danger }]} />
              ) : null}
              <Text
                numberOfLines={2}
                style={[s.tabText, { color: flying ? c.danger : active ? c.primary : c.muted }]}
              >
                {t(flying ? 'tabs.flying' : item.label)}
              </Text>
            </Pressable>
          );
        })}
      </SafeAreaView>
    </SafeAreaView>
  );
}

/** A tab icon; `bounce` hops it once every two seconds (new club messages). */
function TabIcon({ icon, bounce }: { icon: string; bounce: boolean }) {
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!bounce) return;
    const hop = Animated.loop(
      Animated.sequence([
        Animated.timing(y, { toValue: -8, duration: 180, useNativeDriver: true }),
        Animated.timing(y, {
          toValue: 0,
          duration: 420,
          easing: Easing.bounce,
          useNativeDriver: true,
        }),
        Animated.delay(1400),
      ]),
    );
    hop.start();
    return () => {
      hop.stop();
      y.setValue(0);
    };
  }, [bounce, y]);
  return (
    <Animated.Text
      style={[s.tabIcon, { transform: [{ translateY: y }] }]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      {icon}
    </Animated.Text>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  screen: { flex: 1 },
  hidden: { display: 'none' },
  tabs: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center' },
  tabIcon: { fontSize: 20 },
  badge: { position: 'absolute', top: 8, right: '30%', width: 10, height: 10, borderRadius: 5 },
  tabText: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
});
