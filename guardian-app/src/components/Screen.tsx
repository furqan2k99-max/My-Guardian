import { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';
import { GlassBackground } from './GlassCard';

interface ScreenProps {
  children: ReactNode;
  /** When true, paint the soft layered background behind the content. */
  glass?: boolean;
  style?: ViewStyle;
}

/**
 * Full-height safe-area container with the app's standard page padding.
 * Pass `glass` to put a soft gradient background behind the content so glass
 * cards have something to diffuse.
 */
export function Screen({ children, glass = true, style }: ScreenProps) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {glass && <GlassBackground />}
      <View style={[styles.content, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
});
