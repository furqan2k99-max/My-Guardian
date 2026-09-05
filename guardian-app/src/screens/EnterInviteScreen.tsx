import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { ApiRequestError, createInvite } from '../api';
import { useAuth } from '../auth/AuthContext';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { colors, spacing } from '../theme';

/**
 * Authenticated, unpaired guardian flow. The guardian generates a pairing
 * code (POST /api/v1/family-links/invite), shares it with their elder, then
 * polls link status (GET /api/v1/family-links) until the elder accepts.
 */
export function EnterInviteScreen() {
  const { token, signOut, refreshPairing } = useAuth();
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const generate = useCallback(async () => {
    if (!token) return;
    setGenerating(true);
    try {
      const { invite_code } = await createInvite(token);
      setInviteCode(invite_code);
      setCopied(false);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 401) {
        await signOut();
      } else {
        Alert.alert(
          'Could not create invite',
          err instanceof Error ? err.message : 'Unexpected error',
        );
      }
    } finally {
      setGenerating(false);
    }
  }, [token, signOut]);

  const copyCode = useCallback(async () => {
    if (!inviteCode) return;
    await Clipboard.setStringAsync(inviteCode);
    setCopied(true);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopied(false), 2500);
  }, [inviteCode]);

  const checkNow = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      await refreshPairing();
    } finally {
      setRefreshing(false);
    }
  }, [token, refreshPairing]);

  // Generate a fresh code on first render.
  useEffect(() => {
    void generate();
  }, [generate]);

  // Poll until the elder accepts and the app flips to the Paired flow.
  useEffect(() => {
    pollingRef.current = setInterval(() => {
      void refreshPairing();
    }, 5000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, [refreshPairing]);

  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.title}>Pair with your elder</Text>
        <Text style={styles.subtitle}>
          Share this 6-character code — your elder enters it in their MyGuardian
          app to accept. It expires in 15 minutes.
        </Text>

        <View style={styles.codeBox}>
          <Text style={styles.code} testID="invite-code">
            {inviteCode ?? 'Generating…'}
          </Text>
        </View>

        <PrimaryButton
          title={copied ? 'Copied!' : 'Copy code'}
          onPress={copyCode}
          disabled={!inviteCode}
          variant="secondary"
        />

        <Text style={styles.hint}>
          Waiting for your elder to accept — this screen updates automatically.
        </Text>

        <PrimaryButton
          title="Generate a new code"
          onPress={generate}
          loading={generating}
          variant="secondary"
        />
        <PrimaryButton title="Check again" onPress={checkNow} loading={refreshing} disabled={!inviteCode} />
        <PrimaryButton title="Sign out" onPress={signOut} variant="danger" />
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
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textMuted,
  },
  codeBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    alignItems: 'center',
  },
  code: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  hint: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
});