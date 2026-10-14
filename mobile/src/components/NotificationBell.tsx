import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNotifications } from '../context/NotificationContext';

export const NotificationBell: React.FC<{ style?: any }> = ({ style }) => {
  const { unreadCount, isDrawerOpen, setIsDrawerOpen, connected } = useNotifications();
  const pingAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (unreadCount > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pingAnim, {
            toValue: 1.35,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pingAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pingAnim.setValue(1);
    }
  }, [unreadCount, pingAnim]);

  return (
    <TouchableOpacity
      onPress={() => setIsDrawerOpen(!isDrawerOpen)}
      activeOpacity={0.7}
      style={[styles.container, style]}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Feather name="bell" size={22} color="#3C3C3B" />

      {/* Unread Count Badge with Animated Ping */}
      {unreadCount > 0 && (
        <View style={styles.badgeWrapper}>
          <Animated.View
            style={[
              styles.pingDot,
              {
                transform: [{ scale: pingAnim }],
                opacity: pingAnim.interpolate({
                  inputRange: [1, 1.35],
                  outputRange: [0.75, 0.2],
                }),
              },
            ]}
          />
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </Text>
          </View>
        </View>
      )}

      {/* Live WebSocket connection dot */}
      <View
        style={[
          styles.connectionDot,
          { backgroundColor: connected ? '#10B981' : '#F59E0B' },
        ]}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    position: 'relative',
  },
  badgeWrapper: {
    position: 'absolute',
    top: -2,
    right: -2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pingDot: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
  },
  badge: {
    backgroundColor: '#DC2626',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  connectionDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
});
