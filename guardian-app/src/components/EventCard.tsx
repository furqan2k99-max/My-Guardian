import { StyleSheet, Text, View } from 'react-native';
import type { FlaggedEvent } from '../api';
import { colors, radii, spacing } from '../theme';
import {
  formatElderAction,
  formatEventType,
  formatRiskReason,
  shortenHash,
  timeAgo,
} from '../utils/format';

type RiskLevel = { label: string; color: string; background: string };

function riskLevel(score: number | null): RiskLevel {
  if (score === null) {
    return { label: 'Unknown risk', color: colors.textMuted, background: colors.surface };
  }
  if (score >= 75) {
    return { label: `High · ${score}`, color: colors.danger, background: '#fee2e2' };
  }
  if (score >= 50) {
    return { label: `Medium · ${score}`, color: colors.amber, background: '#fef3c7' };
  }
  return { label: `Low · ${score}`, color: colors.green, background: '#dcfce7' };
}

function Badge({ text, color, background }: { text: string; color: string; background: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Text style={[styles.badgeText, { color }]}>{text}</Text>
    </View>
  );
}

/** One flagged event in the guardian's alerts feed. */
export function EventCard({ event }: { event: FlaggedEvent }) {
  const risk = riskLevel(event.risk_score);
  const actionNote = formatElderAction(event.elder_action);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.elder}>Elder {shortenHash(event.elder_user.phone_number_hash)}</Text>
        <Badge
          text={formatEventType(event.event_type)}
          color={colors.primary}
          background={colors.surfaceMuted}
        />
      </View>

      <View style={styles.riskRow}>
        <Badge text={risk.label} color={risk.color} background={risk.background} />
        <Text style={styles.time}>{timeAgo(event.created_at)}</Text>
      </View>

      <Text style={styles.sender}>
        From sender{' '}
        <Text style={styles.senderHash}>{shortenHash(event.sender_hash)}</Text>
      </Text>

      {event.risk_reasons.length > 0 && (
        <View style={styles.reasons}>
          {event.risk_reasons.map((reason) => (
            <Badge
              key={reason}
              text={formatRiskReason(reason)}
              color={colors.textMuted}
              background={colors.surface}
            />
          ))}
        </View>
      )}

      {actionNote !== '' && <Text style={styles.action}>{actionNote}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  elder: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    flexShrink: 1,
  },
  riskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  time: {
    fontSize: 13,
    color: colors.textMuted,
  },
  badge: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sender: {
    fontSize: 13,
    color: colors.textMuted,
  },
  senderHash: {
    fontFamily: 'monospace',
    color: colors.text,
  },
  reasons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  action: {
    fontSize: 13,
    color: colors.green,
  },
});