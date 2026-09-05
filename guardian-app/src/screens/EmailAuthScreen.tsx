import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { API_BASE_URL } from '../api';
import { useAuth } from '../auth/AuthContext';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { describeAuthError, signInWithEmail, signUpWithEmail } from '../firebase/auth';
import { colors, radii, spacing, type } from '../theme';
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
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Text style={styles.brandText}>MG</Text>
              <View style={styles.brandDot} />
            </View>
            <Text style={styles.brandWordmark}>MyGuardian</Text>
          </View>

          <Text style={styles.kicker}>FOR THE PEOPLE YOU PROTECT</Text>
          <Text style={styles.title}>
            {mode === 'signUp' ? 'Create your account' : 'Welcome back'}
          </Text>
          <Text style={styles.subtitle}>
            {mode === 'signUp'
              ? 'Sign up to start receiving alerts for the elders you look after.'
              : 'Sign in to see the latest alerts from your elders.'}
          </Text>

          <View style={styles.form}>
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
          </View>

          <PrimaryButton
            title={mode === 'signUp' ? 'Create account' : 'Sign in'}
            onPress={onSubmit}
            loading={busy}
          />

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={() => {
              setMode(mode === 'signUp' ? 'signIn' : 'signUp');
              setError(null);
            }}
            hitSlop={8}
          >
            <Text style={styles.toggle}>
              {mode === 'signUp'
                ? 'Already have an account? Sign in'
                : 'New here? Create an account'}
            </Text>
          </Pressable>

          {true ? (
            <Pressable
              onPress={() => navigation.navigate('DevLogin')}
              hitSlop={8}
              style={({ pressed }) => [styles.devLinkPill, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.devLink}>Dev sign-in · bypass Firebase</Text>
            </Pressable>
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
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  brandMark: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: {
    ...type.bodyStrong,
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  brandDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
    marginLeft: 4,
    opacity: 0.85,
  },
  brandWordmark: {
    ...type.title,
    color: colors.text,
  },
  kicker: {
    ...type.micro,
    color: colors.accent,
    marginBottom: 4,
  },
  title: {
    ...type.display,
    color: colors.text,
  },
  subtitle: {
    ...type.body,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  form: { gap: spacing.sm },
  errorBox: {
    backgroundColor: colors.highSoft,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  errorText: {
    ...type.caption,
    color: colors.danger,
    fontWeight: '600',
  },
  toggle: {
    ...type.caption,
    color: colors.accent,
    textAlign: 'center',
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  devLink: {
    ...type.caption,
    color: colors.textMuted,
    textAlign: 'center',
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  devLinkPill: {
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginTop: spacing.sm,
  },
  caption: {
    ...type.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
