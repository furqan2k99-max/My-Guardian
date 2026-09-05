import { StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Platform } from 'react-native';
import type { FlaggedEvent } from '../api';
import { colors, radii, shadows, spacing, type } from '../theme';
import { RiskBadge } from './RiskBadge';
import {
  formatElderAction,
  formatEventType,
  formatRiskReason,
  shortenHash,
  timeAgo,
} from '../utils/format';

/** One flagged event in the guardian's alerts feed. */
export function EventCard({ event }: { event: FlaggedEvent }) {
  const actionNote = formatElderAction(event.elder_action);

  return (
    <View style={[styles.card, shadows.glass]}>
      <BlurView
        intensity={50}
        tint="light"
        style={StyleSheet.absoluteFill}
        blurMethod={Platform.OS === 'android' ? 'dimezisBlurViewSdk31Plus' : undefined}
      />
      <View style={styles.tint} />
      <View style={styles.border} />

      <View style={styles.inner}>
        <View style={styles.headerRow}>
          <View style={styles.elderCol}>
            <Text style={styles.elderLabel}>ELDER</Text>
            <Text style={styles.elder} numberOfLines={1}>
              {event.elder_user ? shortenHash(event.elder_user.phone_number_hash) : 'Unknown elder'}
            </Text>
          </View>
          <View style={styles.typePill}>
            <Text style={styles.typePillText}>{formatEventType(event.event_type)}</Text>
          </View>
        </View>

        <View style={styles.riskRow}>
          <RiskBadge score={event.risk_score} size="md" />
          <Text style={styles.time}>{timeAgo(event.created_at)}</Text>
        </View>

        {event.risk_reasons.length > 0 && (
          <View style={styles.reasons}>
            {event.risk_reasons.slice(0, 3).map((reason) => (
              <View key={reason} style={styles.reasonChip}>
                <Text style={styles.reasonText}>{formatRiskReason(reason)}</Text>
              </View>
            ))}
            {event.risk_reasons.length > 3 && (
              <View style={styles.reasonChip}>
                <Text style={styles.reasonText}>+{event.risk_reasons.length - 3}</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>From</Text>
          <Text style={styles.metaHash}>{shortenHash(event.sender_hash)}</Text>
        </View>

        {actionNote !== '' && (
          <View style={styles.actionRow}>
            <View style={styles.actionDot} />
            <Text style={styles.action}>{actionNote}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    overflow: 'hidden',
  },
  tint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,255,255,0.66)',
  },
  border: {
    ...StyleSheet.absoluteFill,
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  inner: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  elderCol: { flexShrink: 1 },
  elderLabel: {
    ...type.micro,
    color: colors.textMuted,
    marginBottom: 2,
  },
  elder: {
    ...type.bodyStrong,
    color: colors.text,
  },
  typePill: {
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  typePillText: {
    ...type.caption,
    color: colors.accentInk,
    fontWeight: '700',
  },
  riskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  time: {
    ...type.caption,
    color: colors.textMuted,
  },
  reasons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  reasonChip: {
    backgroundColor: 'rgba(15,23,42,0.05)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.md,
  },
  reasonText: {
    ...type.caption,
    color: colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaLabel: {
    ...type.caption,
    color: colors.textMuted,
  },
  metaHash: {
    ...type.caption,
    color: colors.text,
    fontFamily: type.familyMono,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(15,23,42,0.08)',
  },
  actionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.low,
  },
  action: {
    ...type.caption,
    color: colors.low,
    fontWeight: '600',
  },
});
