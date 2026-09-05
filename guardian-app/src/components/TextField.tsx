import { StyleSheet, TextInput, TextInputProps } from 'react-native';
import { colors, radii, spacing } from '../theme';

export function TextField({ style, ...props }: TextInputProps) {
  return <TextInput {...props} style={[styles.input, style]} placeholderTextColor={colors.textMuted} />;
}

const styles = StyleSheet.create({
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
});