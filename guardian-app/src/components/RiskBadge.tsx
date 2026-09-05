import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, riskPalette, riskTier, spacing, type } from '../theme';
import type { RiskTier } from '../theme';

type Size = 'sm' | 'md';

function iconFor(tier: RiskTier) {
  // 14×14 monochrome glyph. Inline shapes keep this dependency-free.
  switch (tier) {
    case 'high':
      return (
        <View style={styles.iconWrap}>
          <View style={[styles.iconBar, { backgroundColor: colors.high, width: 2, height: 12 }]} />
          <View style={[styles.iconDot, { backgroundColor: colors.high }]} />
        </View>
      );
    case 'medium':
      return (
        <View style={styles.iconWrap}>
          <View style={[styles.iconBar, { backgroundColor: colors.medium, width: 2, height: 10 }]} />
          <View style={[styles.iconDot, { backgroundColor: colors.medium }]} />
        </View>
      );
    case 'low':
      return (
        <View style={styles.checkWrap}>
          <View style={[styles.checkStem, { backgroundColor: colors.low }]} />
          <View style={[styles.checkFoot, { backgroundColor: colors.low }]} />
        </View>
      );
    default:
      return <View style={[styles.qMark, { backgroundColor: colors.textMuted }]} />;
  }
}

/**
 * Pill-shaped risk badge with color, icon, and a compact label.
 * Used across the dashboard feed, event detail, and voice scam checker so
 * the visual language stays consistent everywhere risk is shown.
 */
export function RiskBadge({
  score,
  size = 'md',
  showScore = true,
  style,
}: {
  score: number | null | undefined;
  size?: Size;
  showScore?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const tier = riskTier(score);
  const palette = riskPalette[tier];
  const label = showScore && score !== null && score !== undefined
    ? `${palette.label} · ${score}`
    : palette.label;

  return (
    <View
      style={[
        size === 'sm' ? styles.pillSm : styles.pillMd,
        { backgroundColor: palette.bg, borderColor: palette.fg + '33' },
        style,
      ]}
      accessibilityLabel={`${palette.label} risk${score !== null && score !== undefined ? ` score ${score}` : ''}`}
    >
      {iconFor(tier)}
      <Text style={[size === 'sm' ? styles.textSm : styles.textMd, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pillMd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  pillSm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  textMd: { ...type.caption, fontWeight: '700' },
  textSm: { ...type.micro, fontWeight: '700' },
  iconWrap: { width: 12, height: 14, justifyContent: 'center', alignItems: 'center' },
  iconBar: { borderRadius: 1 },
  iconDot: { width: 3, height: 3, borderRadius: 2, marginTop: 1 },
  checkWrap: { width: 12, height: 12, justifyContent: 'center', alignItems: 'center' },
  checkStem: {
    position: 'absolute',
    width: 2,
    height: 5,
    borderRadius: 1,
    transform: [{ rotate: '45deg' }, { translateX: 0.5 }, { translateY: -1 }],
  },
  checkFoot: {
    position: 'absolute',
    width: 2,
    height: 8,
    borderRadius: 1,
    transform: [{ rotate: '-45deg' }, { translateX: -2 }, { translateY: -2 }],
  },
  qMark: { width: 8, height: 8, borderRadius: 4 },
});
