import { BlurView } from 'expo-blur';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, shadows, spacing } from '../theme';

/**
 * Soft, layered gradient that lives behind the screen content. It gives the
 * glassmorphism cards something to diffuse, and gives the whole app a calm,
 * industry-feel color wash instead of a flat white background.
 *
 * Implementation note: the `expo-blur` docs are explicit that `BlurView` only
 * blurs content rendered *before* it in the same parent. That's why this
 * component renders the gradient first, then `BlurView`, then the children.
 */
export function GlassBackground({ children, style }: { children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.bg, style]}>
      <View style={styles.glowA} />
      <View style={styles.glowB} />
      {children}
    </View>
  );
}

type Variant = 'card' | 'panel';

/**
 * Frosted card surface. Renders the blur on top of whatever is behind the
 * card; the underlying `GlassBackground` provides the color to diffuse.
 * Falls back to a solid tinted surface on platforms where the blur method
 * isn't supported so layout never collapses.
 */
export function GlassCard({
  children,
  variant = 'card',
  style,
  intensity = 60,
}: {
  children?: React.ReactNode;
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
}) {
  const isPanel = variant === 'panel';
  return (
    <View style={[styles.outer, shadows.glass, style]}>
      <BlurView
        intensity={intensity}
        tint="light"
        style={StyleSheet.absoluteFill}
        blurMethod={Platform.OS === 'android' ? 'dimezisBlurViewSdk31Plus' : undefined}
      />
      <View style={[styles.tint, isPanel ? styles.tintPanel : styles.tintCard]} />
      <View style={styles.borderLayer} />
      <View style={isPanel ? styles.innerPanel : styles.innerCard}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  glowA: {
    position: 'absolute',
    top: -140,
    left: -100,
    width: 360,
    height: 360,
    borderRadius: 360,
    backgroundColor: '#C7D2FE',
    opacity: 0.55,
  },
  glowB: {
    position: 'absolute',
    bottom: -180,
    right: -120,
    width: 420,
    height: 420,
    borderRadius: 420,
    backgroundColor: '#BFDBFE',
    opacity: 0.5,
  },
  outer: {
    borderRadius: radii.xl,
    overflow: 'hidden',
  },
  tint: {
    ...StyleSheet.absoluteFill,
  },
  tintCard: {
    backgroundColor: 'rgba(255,255,255,0.62)',
  },
  tintPanel: {
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  borderLayer: {
    ...StyleSheet.absoluteFill,
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  innerCard: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  innerPanel: {
    padding: spacing.xl,
    gap: spacing.md,
  },
});
