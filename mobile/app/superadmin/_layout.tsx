import React, { useState, useEffect } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, Platform, Image } from 'react-native';
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
      <View style={{ backgroundColor: '#FFFFFF', paddingTop: Platform.OS === 'ios' ? Math.max(16, insets.top) : 16 + insets.top, paddingBottom: 24, paddingHorizontal: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.05, shadowRadius: 16, elevation: 8, zIndex: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => router.push('/superadmin/profile')}
            style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#F9F9F9', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#E5E7EB', marginRight: 16 }}
            activeOpacity={0.8}
          >
            <Text style={{ color: '#0B5B31', fontSize: 20, fontWeight: '800' }}>
              {userProfile?.first_name ? userProfile.first_name.charAt(0).toUpperCase() : 'A'}
            </Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 26, fontWeight: '800', color: '#3C3C3B', letterSpacing: -0.5 }}>
              Hi, {userProfile?.first_name ? userProfile.first_name.charAt(0).toUpperCase() + userProfile.first_name.slice(1) : 'Admin'}
            </Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.8}
              style={{ fontSize: 12, fontWeight: '600', marginTop: 2 }}
            >
              <Text style={{ color: '#0B5B31' }}>SahYogi</Text>{' '}
              <Text style={{ color: '#D32F2F' }}>Superadmin</Text>
            </Text>
          </View>
          <Image
            source={require('../../assets/images/newlogo.png')}
            style={{ width: 85, height: 85, resizeMode: 'contain', marginLeft: 12 }}
          />
        </View>

        {/* Decorative Brand Line - Absolute Bottom */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 8, flexDirection: 'row' }}>
          <View style={{ flex: 1, backgroundColor: '#0B5B31' }} />
          <View style={{ width: 0, height: 0, borderTopWidth: 8, borderTopColor: '#0B5B31', borderRightWidth: 8, borderRightColor: 'transparent', marginLeft: -1 }} />
          <View style={{ width: 4, height: 8, backgroundColor: 'transparent' }} />
          <View style={{ width: 0, height: 0, borderBottomWidth: 8, borderBottomColor: '#D32F2F', borderLeftWidth: 8, borderLeftColor: 'transparent', marginRight: -1 }} />
          <View style={{ flex: 1, backgroundColor: '#D32F2F' }} />
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
          paddingTop: 16,
          paddingBottom: Platform.OS === 'ios' ? Math.max(24, insets.bottom) : Math.max(12, insets.bottom),
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.08,
          shadowRadius: 6,
          zIndex: 999,
        }}
      >
        {/* Decorative Brand Line - Absolute Top */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 8, flexDirection: 'row' }}>
          <View style={{ flex: 1, backgroundColor: '#0B5B31' }} />
          <View style={{ width: 0, height: 0, borderTopWidth: 8, borderTopColor: '#0B5B31', borderRightWidth: 8, borderRightColor: 'transparent', marginLeft: -1 }} />
          <View style={{ width: 4, height: 8, backgroundColor: 'transparent' }} />
          <View style={{ width: 0, height: 0, borderBottomWidth: 8, borderBottomColor: '#D32F2F', borderLeftWidth: 8, borderLeftColor: 'transparent', marginRight: -1 }} />
          <View style={{ flex: 1, backgroundColor: '#D32F2F' }} />
        </View>


        <TouchableOpacity onPress={() => router.push('/superadmin')} style={{ alignItems: 'center', flex: 1 }} activeOpacity={0.7}>
          <Ionicons name="clipboard-outline" size={22} color={pathname === '/superadmin' ? '#D32F2F' : '#9CA3AF'} />
          <Text style={{ fontSize: 11, marginTop: 4, fontWeight: '600', color: pathname === '/superadmin' ? '#D32F2F' : '#9CA3AF' }}>Requests</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/superadmin/managers')} style={{ alignItems: 'center', flex: 1 }} activeOpacity={0.7}>
          <Feather name="home" size={22} color={pathname === '/superadmin/managers' ? '#D32F2F' : '#9CA3AF'} />
          <Text style={{ fontSize: 11, marginTop: 4, fontWeight: '600', color: pathname === '/superadmin/managers' ? '#D32F2F' : '#9CA3AF' }}>Managers</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/superadmin/stores')} style={{ alignItems: 'center', flex: 1 }} activeOpacity={0.7}>
          <Feather name="box" size={22} color={pathname === '/superadmin/stores' ? '#D32F2F' : '#9CA3AF'} />
          <Text style={{ fontSize: 11, marginTop: 4, fontWeight: '600', color: pathname === '/superadmin/stores' ? '#D32F2F' : '#9CA3AF' }}>Stores</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/superadmin/deletions')} style={{ alignItems: 'center', flex: 1 }} activeOpacity={0.7}>
          <Feather name="trash-2" size={22} color={pathname === '/superadmin/deletions' ? '#D32F2F' : '#9CA3AF'} />
          <Text style={{ fontSize: 11, marginTop: 4, fontWeight: '600', color: pathname === '/superadmin/deletions' ? '#D32F2F' : '#9CA3AF' }}>Deletions</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
