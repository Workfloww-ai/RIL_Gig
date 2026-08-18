import React, { useEffect, useState } from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';

export default function StoreManagerProfileScreen() {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const [userProfile, setUserProfile] = useState<{ first_name: string; last_name: string } | null>(null);
  const [stats, setStats] = useState<{ store_name: string; total_requests: number; workers_hired: number; rating: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const handleLogout = () => {
    if (logout) logout();
    router.replace('/');
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const [profileRes, statsRes] = await Promise.all([
          apiClient.get('/auth/me'),
          apiClient.get('/auth/me/stats')
        ]);
        setUserProfile(profileRes.data);
        if (statsRes.data) {
          setStats(statsRes.data);
        }
      } catch (err) {
        console.error('Failed to load store manager profile', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 pt-8 items-center justify-center">
        <ActivityIndicator size="large" color="#10472B" />
      </SafeAreaView>
    );
  }

  const fullName = userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : 'Store Manager';
  const initial = userProfile?.first_name ? userProfile.first_name.charAt(0).toUpperCase() : 'S';

  return (
    <SafeAreaView className="flex-1 bg-gray-50 pt-8">
      {/* Header - Identical structure & styling to Worker Profile */}
      <View className="bg-white px-6 py-4 flex-row items-center border-b border-gray-100 shadow-sm z-10">
        <TouchableOpacity onPress={() => router.back()} className="mr-4 p-2 -ml-2">
          <Text className="text-gray-500 font-bold text-lg">← Back</Text>
        </TouchableOpacity>
        <Text className="font-bold text-gray-900 text-lg flex-1 text-center pr-8">My Profile</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Profile Info Card - Identical structure & styling to Worker Profile */}
        <View className="bg-white mx-5 mt-6 rounded-3xl p-6 shadow-sm border border-gray-100 items-center">
          <View className="h-24 w-24 rounded-full bg-emerald-100 items-center justify-center border-4 border-emerald-50 mb-4 shadow-sm">
            <Text className="text-emerald-800 text-4xl font-bold">{initial}</Text>
          </View>

          <Text className="text-2xl font-bold text-gray-900 mb-1">{fullName.toUpperCase()}</Text>
          <Text className="text-gray-500 text-sm font-medium mb-3">Store Manager • {stats?.store_name || 'Loading...'}</Text>

          {/* Rating Badge */}
          <View className="flex-row items-center bg-yellow-50 px-4 py-2 rounded-full border border-yellow-100">
            <Text className="text-yellow-500 mr-2 text-lg">⭐⭐⭐⭐⭐</Text>
            <Text className="text-yellow-700 font-bold">{stats?.rating?.toFixed(1) || '5.0'}</Text>
          </View>
          <Text className="text-gray-400 text-xs mt-2">Rated by Gig Workers & Operations</Text>
        </View>

        {/* Stats Grid - Identical card styling to Worker Profile */}
        <View className="mx-5 mt-6 flex-row justify-between">
          <View className="bg-white flex-1 mr-2 rounded-3xl p-5 shadow-sm border border-gray-100 items-center justify-center">
            <View className="w-10 h-10 rounded-full bg-green-50 items-center justify-center mb-3">
              <Text className="text-green-500 text-xl">📋</Text>
            </View>
            <Text className="text-gray-400 text-xs font-bold tracking-widest uppercase mb-1 text-center">Total Requests</Text>
            <Text className="text-2xl font-bold text-gray-900 text-center">{stats?.total_requests || 0}</Text>
          </View>

          <View className="bg-white flex-1 ml-2 rounded-3xl p-5 shadow-sm border border-gray-100 items-center justify-center">
            <View className="w-10 h-10 rounded-full bg-blue-50 items-center justify-center mb-3">
              <Text className="text-blue-500 text-xl">👥</Text>
            </View>
            <Text className="text-gray-400 text-xs font-bold tracking-widest uppercase mb-1 text-center">Workers Hired</Text>
            <Text className="text-2xl font-bold text-gray-900 text-center">{stats?.workers_hired || 0}</Text>
          </View>
        </View>

        {/* Management Settings Card */}
        <View className="mx-5 mt-6 bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
          <TouchableOpacity className="py-3 flex-row items-center justify-between border-b border-gray-100">
            <Text className="text-gray-900 font-semibold text-sm">Store Settings & Locations</Text>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity className="py-3 flex-row items-center justify-between border-b border-gray-100">
            <Text className="text-gray-900 font-semibold text-sm">Sahyogi Escalations</Text>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity className="py-3 flex-row items-center justify-between">
            <Text className="text-gray-900 font-semibold text-sm">Help & Support</Text>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Logout Button - Identical styling to Worker Profile */}
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
