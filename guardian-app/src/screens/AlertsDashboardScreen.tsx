import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Platform } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { ApiRequestError, FlaggedEvent, listEvents, listFamilyLinks } from '../api';
import { useAuth } from '../auth/AuthContext';
import { EventCard } from '../components/EventCard';
import { Screen } from '../components/Screen';
import { observeAlertNotificationTaps, registerWithBackend } from '../push/notifications';
import { colors, radii, shadows, spacing, type } from '../theme';

const POLL_INTERVAL_MS = 30_000;

/**
 * Guardian alerts dashboard (post-pairing landing screen). Glass cards for
 * each flagged event sit on a soft indigo/blue gradient. Polls every 30s and
 * supports pull-to-refresh. Tapping a card or its push notification opens
 * the event's detail screen.
 */
export function AlertsDashboardScreen() {
  const { token, signOut } = useAuth();
  const navigation =
    useNavigation<NativeStackNavigationProp<{ EventDetail: { eventId: string }; VoiceScamChecker: undefined }>>();
  const [events, setEvents] = useState<FlaggedEvent[]>([]);
  const [linkedElders, setLinkedElders] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const registeredForToken = useRef<string | null>(null);

  const refresh = useCallback(
    async (quiet = false) => {
      if (!token) return;
      if (!quiet) setRefreshing(true);
      try {
        const [evts, links] = await Promise.all([listEvents(token), listFamilyLinks(token)]);
        setEvents(evts);
        setLinkedElders(links.filter((link) => link.status === 'active').length);
        setError(null);
      } catch (err) {
        if (err instanceof ApiRequestError && err.status === 401) {
          await signOut();
          return;
        }
        setError(err instanceof Error ? err.message : 'Unexpected error');
      } finally {
        if (!quiet) setRefreshing(false);
        setLoading(false);
      }
    },
    [token, signOut],
  );

  // Initial load, then poll while mounted.
  useEffect(() => {
    void refresh(true);
    pollRef.current = setInterval(() => void refresh(true), POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refresh]);

  // Present alert pushes and register this device once per auth session.
  useEffect(() => {
    if (!token || registeredForToken.current === token) return;
    registeredForToken.current = token;
    void registerWithBackend(token).catch(() => undefined);
  }, [token]);

  // Tapping an alert notification opens the event it points at; a plain tap
  // (no event id) just refreshes the feed.
  useEffect(() => {
    return observeAlertNotificationTaps((eventId) => {
      if (eventId) {
        navigation.navigate('EventDetail', { eventId });
      } else {
        void refresh(true);
      }
    });
  }, [navigation, token, refresh]);

  const highCount = events.filter((e) => (e.risk_score ?? 0) >= 75).length;
  const todayCount = events.filter((e) => isToday(e.created_at)).length;

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>MYGUARDIAN</Text>
          <Text style={styles.title}>Alerts</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={signOut}
          hitSlop={8}
          style={({ pressed }) => [styles.signOutBtn, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, shadows.card]}>
          <BlurView
            intensity={40}
            tint="light"
            style={StyleSheet.absoluteFill}
            blurMethod={Platform.OS === 'android' ? 'dimezisBlurViewSdk31Plus' : undefined}
          />
          <View style={styles.statTint} />
          <Text style={styles.statValue}>{linkedElders}</Text>
          <Text style={styles.statLabel}>Linked elders</Text>
        </View>
        <View style={[styles.statCard, shadows.card]}>
          <BlurView
            intensity={40}
            tint="light"
            style={StyleSheet.absoluteFill}
            blurMethod={Platform.OS === 'android' ? 'dimezisBlurViewSdk31Plus' : undefined}
          />
          <View style={styles.statTint} />
          <Text style={[styles.statValue, { color: colors.high }]}>{highCount}</Text>
          <Text style={styles.statLabel}>High risk</Text>
        </View>
        <View style={[styles.statCard, shadows.card]}>
          <BlurView
            intensity={40}
            tint="light"
            style={StyleSheet.absoluteFill}
            blurMethod={Platform.OS === 'android' ? 'dimezisBlurViewSdk31Plus' : undefined}
          />
          <View style={styles.statTint} />
          <Text style={styles.statValue}>{todayCount}</Text>
          <Text style={styles.statLabel}>Today</Text>
        </View>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={() => void refresh(true)} hitSlop={8}>
            <Text style={styles.retry}>Retry</Text>
          </Pressable>
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate('VoiceScamChecker')}
        style={({ pressed }) => [styles.demoCard, pressed && { transform: [{ scale: 0.99 }] }]}
      >
        <View style={[styles.demoIcon, { backgroundColor: colors.accent }]}>
          <View style={styles.demoMic} />
          <View style={styles.demoMicBase} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.demoTitleRow}>
            <Text style={styles.demoTitle}>Voice Scam Checker</Text>
            <View style={styles.demoBadge}>
              <Text style={styles.demoBadgeText}>DEMO</Text>
            </View>
          </View>
          <Text style={styles.demoSubtitle}>
            Record a sample and see the engine rate it in real time
          </Text>
        </View>
        <Text style={styles.demoChevron}>›</Text>
      </Pressable>

      <View style={styles.feedHeader}>
        <Text style={styles.feedTitle}>Recent activity</Text>
        <Text style={styles.feedCount}>{events.length} total</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : events.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <View style={styles.emptyBell} />
            <View style={styles.emptyDot} />
          </View>
          <Text style={styles.emptyTitle}>All clear</Text>
          <Text style={styles.emptyBody}>
            When your elder reports a suspicious call, or a link they check
            turns out dangerous, it will show up here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(event) => event.id}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}
              style={({ pressed }) => [pressed && { transform: [{ scale: 0.995 }] }]}
            >
              <EventCard event={item} />
            </Pressable>
          )}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void refresh()}
              tintColor={colors.accent}
            />
          }
        />
      )}
    </Screen>
  );
}

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
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
  signOutBtn: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
  },
  signOutText: {
    ...type.caption,
    color: colors.textMuted,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    borderRadius: radii.lg,
    overflow: 'hidden',
    padding: spacing.md,
    alignItems: 'flex-start',
    minHeight: 72,
    justifyContent: 'center',
  },
  statTint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  statValue: {
    ...type.title,
    fontSize: 26,
    color: colors.text,
  },
  statLabel: {
    ...type.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    backgroundColor: colors.highSoft,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  errorText: { flexShrink: 1, ...type.caption, color: colors.high, fontWeight: '600' },
  retry: { ...type.caption, color: colors.high, fontWeight: '700' },

  demoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  demoIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoMic: {
    width: 8,
    height: 14,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  demoMicBase: {
    position: 'absolute',
    bottom: 9,
    width: 14,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#fff',
  },
  demoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  demoTitle: {
    ...type.bodyStrong,
    fontSize: 16,
    color: colors.text,
  },
  demoBadge: {
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.pill,
  },
  demoBadgeText: {
    ...type.micro,
    color: colors.accentInk,
  },
  demoSubtitle: {
    ...type.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  demoChevron: {
    fontSize: 24,
    color: colors.textMuted,
    lineHeight: 24,
  },

  feedHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  feedTitle: {
    ...type.subtitle,
    color: colors.text,
  },
  feedCount: {
    ...type.caption,
    color: colors.textMuted,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyBell: {
    width: 16,
    height: 22,
    borderRadius: 8,
    backgroundColor: colors.accent,
  },
  emptyDot: {
    position: 'absolute',
    top: 18,
    right: 16,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  emptyTitle: {
    ...type.subtitle,
    color: colors.text,
  },
  emptyBody: {
    ...type.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: spacing.xxl,
  },
  separator: {
    height: spacing.md,
  },
});
