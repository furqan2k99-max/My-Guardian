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
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { ApiRequestError, FlaggedEvent, listEvents, listFamilyLinks } from '../api';
import { useAuth } from '../auth/AuthContext';
import { EventCard } from '../components/EventCard';
import { Screen } from '../components/Screen';
import { observeAlertNotificationTaps, registerWithBackend } from '../push/notifications';
import { colors, radii, spacing } from '../theme';

const POLL_INTERVAL_MS = 30_000;

/**
 * Guardian alerts dashboard (post-pairing landing screen). Shows the flagged
 * events feed for every elder the guardian has an active link with, newest
 * first, plus which elders are linked. Polls every 30s and supports
 * pull-to-refresh. Tapping a card â€” or its push notification â€” opens the
 * event's detail screen.
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
    // refresh is stable enough per token; re-subscribing on every refresh
    // identity would churn listeners.
  }, [navigation, token]);

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Guardian alerts</Text>
          <Text style={styles.subtitle}>
            {linkedElders === 1
              ? '1 linked elder'
              : `${linkedElders} linked elders`}
          </Text>
        </View>
        <Pressable accessibilityRole="button" onPress={signOut} hitSlop={8}>
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={() => void refresh(true)} hitSlop={8}>
            <Text style={styles.retry}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* Experimental capability demo â€” deliberately labeled, not core flow. */}
      <Pressable
        accessibilityRole="button"
        style={styles.demoRow}
        onPress={() => navigation.navigate('VoiceScamChecker')}
      >
        <View style={styles.demoTextWrap}>
          <View style={styles.demoTitleRow}>
            <Text style={styles.demoTitle}>Voice Scam Checker</Text>
            <View style={styles.demoBadge}>
              <Text style={styles.demoBadgeText}>DEMO</Text>
            </View>
          </View>
          <Text style={styles.demoSubtitle}>
            Record a sample conversation and see the analysis engine rate it.
          </Text>
        </View>
      </Pressable>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : events.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No alerts yet</Text>
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
            >
              <EventCard event={item} />
            </Pressable>
          )}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerText: {
    flexShrink: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 2,
  },
  signOut: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.danger,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {
    flexShrink: 1,
    fontSize: 13,
    color: colors.danger,
  },
  retry: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.danger,
  },
  demoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  demoTextWrap: {
    flexShrink: 1,
    gap: 2,
  },
  demoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  demoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  demoBadge: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  demoBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
  },
  demoSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  emptyBody: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 280,
  },
  listContent: {
    paddingBottom: spacing.lg,
  },
  separator: {
    height: spacing.sm,
  },
});