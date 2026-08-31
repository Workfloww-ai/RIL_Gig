import React, { useState, useEffect } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, Platform } from 'react-native';
import { Slot, useRouter, usePathname } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiClient } from '../../src/api/client';

export default function SuperadminLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  
  const [userProfile, setUserProfile] = useState<{ first_name: string; last_name: string } | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profileRes = await apiClient.get('/auth/me');
        if (profileRes?.data) setUserProfile(profileRes.data);
      } catch (err) {
        console.error('Failed to fetch profile in superadmin layout', err);
      }
    };
    fetchProfile();
  }, []);

  if (pathname === '/superadmin/profile') {
    return (
      <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
        <Slot />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* Top Header */}
      <View style={{ backgroundColor: '#10472B', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? Math.max(16, insets.top) : 16 + insets.top, paddingBottom: 16, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity 
            onPress={() => router.push('/superadmin/profile')}
            style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255, 255, 255, 0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.4)', marginRight: 12 }}
            activeOpacity={0.7}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>
              {userProfile?.first_name ? userProfile.first_name.charAt(0).toUpperCase() : 'A'}
            </Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 24, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.5 }}>
              Hi, {userProfile?.first_name ? userProfile.first_name.charAt(0).toUpperCase() + userProfile.first_name.slice(1) : 'Admin'}
            </Text>
            <Text style={{ fontSize: 13, color: '#E1EBE5', fontWeight: '500', marginTop: 2 }}>Super Admin</Text>
          </View>
        </View>
      </View>

      {/* Main Content Slot */}
      <View style={{ flex: 1 }}>
        <Slot />
      </View>

      {/* Bottom Navigation */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#F3F4F6',
          flexDirection: 'row',
          justifyContent: 'space-around',
          paddingVertical: 12,
          paddingBottom: Platform.OS === 'ios' ? Math.max(24, insets.bottom) : Math.max(12, insets.bottom),
        }}
      >
        <TouchableOpacity onPress={() => router.push('/superadmin')} style={{ alignItems: 'center', flex: 1 }} activeOpacity={0.7}>
          <Ionicons name="clipboard-outline" size={22} color={pathname === '/superadmin' ? '#E31B23' : '#9CA3AF'} />
          <Text style={{ fontSize: 11, marginTop: 4, fontWeight: '600', color: pathname === '/superadmin' ? '#E31B23' : '#9CA3AF' }}>Requests</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/superadmin/managers')} style={{ alignItems: 'center', flex: 1 }} activeOpacity={0.7}>
          <Feather name="home" size={22} color={pathname === '/superadmin/managers' ? '#E31B23' : '#9CA3AF'} />
          <Text style={{ fontSize: 11, marginTop: 4, fontWeight: '600', color: pathname === '/superadmin/managers' ? '#E31B23' : '#9CA3AF' }}>Managers</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/superadmin/stores')} style={{ alignItems: 'center', flex: 1 }} activeOpacity={0.7}>
          <Feather name="box" size={22} color={pathname === '/superadmin/stores' ? '#E31B23' : '#9CA3AF'} />
          <Text style={{ fontSize: 11, marginTop: 4, fontWeight: '600', color: pathname === '/superadmin/stores' ? '#E31B23' : '#9CA3AF' }}>Stores</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
