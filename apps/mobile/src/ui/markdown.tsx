import { Fragment } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { parseMarkdown, type Span } from '../markdown';
import { useTheme } from './theme';

function Spans({ spans }: { spans: Span[] }) {
  const c = useTheme();
  return (
    <>
      {spans.map((span, i) =>
        span.kind === 'link' ? (
          <Text
            key={i}
            accessibilityRole="link"
            style={{ color: c.primary, textDecorationLine: 'underline' }}
            onPress={() => void Linking.openURL(span.href)}
          >
            {span.text}
          </Text>
        ) : (
          <Text
            key={i}
            style={[
              span.bold && s.bold,
              span.italic && s.italic,
              span.code && [s.code, { backgroundColor: c.card }],
            ]}
          >
            {span.text}
          </Text>
        ),
      )}
    </>
  );
}

/** Club content written in Markdown on the website. */
export function Markdown({ children }: { children: string | null | undefined }) {
  const c = useTheme();
  const blocks = parseMarkdown(children);
  return (
    <View style={s.root}>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'heading':
            return (
              <Text
                key={i}
                accessibilityRole="header"
                style={[
                  s.heading,
                  b.level === 1 ? s.h1 : b.level === 2 ? s.h2 : s.h3,
                  { color: c.text },
                ]}
              >
                <Spans spans={b.spans} />
              </Text>
            );
          case 'paragraph':
            return (
              <Text key={i} style={[s.body, { color: c.text }]}>
                <Spans spans={b.spans} />
              </Text>
            );
          case 'quote':
            return (
              <View key={i} style={[s.quote, { borderColor: c.primary }]}>
                <Text style={[s.body, { color: c.muted }]}>
                  <Spans spans={b.spans} />
                </Text>
              </View>
            );
          case 'list':
            return (
              <View key={i} style={s.list}>
                {b.items.map((item, j) => (
                  <View key={j} style={s.item}>
                    <Text style={[s.body, s.marker, { color: c.muted }]}>
                      {b.ordered ? `${j + 1}.` : '•'}
                    </Text>
                    <Text style={[s.body, s.itemText, { color: c.text }]}>
                      <Spans spans={item} />
                    </Text>
                  </View>
                ))}
              </View>
            );
          case 'rule':
            return <View key={i} style={[s.rule, { backgroundColor: c.border }]} />;
          default:
            return <Fragment key={i} />;
        }
      })}
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: 12, marginVertical: 8 },
  body: { fontSize: 17, lineHeight: 25 },
  heading: { fontWeight: '800', marginTop: 8 },
  h1: { fontSize: 24 },
  h2: { fontSize: 21 },
  h3: { fontSize: 18 },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  code: { fontFamily: 'Menlo', fontSize: 15 },
  quote: { borderLeftWidth: 4, paddingLeft: 12 },
  list: { gap: 6 },
  item: { flexDirection: 'row', gap: 8 },
  marker: { minWidth: 18 },
  itemText: { flex: 1 },
  rule: { height: StyleSheet.hairlineWidth, marginVertical: 8 },
});
