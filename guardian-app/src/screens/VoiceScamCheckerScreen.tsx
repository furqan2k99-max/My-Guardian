import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Platform } from 'react-native';
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
import { RiskBadge } from '../components/RiskBadge';
import { Screen } from '../components/Screen';
import { formatRiskReason } from '../utils/format';
import { colors, radii, shadows, spacing, type, riskTier } from '../theme';

const DEMO_DESCRIPTION =
  'Try the analysis engine: record a sample conversation and the rules-based ' +
  'scorer will rate it instantly. Audio is analyzed and discarded � never stored.';

/**
 * Forward-looking demo of the scam-analysis engine: record a sample
 * conversation and see how the rule-based scorer would rate it. Deliberately
 * presented as experimental � not part of the core guardian flow.
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start recording');
    }
  };

  const stopAndAnalyze = async () => {
    if (!recorderState.isRecording) return;
    await recorder.stop();
    const uri = recorder.uri;
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
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setAnalyzing(false);
    }
  };

  const isRecording = recorderState.isRecording;

  return (
    <Screen>
      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.goBack()}
        hitSlop={8}
        style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}
      >
        <Text style={styles.backText}>�  Back</Text>
      </Pressable>

      <View style={styles.titleBlock}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Voice Scam Checker</Text>
          <View style={styles.betaBadge}>
            <Text style={styles.betaText}>DEMO</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>{DEMO_DESCRIPTION}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.recorderCard, shadows.glass]}>
          <BlurView
            intensity={50}
            tint="light"
            style={StyleSheet.absoluteFill}
            blurMethod={Platform.OS === 'android' ? 'dimezisBlurViewSdk31Plus' : undefined}
          />
          <View style={styles.recorderTint} />
          <View style={styles.recorderBorder} />
          <View style={styles.recorderInner}>
            <View style={[styles.bigMic, isRecording && styles.bigMicRecording]}>
              <View style={[styles.bigMicBar, isRecording && styles.bigMicBarRec]} />
              <View style={[styles.bigMicBase, isRecording && styles.bigMicBaseRec]} />
              <View style={[styles.bigMicStem, isRecording && styles.bigMicStemRec]} />
            </View>
            <Text style={styles.recorderStatus}>
              {isRecording
                ? `Recording  �  ${Math.round(recorderState.durationMillis / 1000)}s`
                : recorded
                  ? 'Recording captured'
                  : 'Ready to listen'}
            </Text>
            <Text style={styles.recorderHint}>
              {isRecording
                ? 'Tap stop when you are done'
                : recorded
                  ? 'Tap record again to redo, or analyze a new sample'
                  : 'Tap the button below to start recording'}
            </Text>
            <PrimaryButton
              title={
                isRecording
                  ? 'Stop & analyze'
                  : recorded
                    ? 'Record again'
                    : 'Start recording'
              }
              onPress={isRecording ? stopAndAnalyze : startRecording}
              loading={analyzing}
              disabled={permissionDenied}
            />
          </View>
        </View>

        {permissionDenied && (
          <View style={styles.warnBox}>
            <Text style={styles.warnText}>
              Microphone access was denied. Enable it in system settings to use this demo.
            </Text>
          </View>
        )}

        {analyzing && (
          <View style={[styles.analyzingCard, shadows.card]}>
            <BlurView
              intensity={50}
              tint="light"
              style={StyleSheet.absoluteFill}
              blurMethod={Platform.OS === 'android' ? 'dimezisBlurViewSdk31Plus' : undefined}
            />
            <View style={styles.analyzingTint} />
            <View style={styles.analyzingRow}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.analyzingText}>Analyzing your recording�</Text>
            </View>
          </View>
        )}

        {result && !analyzing && (
          <ResultCard result={result} />
        )}

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.footerNote}>
          <Text style={styles.footerText}>
            Privacy: audio is analyzed and immediately discarded. Nothing is saved.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

function ResultCard({ result }: { result: AudioAnalysisResult }) {
  const tier = riskTier(result.risk_score);
  const accentByTier = {
    high: colors.high,
    medium: colors.medium,
    low: colors.low,
    unknown: colors.textMuted,
  }[tier];

  return (
    <View style={styles.resultWrap}>
      <View style={[styles.resultCard, shadows.glass, { borderColor: accentByTier + '40' }]}>
        <BlurView
          intensity={70}
          tint="light"
          style={StyleSheet.absoluteFill}
          blurMethod={Platform.OS === 'android' ? 'dimezisBlurViewSdk31Plus' : undefined}
        />
        <View style={styles.resultTint} />
        <View style={[styles.resultBorder, { borderColor: accentByTier + '55' }]} />
        <View style={styles.resultInner}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultLabel}>ANALYSIS RESULT</Text>
            <RiskBadge score={result.risk_score} size="md" />
          </View>

          <View style={styles.scoreBlock}>
            <Text style={[styles.scoreValue, { color: accentByTier }]}>
              {result.risk_score}
            </Text>
            <Text style={styles.scoreOutOf}>/ 100</Text>
          </View>

          <View style={styles.scoreBarOuter}>
            <View
              style={[
                styles.scoreBarInner,
                { width: `${Math.min(100, Math.max(0, result.risk_score))}%`, backgroundColor: accentByTier },
              ]}
            />
          </View>

          {result.risk_reasons.length > 0 ? (
            <View style={styles.reasonsBlock}>
              <Text style={styles.reasonsTitle}>Patterns detected</Text>
              <View style={styles.chips}>
                {result.risk_reasons.map((reason) => (
                  <View key={reason} style={styles.chip}>
                    <Text style={styles.chipText}>{formatRiskReason(reason)}</Text>
                  </View>
                ))}
              </View>
              {result.matches.length > 0 && (
                <View style={styles.matchBox}>
                  <Text style={styles.matchKicker}>MATCHED PHRASE</Text>
                  <Text style={styles.matchText}>�{result.matches[0].excerpt}�</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.cleanBlock}>
              <Text style={styles.cleanTitle}>No known scam patterns in this recording.</Text>
            </View>
          )}

          
          {result.supporting_reasons && result.supporting_reasons.length > 0 && (
            <View style={styles.routineBlock}>
              <Text style={styles.routineKicker}>ROUTINE CONTEXT</Text>
              <Text style={styles.routineText}>
                The caller asked for {result.supporting_reasons.map(formatRiskReason).join(', ').toLowerCase()} —
                these are normal details for a legitimate payment to you, which is why the
                score dropped.
              </Text>
            </View>
          )}
          <View style={styles.resultFooter}>
            <Text style={styles.resultFooterText}>
              Analyzed {Math.round(result.duration_seconds)}s � nothing was stored
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  back: { marginBottom: spacing.md, paddingVertical: 4 },
  backText: { ...type.bodyStrong, color: colors.accent },

  titleBlock: { marginBottom: spacing.lg },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 6,
  },
  title: {
    ...type.title,
    color: colors.text,
  },
  betaBadge: {
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  betaText: { ...type.micro, color: colors.accentInk },
  subtitle: {
    ...type.body,
    color: colors.textMuted,
  },

  scroll: { paddingBottom: spacing.xxl, gap: spacing.lg },

  recorderCard: { borderRadius: radii.xl, overflow: 'hidden' },
  recorderTint: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255,255,255,0.62)' },
  recorderBorder: { ...StyleSheet.absoluteFill, borderRadius: radii.xl, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.9)' },
  recorderInner: { padding: spacing.xl, alignItems: 'center', gap: spacing.md },

  bigMic: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  bigMicRecording: { backgroundColor: colors.highSoft },
  bigMicBar: { width: 16, height: 28, borderRadius: 8, backgroundColor: colors.accent },
  bigMicBarRec: { backgroundColor: colors.high },
  bigMicBase: { position: 'absolute', bottom: 22, width: 28, height: 3, borderRadius: 2, backgroundColor: colors.accent },
  bigMicBaseRec: { backgroundColor: colors.high },
  bigMicStem: { position: 'absolute', bottom: 14, width: 2, height: 10, backgroundColor: colors.accent },
  bigMicStemRec: { backgroundColor: colors.high },

  recorderStatus: { ...type.subtitle, color: colors.text },
  recorderHint: { ...type.caption, color: colors.textMuted, textAlign: 'center', maxWidth: 280 },

  warnBox: {
    backgroundColor: colors.mediumSoft,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  warnText: { ...type.caption, color: colors.medium, fontWeight: '600' },

  analyzingCard: { borderRadius: radii.lg, overflow: 'hidden' },
  analyzingTint: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255,255,255,0.7)' },
  analyzingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  analyzingText: { ...type.bodyStrong, color: colors.text },

  resultWrap: {},
  resultCard: { borderRadius: radii.xl, overflow: 'hidden', borderWidth: 1 },
  resultTint: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255,255,255,0.7)' },
  resultBorder: { ...StyleSheet.absoluteFill, borderRadius: radii.xl, borderWidth: 1.5 },
  resultInner: { padding: spacing.xl, gap: spacing.md },

  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultLabel: { ...type.micro, color: colors.textMuted },

  scoreBlock: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: spacing.sm },
  scoreValue: { fontSize: 56, lineHeight: 60, fontWeight: '800', letterSpacing: -1.5 },
  scoreOutOf: { ...type.subtitle, color: colors.textMuted, fontWeight: '600' },

  scoreBarOuter: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(15,23,42,0.08)',
    overflow: 'hidden',
  },
  scoreBarInner: { height: 8, borderRadius: 4 },

  reasonsBlock: { marginTop: spacing.md, gap: spacing.sm },
  reasonsTitle: { ...type.bodyStrong, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    backgroundColor: 'rgba(29,78,216,0.08)',
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  chipText: { ...type.caption, color: colors.accentInk, fontWeight: '600' },

  matchBox: {
    backgroundColor: 'rgba(15,23,42,0.04)',
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  matchKicker: { ...type.micro, color: colors.textMuted, marginBottom: 4 },
  matchText: { ...type.body, color: colors.text, fontStyle: 'italic' },

  cleanBlock: { marginTop: spacing.md, padding: spacing.md, backgroundColor: 'rgba(21,128,61,0.08)', borderRadius: radii.md },
  cleanTitle: { ...type.body, color: colors.low, fontWeight: '600' },

  routineBlock: { marginTop: spacing.md, padding: spacing.md, backgroundColor: 'rgba(29,78,216,0.06)', borderRadius: radii.md, borderWidth: 1, borderColor: 'rgba(29,78,216,0.18)' },
  routineKicker: { ...type.micro, color: colors.accentInk, marginBottom: 4 },
  routineText: { ...type.body, color: colors.text, lineHeight: 22 },

  resultFooter: {
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(15,23,42,0.08)',
  },
  resultFooterText: { ...type.caption, color: colors.textMuted },

  errorBox: {
    backgroundColor: colors.highSoft,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  errorText: { ...type.caption, color: colors.high, fontWeight: '600' },

  footerNote: { alignItems: 'center', paddingTop: spacing.md },
  footerText: { ...type.caption, color: colors.textMuted, textAlign: 'center' },
});
