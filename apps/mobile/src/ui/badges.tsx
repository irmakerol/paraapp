import { StyleSheet, View } from 'react-native';
import { profileBadges } from '../badges';
import { t, type MessageKey } from '../i18n';
import { Badge } from './kit';

const levelName = (level: string) =>
  level === 'student' || level === 'tandem' ? t(`profile.levels.${level}`) : level.toUpperCase();

/** Only the badges a person holds: "Pilot (P4)", then "Training for P5", then other roles. */
export function ProfileBadges({
  roles,
  level,
  trainingLevel,
  instructor,
}: {
  roles: readonly string[];
  level: string | null;
  trainingLevel: string | null;
  instructor: boolean;
}) {
  const badges = profileBadges({ roles, level, trainingLevel, instructor });
  if (!badges.length) return null;
  return (
    <View style={s.badges}>
      {badges.map((b) =>
        b.kind === 'role' ? (
          <Badge key={b.role} label={t(`profile.roles.${b.role}` as MessageKey)} />
        ) : (
          <Badge
            key={b.kind}
            tone="strong"
            label={
              b.kind === 'pilot'
                ? b.level
                  ? t('profile.badge.pilot', { level: levelName(b.level) })
                  : t('profile.badge.pilotNoLevel')
                : b.level
                  ? t('profile.badge.training', { level: levelName(b.level) })
                  : t('profile.badge.trainingNoLevel')
            }
          />
        ),
      )}
    </View>
  );
}

const s = StyleSheet.create({
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
