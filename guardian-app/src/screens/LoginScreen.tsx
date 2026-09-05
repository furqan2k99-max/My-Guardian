import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { API_BASE_URL } from '../api';
import { useAuth } from '../auth/AuthContext';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { colors, spacing } from '../theme';

export function LoginScreen() {
  const { devSignIn } = useAuth();
  const [phoneNumberHash, setPhoneNumberHash] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!phoneNumberHash.trim()) {
      Alert.alert('Enter a phone hash', 'Type a dev phone number hash to sign in.');
      return;
    }
    setSubmitting(true);
    try {
      await devSignIn(phoneNumberHash.trim());
    } catch (err) {
      Alert.alert(
        'Could not sign in',
        err instanceof Error ? err.message : 'Unexpected error',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.title}>MyGuardian</Text>
        <Text style={styles.subtitle}>Dev sign-in (not in production)</Text>

        <TextField
          value={phoneNumberHash}
          onChangeText={setPhoneNumberHash}
          placeholder="Phone number hash (dev)"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          returnKeyType="done"
          onSubmitEditing={onSubmit}
          editable={!submitting}
        />

        <PrimaryButton title="Continue" onPress={onSubmit} loading={submitting} />

        <Text style={styles.caption}>API: {API_BASE_URL}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  caption: {
    marginTop: spacing.lg,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
});