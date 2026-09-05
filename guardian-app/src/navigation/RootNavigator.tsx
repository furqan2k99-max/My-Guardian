import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { AlertsDashboardScreen } from '../screens/AlertsDashboardScreen';
import { EmailAuthScreen } from '../screens/EmailAuthScreen';
import { EnterInviteScreen } from '../screens/EnterInviteScreen';
import { EventDetailScreen } from '../screens/EventDetailScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { VoiceScamCheckerScreen } from '../screens/VoiceScamCheckerScreen';
import { colors } from '../theme';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

function Splash() {
  return (
    <View style={styles.splash}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}

export function RootNavigator() {
  const { status, isPaired } = useAuth();

  if (status === 'loading') {
    return <Splash />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {status === 'signedOut' ? (
        <>
          <Stack.Screen name="EmailAuth" component={EmailAuthScreen} />
          {/* Dev-only stand-in login, reachable only via the hidden __DEV__ link. */}
          <Stack.Screen name="DevLogin" component={LoginScreen} />
        </>
      ) : isPaired ? (
        <>
          <Stack.Screen name="Alerts" component={AlertsDashboardScreen} />
          <Stack.Screen name="EventDetail" component={EventDetailScreen} />
          <Stack.Screen name="VoiceScamChecker" component={VoiceScamCheckerScreen} />
        </>
      ) : (
        <Stack.Screen name="EnterInvite" component={EnterInviteScreen} />
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});