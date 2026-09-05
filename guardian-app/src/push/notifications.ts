import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { PushPlatform, registerPushToken } from '../api/pushTokens';

export const ALERTS_CHANNEL_ID = 'alerts';

/**
 * Foreground presentation handler. When a flagged-event push arrives while the
 * app is open, show it as a banner + list entry with sound.
 */
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Ask the user to allow notifications; resolves true when allowed. */
export async function requestPushPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const current = await Notifications.getPermissionsAsync();
  if (
    current.granted ||
    current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  ) {
    return true;
  }
  if (current.canAskAgain) {
    const next = await Notifications.requestPermissionsAsync();
    return (
      next.granted ||
      next.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
    );
  }
  return false;
}

/**
 * The native device token (FCM on Android, APNs on iOS) that our backend can
 * target with its own push provider. Returns null when unavailable (e.g. Expo
 * Go on Android, which dropped remote push from SDK 53).
 */
export async function getDevicePushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(ALERTS_CHANNEL_ID, {
        name: 'Safety alerts',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
      });
    }
    const token = await Notifications.getDevicePushTokenAsync();
    return token.data as string;
  } catch {
    return null;
  }
}

/**
 * Full flow: ask permission, obtain the native device token, and upsert it on
 * the backend. Swallows failures so a push-less device never blocks UI.
 */
export async function registerWithBackend(authToken: string): Promise<boolean> {
  const allowed = await requestPushPermission();
  if (!allowed) return false;
  const pushToken = await getDevicePushToken();
  if (!pushToken) return false;
  const platform = (Platform.OS === 'android' || Platform.OS === 'ios'
    ? Platform.OS
    : 'web') as PushPlatform;
  await registerPushToken(authToken, pushToken, platform);
  return true;
}

/** Shape of the data payload our backend attaches to flagged-event pushes. */
export interface AlertPushData {
  type?: string;
  event_id?: string;
  event_type?: string;
  risk_score?: string;
}

function extractEventId(data: unknown): string | null {
  if (data && typeof data === 'object' && typeof (data as AlertPushData).event_id === 'string') {
    return (data as AlertPushData).event_id;
  }
  return null;
}

/**
 * Invoke `onEventId` when the user TAPS an alert notification, with the id of
 * the flagged event it points at (null when the push carries none). Covers
 * both in-app taps and the cold-start tap that launched the app.
 */
export function observeAlertNotificationTaps(
  onEventId: (eventId: string | null) => void,
): () => void {
  if (Platform.OS === 'web') return () => undefined;

  // If the notification tap is what launched the app, the response listener
  // below never fires — recover it once instead.
  void Notifications.getLastNotificationResponseAsync().then((response) => {
    const eventId = response ? extractEventId(response.notification.request.content.data) : null;
    if (eventId) onEventId(eventId);
  });

  return Notifications.addNotificationResponseReceivedListener((response) => {
    onEventId(extractEventId(response.notification.request.content.data));
  }).remove;
}