import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { API_BASE_URL } from '../api';
import { useAuth } from '../auth/AuthContext';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { describeAuthError, signInWithEmail, signUpWithEmail } from '../firebase/auth';
import { colors, spacing } from '../theme';
import type { RootStackParamList } from '../navigation/types';

/**
 * Default guardian sign-in: email + password -> Firebase ID token. The token
 * is exchanged for a MyGuardian session on the backend. First-time users tap
 * "Create account"; returning users "Sign in". In dev builds only, a subtle
 * "Dev sign-in" link keeps the old dev-login screen reachable — it is never
 * the default and never renders in production.
 */
export function EmailAuthScreen() {
  const { signIn } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signUp');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!email.trim()) {
      setError('Enter your email address.');
      return;
    }
    if (!password) {
      setError('Enter your password.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const idToken =
        mode === 'signUp'
          ? await signUpWithEmail(email, password)
          : await signInWithEmail(email, password);
      await signIn(idToken);
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <Text style={styles.title}>MyGuardian</Text>
          <Text style={styles.subtitle}>
            {mode === 'signUp'
              ? 'Create your guardian account with an email and password.'
              : 'Welcome back \u2014 sign in with your email and password.'}
          </Text>

          <TextField
            value={email}
            onChangeText={setEmail}
            placeholder="Email address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            returnKeyType="next"
            editable={!busy}
          />
          <TextField
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            secureTextEntry
            autoComplete={mode === 'signUp' ? 'new-password' : 'password'}
            returnKeyType="done"
            onSubmitEditing={onSubmit}
            editable={!busy}
          />

          <PrimaryButton
            title={mode === 'signUp' ? 'Create account' : 'Sign in'}
            onPress={onSubmit}
            loading={busy}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text
            style={styles.toggle}
            onPress={() => {
              setMode(mode === 'signUp' ? 'signIn' : 'signUp');
              setError(null);
            }}
          >
            {mode === 'signUp'
              ? 'Already have an account? Sign in'
              : 'New here? Create an account'}
          </Text>

          {__DEV__ ? (
            <Text style={styles.devLink} onPress={() => navigation.navigate('DevLogin')}>
              Dev sign-in
            </Text>
          ) : null}

          <Text style={styles.caption}>API: {API_BASE_URL}</Text>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
  error: {
    color: colors.danger,
    textAlign: 'center',
  },
  toggle: {
    fontSize: 14,
    color: colors.primary,
    textAlign: 'center',
  },
  devLink: {
    marginTop: spacing.lg,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  caption: {
    marginTop: spacing.lg,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
});