import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, type } from '../theme';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
}

export function PrimaryButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
}: PrimaryButtonProps) {
  const palette = {
    primary: { background: colors.accent, pressed: colors.accentPressed, text: colors.onAccent, border: 'transparent' },
    secondary: { background: colors.surface, pressed: colors.surfaceMuted, text: colors.text, border: colors.border },
    danger: { background: colors.danger, pressed: '#991B1B', text: '#ffffff', border: 'transparent' },
    ghost: { background: 'transparent', pressed: 'rgba(15,23,42,0.04)', text: colors.accent, border: 'transparent' },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: pressed ? palette.pressed : palette.background, borderColor: palette.border },
        (disabled || loading) && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} />
      ) : (
        <View style={styles.row}>
          <Text style={[styles.label, { color: palette.text }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  disabled: { opacity: 0.5 },
  label: {
    ...type.bodyStrong,
    fontSize: 16,
  },
});
