import React, { useEffect, useState } from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { apiClient } from '../src/api/client';
import { useAuthStore } from '../src/store/authStore';

export default function ProfileScreen() {
  const router = useRouter();
  const logout = useAuthStore(state => state.logout);
  const [userProfile, setUserProfile] = useState<{first_name: string, last_name: string, ratings?: number, shifts_completed?: number, recent_activity?: any[]} | null>(null);

  const handleLogout = () => {
    logout();
    router.replace('/');
  };
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await apiClient.get('/auth/me');
        setUserProfile(res.data);
      } catch (err) {
        console.error('Failed to load profile', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-sand pt-8 items-center justify-center">
        <ActivityIndicator size="large" color="#0B5B31" />
      </SafeAreaView>
    );
  }

  const fullName = userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : 'Student Name';
  const initial = userProfile?.first_name?.charAt(0).toUpperCase() || 'S';
  const totalEarnings = userProfile?.recent_activity?.reduce((sum: number, act: any) => sum + (act.amount || 0), 0) || 0;

  return (
    <SafeAreaView className="flex-1 bg-sand pt-8">
      {/* Header */}
      <View className="bg-cream px-6 py-4 flex-row items-center border-b border-sage/10 shadow-sm z-10">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center bg-sage/10 rounded-full mr-3">
          <Feather name="arrow-left" size={20} color="#666666" />
        </TouchableOpacity>
        <Text className="font-bold text-charcoal text-lg flex-1 text-center pr-13">My Profile</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Profile Info Card */}
        <View className="bg-cream mx-5 mt-6 rounded-3xl p-6 shadow-sm border border-sage/10 items-center">
          <View className="h-24 w-24 rounded-full bg-moss/10 items-center justify-center border-4 border-moss/10 mb-4 shadow-sm">
            <Text className="text-moss text-4xl font-bold">{initial}</Text>
          </View>
          
          <Text className="text-2xl font-bold text-charcoal mb-1">{fullName.toUpperCase()}</Text>
          <Text className="text-muted text-sm font-medium mb-3">Sahyogi</Text>
          
          {/* Dynamic Rating */}
          {userProfile?.shifts_completed ? (
            <>
              <View className="flex-row items-center bg-sand px-4 py-2 rounded-full border border-sage/10">
                <Text className="text-sage mr-2 text-lg">
                  {'⭐'.repeat(userProfile?.ratings || 0)}
                </Text>
                <Text className="text-slate font-bold">{userProfile?.ratings ? `${userProfile.ratings}.0` : '0.0'}</Text>
              </View>
              <Text className="text-sage text-xs mt-2">Rated by Store Managers</Text>
            </>
          ) : (
            <View className="bg-gray-50 px-4 py-2 rounded-full border border-gray-200 mt-1">
              <Text className="text-muted font-medium text-sm">Complete a shift to get ratings</Text>
            </View>
          )}
        </View>

        {/* Stats Grid */}
        <View className="mx-5 mt-6 flex-row justify-between">
          <View className="bg-cream flex-1 mr-2 rounded-3xl p-5 shadow-sm border border-sage/10 items-center justify-center">
            <View className="w-10 h-10 rounded-full bg-moss/5 items-center justify-center mb-3">
              <Text className="text-moss/80 text-xl">💰</Text>
            </View>
            <Text className="text-gray-400 text-xs font-bold tracking-widest uppercase mb-1 text-center">Total Earnings</Text>
            <Text className="text-2xl font-bold text-charcoal text-center">₹ 12,500</Text>
          </View>
          
          <View className="bg-cream flex-1 ml-2 rounded-3xl p-5 shadow-sm border border-sage/10 items-center justify-center">
            <View className="w-10 h-10 rounded-full bg-moss/10 items-center justify-center mb-3">
              <Text className="text-moss/80 text-xl">📋</Text>
            </View>
            <Text className="text-gray-400 text-xs font-bold tracking-widest uppercase mb-1 text-center">Shifts Completed</Text>
            <Text className="text-2xl font-bold text-charcoal text-center">{userProfile?.shifts_completed || 0}</Text>
          </View>
        </View>

        {/* Recent Activity */}
        <View className="mx-5 mt-8 mb-10">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-bold text-charcoal">Recent Activity</Text>
            <TouchableOpacity onPress={() => router.push('/payments')}>
              <Text className="text-moss font-bold">View all</Text>
            </TouchableOpacity>
          </View>

          <View className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
            <View className="flex-row items-center">
              <View className="w-12 h-12 rounded-full bg-green-100 items-center justify-center mr-4">
                <Text className="text-green-600 text-xl">✓</Text>
              </View>
              <View className="flex-1">
                <Text className="font-bold text-charcoal text-base mb-1">Payment Processed</Text>
                <Text className="text-muted text-xs">August 2026 Earnings</Text>
              </View>
              <View className="items-end">
                <Text className="font-bold text-green-600 text-lg">+₹4,500</Text>
                <Text className="text-gray-400 text-[10px]">Aug 31</Text>
              </View>
            </View>
          )}
        </View>

        {/* Logout Button */}
        <View className="mx-5 mb-10 mt-2">
          <TouchableOpacity 
            onPress={handleLogout}
            className="bg-clay/10 py-4 rounded-3xl items-center border border-clay/20 flex-row justify-center shadow-sm"
          >
            <Text className="text-clay font-bold text-lg mr-2">Logout</Text>
            
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
