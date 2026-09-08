import { Stack } from 'expo-router';
import "../global.css"; // Note: For NativeWind v4
import OfflineBanner from '../src/components/OfflineBanner';
import { View } from 'react-native';

export default function RootLayout() {
  return (
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
  );
}
