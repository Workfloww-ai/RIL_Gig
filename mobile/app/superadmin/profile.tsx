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
  const [stats, setStats] = useState<any>(null);
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
          <View className="h-24 w-24 rounded-full bg-[#FEF2F2] items-center justify-center border-4 border-[#0B5B31] mb-4 shadow-sm">
            <Text className="text-[#D32F2F] text-4xl font-bold">{initial}</Text>
          </View>

          <Text className="text-2xl font-bold text-gray-900 mb-1">{fullName.toUpperCase()}</Text>
          <Text className="text-gray-500 text-sm font-medium">{roleDisplay}</Text>
        </View>

        {/* Stats Grid */}
        <View className="mx-5 mt-6 flex-row justify-between">
          <View className="bg-white flex-1 mr-2 rounded-3xl p-5 shadow-sm border border-gray-100 items-center justify-center">
            <View className="w-12 h-12 rounded-full bg-blue-50 items-center justify-center mb-3">
              <Feather name="shopping-bag" size={20} color="#3B82F6" />
            </View>
            <Text className="text-gray-400 text-[10px] font-bold tracking-widest uppercase mb-1 text-center">Stores</Text>
            <Text className="text-2xl font-bold text-gray-900 text-center">{stats?.total_stores || 0}</Text>
          </View>
          <View className="bg-white flex-1 mx-1 rounded-3xl p-5 shadow-sm border border-gray-100 items-center justify-center">
            <View className="w-12 h-12 rounded-full bg-purple-50 items-center justify-center mb-3">
              <Feather name="users" size={20} color="#8B5CF6" />
            </View>
            <Text className="text-gray-400 text-[10px] font-bold tracking-widest uppercase mb-1 text-center">Managers</Text>
            <Text className="text-2xl font-bold text-gray-900 text-center">{stats?.total_managers || 0}</Text>
          </View>
          <View className="bg-white flex-1 ml-2 rounded-3xl p-5 shadow-sm border border-gray-100 items-center justify-center">
            <View className="w-12 h-12 rounded-full bg-orange-50 items-center justify-center mb-3">
              <Feather name="clock" size={20} color="#F97316" />
            </View>
            <Text className="text-gray-400 text-[10px] font-bold tracking-widest uppercase mb-1 text-center">Pending</Text>
            <Text className="text-2xl font-bold text-gray-900 text-center">{stats?.pending_requests || 0}</Text>
          </View>
        </View>

        {/* Organization Breakdown */}
        {stats?.organization_breakdown && stats.organization_breakdown.length > 0 && (
          <View className="mx-5 mt-8">
            <Text className="text-lg font-bold text-gray-900 mb-4">Organization Insights</Text>
            {stats.organization_breakdown.map((org: any, index: number) => (
              <View key={index} className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-100">
                <View className="flex-row items-center mb-1">
                  <Feather name="briefcase" size={16} color="#4B5563" />
                  <Text className="text-base font-bold text-gray-900 ml-2">{org.organization_name}</Text>
                </View>
                <Text className="text-xs font-medium text-gray-500 mb-5 ml-6">{org.tenant_name}</Text>
                
                <View className="flex-row justify-between bg-gray-50 p-4 rounded-xl">
                  <View className="items-center flex-1">
                    <Text className="text-lg font-bold text-gray-800">{org.total_stores}</Text>
                    <Text className="text-[10px] uppercase font-bold tracking-wider text-gray-500 mt-1">Stores</Text>
                  </View>
                  <View className="h-full w-[1px] bg-gray-200" />
                  <View className="items-center flex-1">
                    <Text className="text-lg font-bold text-gray-800">{org.total_managers}</Text>
                    <Text className="text-[10px] uppercase font-bold tracking-wider text-gray-500 mt-1">Managers</Text>
                  </View>
                  <View className="h-full w-[1px] bg-gray-200" />
                  <View className="items-center flex-1">
                    <Text className="text-lg font-bold text-[#D32F2F]">{org.pending_requests}</Text>
                    <Text className="text-[10px] uppercase font-bold tracking-wider text-[#D32F2F] mt-1">Pending</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Logout Button */}
        <View className="mx-5 mb-10 mt-6">
          <TouchableOpacity
            onPress={handleLogout}
            className="bg-[#D32F2F] py-4 rounded-3xl items-center flex-row justify-center shadow-sm"
            activeOpacity={0.85}
          >
            <Text className="text-white font-bold text-lg mr-2">Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
