import React, { useEffect, useState } from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { apiClient } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';

export default function SuperadminProfileScreen() {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const [userProfile, setUserProfile] = useState<{ first_name: string; last_name: string; role_name?: string } | null>(null);
  const [stats, setStats] = useState<{ total_stores: number; total_managers: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const handleLogout = () => {
    if (logout) logout();
    router.replace('/');
  };

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        const [profileRes, statsRes] = await Promise.all([
          apiClient.get('/auth/me'),
          apiClient.get('/superadmin/stats')
        ]);

        setUserProfile(profileRes.data);
        if (statsRes.data) {
          setStats(statsRes.data);
        }
      } catch (err) {
        console.error('Failed to load superadmin profile', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfileData();
  }, []);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 pt-8 items-center justify-center">
        <ActivityIndicator size="large" color="#10472B" />
      </SafeAreaView>
    );
  }

  const roleDisplay = userProfile?.role_name ? userProfile.role_name.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Super Admin';
  const fullName = userProfile ? `${userProfile.first_name || 'Super'} ${userProfile.last_name || 'Admin'}`.trim() : roleDisplay;
  const initial = userProfile?.first_name ? userProfile.first_name.charAt(0).toUpperCase() : 'A';

  return (
    <SafeAreaView className="flex-1 bg-gray-50 pt-8">
      {/* Header */}
      <View className="bg-white px-6 py-4 flex-row items-center shadow-sm z-10 pb-6" style={{ position: 'relative' }}>
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center bg-gray-100 rounded-full mr-3">
          <Feather name="arrow-left" size={20} color="#4B5563" />
        </TouchableOpacity>
        <Text className="font-bold text-gray-900 text-lg flex-1 text-center">My Profile</Text>
        <Image
          source={require('../../assets/images/newlogo.png')}
          style={{ width: 60, height: 60, resizeMode: 'contain' }}
        />
        {/* Decorative Brand Line - Absolute Bottom */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 6, flexDirection: 'row' }}>
          <View style={{ flex: 1, backgroundColor: '#0B5B31' }} />
          <View style={{ width: 0, height: 0, borderTopWidth: 6, borderTopColor: '#0B5B31', borderRightWidth: 6, borderRightColor: 'transparent', marginLeft: -1 }} />
          <View style={{ width: 4, height: 6, backgroundColor: 'transparent' }} />
          <View style={{ width: 0, height: 0, borderBottomWidth: 6, borderBottomColor: '#D32F2F', borderLeftWidth: 6, borderLeftColor: 'transparent', marginRight: -1 }} />
          <View style={{ flex: 1, backgroundColor: '#D32F2F' }} />
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Profile Info Card */}
        <View className="bg-white mx-5 mt-6 rounded-3xl p-6 shadow-sm border border-gray-100 items-center">
          <View className="h-24 w-24 rounded-full bg-emerald-100 items-center justify-center border-4 border-emerald-50 mb-4 shadow-sm">
            <Text className="text-emerald-800 text-4xl font-bold">{initial}</Text>
          </View>

          <Text className="text-2xl font-bold text-gray-900 mb-1">{fullName.toUpperCase()}</Text>
          <Text className="text-gray-500 text-sm font-medium">{roleDisplay}</Text>
        </View>

        {/* Stats Grid */}
        <View className="mx-5 mt-6 flex-row justify-between">
          <View className="bg-white flex-1 mr-2 rounded-3xl p-5 shadow-sm border border-gray-100 items-center justify-center">
            <View className="w-10 h-10 rounded-full bg-blue-50 items-center justify-center mb-3">
              <Text className="text-blue-500 text-xl">🏢</Text>
            </View>
            <Text className="text-gray-400 text-xs font-bold tracking-widest uppercase mb-1 text-center">Total Stores</Text>
            <Text className="text-2xl font-bold text-gray-900 text-center">{stats?.total_stores || 0}</Text>
          </View>

          <View className="bg-white flex-1 ml-2 rounded-3xl p-5 shadow-sm border border-gray-100 items-center justify-center">
            <View className="w-10 h-10 rounded-full bg-purple-50 items-center justify-center mb-3">
              <Text className="text-purple-500 text-xl">👥</Text>
            </View>
            <Text className="text-gray-400 text-xs font-bold tracking-widest uppercase mb-1 text-center">Total Managers</Text>
            <Text className="text-2xl font-bold text-gray-900 text-center">{stats?.total_managers || 0}</Text>
          </View>
        </View>

        {/* Logout Button */}
        <View className="mx-5 mb-10 mt-6">
          <TouchableOpacity
            onPress={handleLogout}
            className="bg-red-50 py-4 rounded-3xl items-center border border-red-100 flex-row justify-center shadow-sm"
            activeOpacity={0.85}
          >
            <Text className="text-red-600 font-bold text-lg mr-2">Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
