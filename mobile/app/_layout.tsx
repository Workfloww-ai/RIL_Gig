import { Stack, useRouter, useSegments } from 'expo-router';
import "../global.css"; // Note: For NativeWind v4
import OfflineBanner from '../src/components/OfflineBanner';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../src/services/LocationTrackingService'; // Initialize global TaskManager
import { useAuthStore } from '../src/store/authStore';
import { useEffect } from 'react';

export default function RootLayout() {
  const { _hasHydrated, token, role } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!_hasHydrated) return;

    // We consider these paths as part of the "auth" flow
    const inAuthGroup = segments[0] === 'index' || segments[0] === 'otp' || segments[0] === 'signup';

    if (token && inAuthGroup) {
      // Redirect authenticated users away from login screens
      if (role === 'superadmin') {
        router.replace('/superadmin');
      } else if (role === 'store_manager') {
        router.replace('/store_manager');
      } else {
        // Default to gig worker flow
        router.replace('/library'); 
      }
    } else if (!token && !inAuthGroup) {
      // Redirect unauthenticated users to the login screen
      router.replace('/');
    }
  }, [_hasHydrated, token, role, segments]);

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1 }}>
        <OfflineBanner />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#ffffff' } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="otp" />
          <Stack.Screen name="signup" />
          <Stack.Screen name="store_manager" />
          <Stack.Screen name="superadmin" />
          <Stack.Screen name="library" />
        </Stack>
      </View>
    </SafeAreaProvider>
  );
}
