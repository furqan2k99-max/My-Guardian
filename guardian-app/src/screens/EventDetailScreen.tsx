import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Platform } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ApiRequestError, getEvent, reviewEvent } from '../api';
import type { FlaggedEvent, GuardianAction } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { PrimaryButton } from '../components/PrimaryButton';
import { RiskBadge } from '../components/RiskBadge';
import { Screen } from '../components/Screen';
import {
  formatElderAction,
  formatEventType,
  formatRiskReason,
  shortenHash,
  timeAgo,
} from '../utils/format';
import { colors, radii, shadows, spacing, type, riskTier } from '../theme';

/**
 * One flagged event in full, for the linked guardian: what arrived, when,
 * how risky it looked, and the review actions (mark reviewed / dismiss).
 */
export function EventDetailScreen() {
  const { token, signOut } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<{ Alerts: undefined }>>();
  const { params } = useRoute<{ key: string; name: string; params: { eventId: string } }>();

  const [event, setEvent] = useState<FlaggedEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setEvent(await getEvent(token, params.eventId));
      setError(null);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 401) {
        await signOut();
        return;
      }
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  }, [token, params.eventId, signOut]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = useCallback(
    async (action: GuardianAction) => {
      if (!token || !event || acting) return;
      setActing(true);
      try {
        setEvent(await reviewEvent(token, event.id, action));
        setError(null);
      } catch (err) {
        if (err instanceof ApiRequestError && err.status === 401) {
          await signOut();
          return;
        }
        setError(err instanceof Error ? err.message : 'Unexpected error');
      } finally {
        setActing(false);
      }
    },
    [token, event, acting, signOut],
  );

  return (
    <Screen>
      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.goBack()}
        hitSlop={8}
        style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}
      >
        <Text style={styles.backText}>‹  Back</Text>
      </Pressable>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.muted}>Loading event…</Text>
        </View>
      ) : error && !event ? (
        <View style={styles.container}>
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Couldn’t load this event</Text>
            <Text style={styles.errorText}>{error}</Text>
            <PrimaryButton title="Try again" onPress={() => void load()} variant="primary" />
          </View>
        </View>
      ) : event ? (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={[styles.heroCard, shadows.glass]}>
            <BlurView
              intensity={60}
              tint="light"
              style={StyleSheet.absoluteFill}
              blurMethod={Platform.OS === 'android' ? 'dimezisBlurViewSdk31Plus' : undefined}
            />
            <View style={styles.heroTint} />
            <View style={[styles.heroBorder, { borderColor: riskColor(riskTier(event.risk_score)) + '55' }]} />

            <View style={styles.heroInner}>
              <View style={styles.heroTopRow}>
                <View style={styles.typePill}>
                  <Text style={styles.typePillText}>{formatEventType(event.event_type)}</Text>
                </View>
                <RiskBadge score={event.risk_score} size="md" />
              </View>
              <Text style={styles.heroTitle}>
                Flagged {formatEventType(event.event_type).toLowerCase()} event
              </Text>
              <Text style={styles.heroTime}>{timeAgo(event.created_at)}</Text>

              <View style={styles.scoreRow}>
                <View>
                  <Text style={styles.scoreKicker}>RISK SCORE</Text>
                  <Text style={[styles.scoreNumber, { color: riskColor(riskTier(event.risk_score)) }]}>
                    {event.risk_score ?? '—'}
                  </Text>
                </View>
                <View style={styles.scoreBarOuter}>
                  <View
                    style={[
                      styles.scoreBarInner,
                      {
                        width: `${event.risk_score ?? 0}%`,
                        backgroundColor: riskColor(riskTier(event.risk_score)),
                      },
                    ]}
                  />
                </View>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Event details</Text>
            <DetailRow label="From sender" value={shortenHash(event.sender_hash, 12)} mono />
            <DetailRow
              label="Elder"
              value={event.elder_user ? `Elder ${shortenHash(event.elder_user.phone_number_hash)}` : '—'}
            />
            {event.guardian_notified_at && (
              <DetailRow label="Notified you" value={timeAgo(event.guardian_notified_at)} />
            )}
          </View>

          {event.risk_reasons.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Why it was flagged</Text>
              <View style={styles.reasons}>
                {event.risk_reasons.map((reason) => (
                  <View key={reason} style={styles.reasonChip}>
                    <Text style={styles.reasonText}>{formatRiskReason(reason)}</Text>
                  </View>
                ))}
              </View>
              {formatElderAction(event.elder_action) === '' && (
                <Text style={styles.hint}>
                  The elder marked this themselves — there is no automatic
                  risk analysis yet for this type of event.
                </Text>
              )}
            </View>
          )}

          {formatElderAction(event.elder_action) !== '' && (
            <View style={[styles.section, styles.actionSection]}>
              <View style={styles.actionDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.actionKicker}>ELDER ACTION</Text>
                <Text style={styles.actionText}>{formatElderAction(event.elder_action)}</Text>
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your review</Text>
            {event.guardian_action ? (
              <View style={styles.reviewedRow}>
                <View style={styles.reviewedDot} />
                <Text style={styles.reviewedText}>
                  {event.guardian_action === 'reviewed' ? 'Marked reviewed' : 'Dismissed'}
                  {event.guardian_reviewed_at ? ` · ${timeAgo(event.guardian_reviewed_at)}` : ''}
                </Text>
              </View>
            ) : (
              <View style={styles.reviewActions}>
                <PrimaryButton
                  title="Mark reviewed"
                  onPress={() => void act('reviewed')}
                  loading={acting}
                />
                <PrimaryButton
                  title="Dismiss"
                  onPress={() => void act('dismissed')}
                  disabled={acting}
                  variant="ghost"
                />
              </View>
            )}
          </View>

          {error && <Text style={styles.error}>{error}</Text>}
        </ScrollView>
      ) : null}
    </Screen>
  );
}

function riskColor(tier: ReturnType<typeof riskTier>) {
  return tier === 'high' ? colors.high : tier === 'medium' ? colors.medium : tier === 'low' ? colors.low : colors.textMuted;
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, mono && styles.mono]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  back: { marginBottom: spacing.md, paddingVertical: 4 },
  backText: { ...type.bodyStrong, color: colors.accent },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  muted: { ...type.body, color: colors.textMuted },
  container: { flex: 1, justifyContent: 'center', gap: spacing.md, padding: spacing.lg },

  errorCard: {
    backgroundColor: colors.highSoft,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  errorTitle: { ...type.subtitle, color: colors.high, fontWeight: '700' },
  errorText: { ...type.body, color: colors.high },

  scroll: { paddingBottom: spacing.xxl, gap: spacing.lg },

  heroCard: { borderRadius: radii.xl, overflow: 'hidden' },
  heroTint: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255,255,255,0.66)' },
  heroBorder: { ...StyleSheet.absoluteFill, borderRadius: radii.xl, borderWidth: 1.5 },
  heroInner: { padding: spacing.xl, gap: spacing.sm },

  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  typePill: {
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  typePillText: { ...type.caption, color: colors.accentInk, fontWeight: '700' },

  heroTitle: { ...type.title, color: colors.text, marginTop: spacing.xs },
  heroTime: { ...type.caption, color: colors.textMuted },

  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  scoreKicker: { ...type.micro, color: colors.textMuted, marginBottom: 2 },
  scoreNumber: { fontSize: 40, lineHeight: 44, fontWeight: '800', letterSpacing: -1 },
  scoreBarOuter: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(15,23,42,0.08)',
    overflow: 'hidden',
  },
  scoreBarInner: { height: 10, borderRadius: 5 },

  section: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  sectionTitle: { ...type.subtitle, color: colors.text },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 2,
  },
  rowLabel: { ...type.caption, color: colors.textMuted, fontWeight: '500' },
  rowValue: { ...type.bodyStrong, color: colors.text, flexShrink: 1, textAlign: 'right' },
  mono: { fontFamily: type.familyMono },

  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  reasonChip: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  reasonText: { ...type.caption, color: colors.text, fontWeight: '600' },
  hint: { ...type.caption, color: colors.textMuted, marginTop: spacing.xs },

  actionSection: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  actionDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.low },
  actionKicker: { ...type.micro, color: colors.textMuted, marginBottom: 2 },
  actionText: { ...type.bodyStrong, color: colors.text },

  reviewActions: { gap: spacing.sm },
  reviewedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reviewedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.low },
  reviewedText: { ...type.bodyStrong, color: colors.text },

  error: { ...type.caption, color: colors.danger, fontWeight: '600' },
});
