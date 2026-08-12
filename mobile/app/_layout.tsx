import { Stack } from 'expo-router';
import "../global.css"; // Note: For NativeWind v4

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#ffffff' } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="otp" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="store_manager" />
    </Stack>
  );
}
