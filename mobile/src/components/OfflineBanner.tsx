import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

export default function OfflineBanner() {
  const [isConnected, setIsConnected] = useState<boolean | null>(true);
  const translateY = new Animated.Value(-100);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isConnected === false) {
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isConnected]);

  if (isConnected !== false) {
    return null;
  }

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }], paddingTop: insets.top + 10 }]}>
      <MaterialIcons name="wifi-off" size={20} color="#fff" style={styles.icon} />
      <Text style={styles.text}>No Internet Connection</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#DC2626', // Red color for error
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 10,
    zIndex: 9999, // Ensure it sits on top of everything
    elevation: 10,
  },
  text: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  icon: {
    marginRight: 8,
  },
});
