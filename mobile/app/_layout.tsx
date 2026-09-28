import { Stack } from 'expo-router';
import "../global.css"; // Note: For NativeWind v4
import OfflineBanner from '../src/components/OfflineBanner';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../src/services/LocationTrackingService'; // Initialize global TaskManager

export default function RootLayout() {
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
