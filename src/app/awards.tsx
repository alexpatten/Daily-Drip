import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { useCelebrations } from '@/components/Celebration';
import { CoffeeBadge } from '@/components/CoffeeBadge';
import { Screen } from '@/components/Screen';
import { AWARD_GROUPS, awardStatuses, type AwardStatus } from '@/lib/awards';
import { formatShort } from '@/lib/dates';
import { useProgress } from '@/lib/progress';
import { cachedQuestionCounts, getQuestionCounts } from '@/lib/questions';
import { colors, fonts, radius, shadow } from '@/theme';

export default function AwardsScreen() {
  const { progress, syncAwards } = useProgress();
  const [counts, setCounts] = useState(cachedQuestionCounts);
  const { celebration, celebrate } = useCelebrations();

  useEffect(() => {
    let active = true;
    getQuestionCounts()
      .then((next) => active && setCounts(next))
      .catch(() => {});
    syncAwards();
    return () => {
      active = false;
    };
  }, [syncAwards]);

  const statuses = awardStatuses(progress, counts);
  const earned = statuses.filter((s) => s.earnedOn).length;

  return (
    <View style={styles.root}>
      <Screen>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          accessibilityRole="button"
          accessibilityLabel="Back to today"
          hitSlop={8}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <Text style={styles.backText}>←  Today</Text>
        </Pressable>

        <View>
          <Text style={styles.title}>Awards</Text>
          <Text style={styles.subtitle}>
            {earned === 0
              ? 'Answer questions to start your collection ♡'
              : `${earned} of ${statuses.length} earned  ·  tap one to replay it`}
          </Text>
        </View>

        {AWARD_GROUPS.map(({ group, title }) => (
          <View key={group} style={styles.section}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              {title}
            </Text>
            {statuses
              .filter((s) => s.award.group === group)
              .map((s) => (
                <AwardRow key={s.award.id} status={s} onReplay={() => celebrate([s.award])} />
              ))}
          </View>
        ))}
      </Screen>
      {celebration}
    </View>
  );
}

function AwardRow({ status, onReplay }: { status: AwardStatus; onReplay: () => void }) {
  const { award, earnedOn, progress } = status;
  const earned = !!earnedOn;
  const value = progress ? Math.min(progress.value, progress.goal) : 0;
  const detail = earned
    ? `Earned ${formatShort(earnedOn)}`
    : progress
      ? `${value} of ${progress.goal}`
      : null;

  return (
    <Pressable
      onPress={onReplay}
      disabled={!earned}
      accessibilityRole={earned ? 'button' : 'text'}
      accessibilityLabel={`${award.name}. ${award.description} ${detail ?? 'Not earned yet.'}`}
      accessibilityHint={earned ? 'Replays the celebration' : undefined}
      style={({ pressed }) => [styles.row, !earned && styles.rowLocked, pressed && styles.pressed]}
    >
      <View style={[styles.badge, earned && styles.badgeEarned]}>
        <CoffeeBadge award={award.id} size={64} locked={!earned} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.name}>{award.name}</Text>
        <Text style={styles.description}>{award.description}</Text>
        {!earned && progress && progress.goal > 1 && (
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${(value / progress.goal) * 100}%` }]} />
          </View>
        )}
        {detail && <Text style={[styles.detail, earned && styles.detailEarned]}>{detail}</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  back: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  backText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.mocha },
  title: { fontFamily: fonts.display, fontSize: 32, color: colors.espresso },
  subtitle: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.mocha, marginTop: 2 },
  section: { gap: 10 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 19, color: colors.espresso, marginTop: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.cream,
    ...shadow,
  },
  rowLocked: { backgroundColor: colors.foam, shadowOpacity: 0.05 },
  badge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.blush,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeEarned: { backgroundColor: colors.roseSoft },
  rowText: { flex: 1, gap: 3 },
  name: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.espresso },
  description: { fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: colors.mocha },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.blushDeep,
    overflow: 'hidden',
    marginTop: 4,
  },
  fill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.rose },
  detail: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.mocha },
  detailEarned: { fontFamily: fonts.bodyBold, color: colors.caramel },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
});
