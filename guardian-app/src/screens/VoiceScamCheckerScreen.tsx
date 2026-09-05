import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { analyzeAudioFile, type AudioAnalysisResult } from '../api/audio';
import { ApiRequestError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { formatRiskReason } from '../utils/format';
import { colors, radii, spacing } from '../theme';

type RiskLevel = { label: string; color: string; background: string };

function riskLevel(score: number): RiskLevel {
  if (score >= 75) return { label: `High Â· ${score}`, color: colors.danger, background: '#fee2e2' };
  if (score >= 50) return { label: `Medium Â· ${score}`, color: colors.amber, background: '#fef3c7' };
  if (score > 0) return { label: `Low Â· ${score}`, color: colors.green, background: '#dcfce7' };
  return { label: 'No scam patterns found', color: colors.green, background: '#dcfce7' };
}

const DEMO_DESCRIPTION =
  'This is an experimental demo of what MyGuardian could do one day: analyze ' +
  'a phone call\u2019s audio for scam patterns. Real-time call analysis is not ' +
  'possible on Android today. You can try the analysis engine here by ' +
  'recording any sample conversation \u2014 audio is analyzed and discarded ' +
  'immediately, never stored.';

/**
 * Forward-looking demo of the scam-analysis engine: record a sample
 * conversation and see how the rule-based scorer would rate it. Deliberately
 * presented as experimental â€” not part of the core guardian flow.
 */
export function VoiceScamCheckerScreen() {
  const { token, signOut } = useAuth();
  const navigation =
    useNavigation<NativeStackNavigationProp<{ Alerts: undefined }>>();

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

  const [permissionDenied, setPermissionDenied] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AudioAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      await AudioModule.requestRecordingPermissionsAsync();
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
    })();
  }, []);

  const startRecording = async () => {
    setError(null);
    setResult(null);
    setRecorded(false);
    const status = await AudioModule.getRecordingPermissionsAsync();
    if (status.status !== 'granted') {
      const request = await AudioModule.requestRecordingPermissionsAsync();
      if (!request.granted) {
        setPermissionDenied(true);
        return;
      }
    }
    setPermissionDenied(false);
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    try {
      await recorder.prepareToRecordAsync(RecordingPresets.HIGH_QUALITY);
      recorder.record();
      console.log('[VSC] recording started');
    } catch (e) {
      console.log('[VSC] start failed:', e instanceof Error ? e.message : String(e));
    }
  };

  const stopAndAnalyze = async () => {
    console.log('[VSC] stop requested at', Math.round(recorderState.durationMillis), 'ms, isRecording:', recorderState.isRecording);
    if (!recorderState.isRecording) return;
    await recorder.stop();
    const uri = recorder.uri;
    console.log('[VSC] stopped, uri:', uri);
    if (!uri || !token) return;
    setRecorded(true);
    setAnalyzing(true);
    setError(null);
    try {
      setResult(await analyzeAudioFile(token, uri));
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 401) {
        await signOut();
        return;
      }
      // Debug visibility while the demo stabilizes.
      setError(
        `${err instanceof Error ? err.message : 'Unexpected error'}`,
      );
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <Screen>
      <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} hitSlop={8}>
        <Text style={styles.back}>&larr; Back to alerts</Text>
      </Pressable>

      <View style={styles.titleRow}>
        <Text style={styles.title}>Voice Scam Checker</Text>
        <View style={styles.betaBadge}>
          <Text style={styles.betaText}>DEMO</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.panel, styles.demoPanel]}>
          <Text style={styles.demoText}>{DEMO_DESCRIPTION}</Text>
        </View>

        <PrimaryButton
          title={
            recorderState.isRecording
              ? `Stop recording (${Math.round(recorderState.durationMillis / 1000)}s)`
              : recorded
                ? 'Record again'
                : 'Start recording'
          }
          onPress={recorderState.isRecording ? stopAndAnalyze : startRecording}
          loading={analyzing}
          disabled={permissionDenied}
        />

        {recorderState.isRecording && (
          <View style={styles.recordingRow}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>Recordingâ€¦ speak clearly</Text>
          </View>
        )}

        {permissionDenied && (
          <Text style={styles.error}>
            Microphone access was denied. Enable it in system settings to use this demo.
          </Text>
        )}

        {analyzing && <Text style={styles.muted}>Analyzing recordingâ€¦</Text>}

        {result && !analyzing && (
          <View style={[styles.panel, styles.resultPanel]}>
            {(() => {
              const risk = riskLevel(result.risk_score);
              return (
                <View style={[styles.badge, { backgroundColor: risk.background }]}>
                  <Text style={[styles.badgeText, { color: risk.color }]}>{risk.label}</Text>
                </View>
              );
            })()}

            {result.risk_reasons.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>Scam patterns detected</Text>
                <View style={styles.chips}>
                  {result.risk_reasons.map((reason) => (
                    <View key={reason} style={styles.chip}>
                      <Text style={styles.chipText}>{formatRiskReason(reason)}</Text>
                    </View>
                  ))}
                </View>
                {result.matches.length > 0 && (
                  <Text style={styles.matchedText}>
                    Matched: â€œ{result.matches[0].excerpt}â€
                  </Text>
                )}
              </>
            ) : (
              <Text style={styles.sectionTitle}>
                No known scam patterns in this recording.
              </Text>
            )}

            <Text style={styles.hint}>
              {`Analyzed ${Math.round(result.duration_seconds)}s of audio - nothing was stored`}
            </Text>
          </View>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    flexShrink: 1,
  },
  betaBadge: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  betaText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  scroll: {
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  panel: {
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  demoPanel: {
    backgroundColor: colors.surface,
  },
  demoText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  resultPanel: {
    backgroundColor: colors.surface,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  chipText: {
    fontSize: 12,
    color: colors.text,
  },
  matchedText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: colors.textMuted,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
  },
  recordingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.danger,
  },
  recordingText: {
    fontSize: 14,
    color: colors.danger,
    fontWeight: '600',
  },
  muted: {
    fontSize: 14,
    color: colors.textMuted,
  },
  error: {
    fontSize: 13,
    color: colors.danger,
  },
});