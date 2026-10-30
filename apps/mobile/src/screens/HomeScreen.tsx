import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { t, type MessageKey } from '../i18n';
import { listEvents, listNews, dateLabel, type EventItem, type NewsItem } from '../content';
import { Body, Button } from '../ui/kit';
import { Row, screenStyles } from '../ui/screen';
import { useTheme } from '../ui/theme';
import { BoardScreen } from './BoardScreen';
import { EventRow, EventsScreen } from './EventsScreen';
import { NewsScreen } from './NewsScreen';
import { PilotScreen } from './PilotScreen';
import { SafetyScreen } from './SafetyScreen';
import { SitesScreen } from './SitesScreen';
import { SosScreen } from './SosScreen';
import { TipsScreen } from './TipsScreen';
import { TripsScreen } from './TripsScreen';

export type Section =
  | 'news'
  | 'tips'
  | 'notices'
  | 'market'
  | 'sites'
  | 'events'
  | 'trips'
  | 'safety'
  | 'sos'
  | 'pilot';

type Route = { section: Section; id?: string | null } | null;

const SECTIONS: { id: Section; label: MessageKey; icon: string; members?: boolean }[] = [
  { id: 'news', label: 'nav.news', icon: '📰' },
  { id: 'tips', label: 'nav.tips', icon: '🎓' },
  { id: 'sites', label: 'nav.sites', icon: '⛰️' },
  { id: 'events', label: 'nav.events', icon: '📅' },
  { id: 'trips', label: 'nav.trips', icon: '🧳' },
  { id: 'notices', label: 'nav.notices', icon: '📌', members: true },
  { id: 'market', label: 'nav.market', icon: '🪂' },
  { id: 'safety', label: 'nav.safety', icon: '🛟' },
];

/**
 * The app's home: what the website's home page and menu offer, with every club section one tap
 * away. Sections open inside this tab and "Back" returns here.
 */
export function HomeScreen({
  userId,
  name,
  onFly,
  onSignIn,
  onChat,
}: {
  userId: string | null;
  name: string | null;
  onFly: () => void;
  onSignIn: () => void;
  /** Opens a conversation in the Messages tab. */
  onChat: (chatId: string) => void;
}) {
  const c = useTheme();
  const [route, setRoute] = useState<Route>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [n, e] = await Promise.all([listNews(3), listEvents(false, 3)]);
      setNews(n);
      setEvents(e);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, userId]);

  const back = () => setRoute(null);
  if (route) {
    switch (route.section) {
      case 'news':
        return <NewsScreen userId={userId} onBack={back} initialId={route.id} />;
      case 'tips':
        return <TipsScreen userId={userId} onBack={back} />;
      case 'events':
        return <EventsScreen userId={userId} onBack={back} initialId={route.id} />;
      case 'trips':
        return <TripsScreen userId={userId} onBack={back} />;
      case 'safety':
        return (
          <SafetyScreen userId={userId} onBack={back} onSos={() => setRoute({ section: 'sos' })} />
        );
      case 'sos':
        return <SosScreen onBack={back} />;
      case 'sites':
        return <SitesScreen onBack={back} />;
      case 'notices':
      case 'market':
        return (
          <BoardScreen
            signedIn={Boolean(userId)}
            onBack={back}
            initial={route.section}
            onPilot={userId ? (id) => setRoute({ section: 'pilot', id }) : undefined}
          />
        );
      case 'pilot':
        return (
          <PilotScreen
            id={route.id ?? ''}
            viewerId={userId}
            onBack={() => setRoute({ section: 'notices' })}
            onChat={onChat}
          />
        );
    }
  }

  return (
    <ScrollView
      contentContainerStyle={screenStyles.page}
      refreshControl={<RefreshControl refreshing={busy} onRefresh={() => void load()} />}
    >
      <Text accessibilityRole="header" style={[s.hello, { color: c.text }]}>
        {name ? t('home.hello', { name }) : t('home.welcome')}
      </Text>
      <Body muted>{t('home.lead')}</Body>

      {userId ? (
        <Pressable
          accessibilityRole="button"
          onPress={onFly}
          style={({ pressed }) => [
            s.fly,
            { backgroundColor: c.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={[s.flyTitle, { color: c.primaryText }]}>🪂 {t('home.flyNow')}</Text>
          <Text style={[s.flyLead, { color: c.primaryText }]}>{t('home.flyNowLead')}</Text>
        </Pressable>
      ) : (
        <View style={[s.signIn, { borderColor: c.border, backgroundColor: c.card }]}>
          <Body>{t('home.signIn')}</Body>
          <Button label={t('home.signInButton')} onPress={onSignIn} />
        </View>
      )}

      <Text accessibilityRole="header" style={[s.h2, { color: c.text }]}>
        {t('home.sections')}
      </Text>
      <View style={s.grid}>
        {SECTIONS.map((sec) => (
          <Pressable
            key={sec.id}
            accessibilityRole="button"
            accessibilityLabel={t(sec.label)}
            onPress={() => setRoute({ section: sec.id })}
            style={({ pressed }) => [
              s.tile,
              { borderColor: c.border, backgroundColor: c.card, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={s.icon}>{sec.icon}</Text>
            <Text style={[s.tileText, { color: c.text }]} numberOfLines={2}>
              {t(sec.label)}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('nav.sos')}: ${t('home.sosLead')}`}
        onPress={() => setRoute({ section: 'sos' })}
        style={({ pressed }) => [s.sos, { opacity: pressed ? 0.85 : 1 }]}
      >
        <Text style={s.sosTitle}>🆘 {t('nav.sos')}</Text>
        <Text style={s.sosLead}>{t('home.sosLead')}</Text>
      </Pressable>

      {failed ? <Body muted>{t('common.offline')}</Body> : null}

      {events.length ? (
        <>
          <Heading label={t('home.nextEvents')} onAll={() => setRoute({ section: 'events' })} />
          {events.map((e) => (
            <EventRow
              key={e.id}
              event={e}
              onPress={() => setRoute({ section: 'events', id: e.id })}
            />
          ))}
        </>
      ) : null}

      {news.length ? (
        <>
          <Heading label={t('home.latestNews')} onAll={() => setRoute({ section: 'news' })} />
          {news.map((n) => (
            <Row
              key={n.id}
              title={n.title}
              meta={dateLabel(n.publishedAt)}
              summary={n.summary}
              image={n.cover}
              onPress={() => setRoute({ section: 'news', id: n.id })}
            />
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

function Heading({ label, onAll }: { label: string; onAll: () => void }) {
  const c = useTheme();
  return (
    <View style={s.heading}>
      <Text accessibilityRole="header" style={[s.h2, { color: c.text }]}>
        {label}
      </Text>
      <Pressable accessibilityRole="link" onPress={onAll} hitSlop={8} style={s.all}>
        <Text style={[s.allText, { color: c.primary }]}>{t('home.seeAll')} ›</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  hello: { fontSize: 28, fontWeight: '800', marginBottom: 4 },
  fly: { borderRadius: 18, padding: 18, marginTop: 16, gap: 4 },
  flyTitle: { fontSize: 24, fontWeight: '800' },
  flyLead: { fontSize: 15, opacity: 0.9 },
  signIn: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, marginTop: 16 },
  h2: { fontSize: 20, fontWeight: '800', marginTop: 20, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: '31%',
    flexGrow: 1,
    minHeight: 92,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    gap: 6,
  },
  icon: { fontSize: 28 },
  sos: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: '#c81e1e',
    paddingHorizontal: 16,
    marginTop: 12,
  },
  sosTitle: { color: '#ffffff', fontSize: 20, fontWeight: '800' },
  sosLead: { color: '#ffffff', fontSize: 15, flex: 1 },
  tileText: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  heading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  all: { minHeight: 44, justifyContent: 'flex-end', paddingBottom: 10 },
  allText: { fontSize: 16, fontWeight: '600' },
});
