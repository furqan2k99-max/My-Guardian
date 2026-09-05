import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ApiRequestError, getEvent, reviewEvent } from '../api';
import type { FlaggedEvent, GuardianAction } from '../api';
import { useAuth } from '../auth/AuthContext';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import {
  formatElderAction,
  formatEventType,
  formatRiskReason,
  shortenHash,
  timeAgo,
} from '../utils/format';
import { colors, radii, spacing } from '../theme';

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
      <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} hitSlop={8}>
        <Text style={styles.back}>&larr; Back to alerts</Text>
      </Pressable>

      {loading ? (
        <Text style={styles.muted}>Loading…</Text>
      ) : error && !event ? (
        <View style={styles.container}>
          <Text style={styles.error}>{error}</Text>
          <PrimaryButton title="Try again" onPress={() => void load()} />
        </View>
      ) : event ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={[styles.badge, styles.typeBadge]}>
            <Text style={styles.badgeText}>{formatEventType(event.event_type)}</Text>
          </View>
          <Text style={styles.title}>
            Flagged {formatEventType(event.event_type).toLowerCase()} event
          </Text>
          <Text style={styles.muted}>{timeAgo(event.created_at)}</Text>

          <View style={styles.section}>
            <DetailRow label="From sender" value={shortenHash(event.sender_hash, 12)} mono />
            <DetailRow
              label="Elder"
              value={event.elder_user ? `Elder ${shortenHash(event.elder_user.phone_number_hash)}` : '—'}
            />
            <DetailRow
              label="Risk score"
              value={event.risk_score !== null ? String(event.risk_score) : 'Unknown yet'}
            />
            {event.guardian_notified_at && (
              <DetailRow label="Guardians notified" value={timeAgo(event.guardian_notified_at)} />
            )}
          </View>

          {event.risk_reasons.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Why it was flagged</Text>
              <View style={styles.reasons}>
                {event.risk_reasons.map((reason) => (
                  <View key={reason} style={[styles.badge, styles.reasonBadge]}>
                    <Text style={styles.reasonText}>{formatRiskReason(reason)}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.hint}>
                The elder marked this themselves — there is no automatic risk
                analysis yet.
              </Text>
            </View>
          )}

          {formatElderAction(event.elder_action) !== '' && (
            <Text style={styles.elderAction}>{formatElderAction(event.elder_action)}</Text>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your review</Text>
            {event.guardian_action ? (
              <Text style={styles.reviewed}>
                {event.guardian_action === 'reviewed'
                  ? 'Marked reviewed'
                  : 'Dismissed'}
                {event.guardian_reviewed_at ? ` · ${timeAgo(event.guardian_reviewed_at)}` : ''}
              </Text>
            ) : (
              <>
                <PrimaryButton
                  title="Mark reviewed"
                  onPress={() => void act('reviewed')}
                  loading={acting}
                />
                <PrimaryButton
                  title="Dismiss — not concerning"
                  onPress={() => void act('dismissed')}
                  disabled={acting}
                  variant="secondary"
                />
              </>
            )}
          </View>

          {error && <Text style={styles.error}>{error}</Text>}
        </ScrollView>
      ) : null}
    </Screen>
  );
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
  back: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: spacing.md,
  },
  scroll: {
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  muted: {
    fontSize: 14,
    color: colors.textMuted,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  rowValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    flexShrink: 1,
    textAlign: 'right',
  },
  mono: {
    fontFamily: 'monospace',
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  typeBadge: {
    backgroundColor: colors.surfaceMuted,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  reasons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  reasonBadge: {
    backgroundColor: colors.surfaceMuted,
  },
  reasonText: {
    fontSize: 12,
    color: colors.text,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
  },
  elderAction: {
    fontSize: 13,
    color: colors.green,
  },
  reviewed: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.green,
  },
  error: {
    fontSize: 13,
    color: colors.danger,
  },
});