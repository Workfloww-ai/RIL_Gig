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
      <SafeAreaView className="flex-1 bg-gray-50 pt-8 items-center justify-center">
        <ActivityIndicator size="large" color="#2563EB" />
      </SafeAreaView>
    );
  }

  const fullName = userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : 'Student Name';
  const initial = userProfile?.first_name?.charAt(0).toUpperCase() || 'S';

  return (
    <SafeAreaView className="flex-1 bg-gray-50 pt-8">
      {/* Header */}
      <View className="bg-white px-6 py-4 flex-row items-center border-b border-gray-100 shadow-sm z-10">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center bg-gray-100 rounded-full mr-3">
          <Feather name="arrow-left" size={20} color="#4B5563" />
        </TouchableOpacity>
        <Text className="font-bold text-gray-900 text-lg flex-1 text-center pr-13">My Profile</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Profile Info Card */}
        <View className="bg-white mx-5 mt-6 rounded-3xl p-6 shadow-sm border border-gray-100 items-center">
          <View className="h-24 w-24 rounded-full bg-primary-100 items-center justify-center border-4 border-primary-50 mb-4 shadow-sm">
            <Text className="text-primary-600 text-4xl font-bold">{initial}</Text>
          </View>
          
          <Text className="text-2xl font-bold text-gray-900 mb-1">{fullName.toUpperCase()}</Text>
          <Text className="text-gray-500 text-sm font-medium mb-3">Sahyogi</Text>
          
          {/* Dynamic Rating */}
          {userProfile?.shifts_completed ? (
            <>
              <View className="flex-row items-center bg-yellow-50 px-4 py-2 rounded-full border border-yellow-100">
                <Text className="text-yellow-500 mr-2 text-lg">
                  {'⭐'.repeat(userProfile?.ratings || 0)}
                </Text>
                <Text className="text-yellow-700 font-bold">{userProfile?.ratings ? `${userProfile.ratings}.0` : '0.0'}</Text>
              </View>
              <Text className="text-gray-400 text-xs mt-2">Rated by Store Managers</Text>
            </>
          ) : (
            <View className="bg-gray-50 px-4 py-2 rounded-full border border-gray-200 mt-1">
              <Text className="text-gray-500 font-medium text-sm">Complete a shift to get ratings</Text>
            </View>
          )}
        </View>

        {/* Stats Grid */}
        <View className="mx-5 mt-6 flex-row justify-between">
          <View className="bg-white flex-1 mr-2 rounded-3xl p-5 shadow-sm border border-gray-100 items-center justify-center">
            <View className="w-10 h-10 rounded-full bg-green-50 items-center justify-center mb-3">
              <Text className="text-green-500 text-xl">💰</Text>
            </View>
            <Text className="text-gray-400 text-xs font-bold tracking-widest uppercase mb-1 text-center">Total Earnings</Text>
            <Text className="text-2xl font-bold text-gray-900 text-center">₹ 12,500</Text>
          </View>
          
          <View className="bg-white flex-1 ml-2 rounded-3xl p-5 shadow-sm border border-gray-100 items-center justify-center">
            <View className="w-10 h-10 rounded-full bg-blue-50 items-center justify-center mb-3">
              <Text className="text-blue-500 text-xl">📋</Text>
            </View>
            <Text className="text-gray-400 text-xs font-bold tracking-widest uppercase mb-1 text-center">Shifts Completed</Text>
            <Text className="text-2xl font-bold text-gray-900 text-center">{userProfile?.shifts_completed || 0}</Text>
          </View>
        </View>

        {/* Recent Activity */}
        <View className="mx-5 mt-8 mb-10">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-bold text-gray-900">Recent Activity</Text>
            <TouchableOpacity onPress={() => router.push('/payments')}>
              <Text className="text-primary-600 font-bold">View all</Text>
            </TouchableOpacity>
          </View>

          {userProfile?.recent_activity && userProfile.recent_activity.length > 0 ? (
            userProfile.recent_activity.map((activity, index) => {
              const date = activity.shift_date ? new Date(activity.shift_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
              return (
                <View key={activity.id || index} className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 mb-3">
                  <View className="flex-row items-center">
                    <View className="w-12 h-12 rounded-full bg-green-100 items-center justify-center mr-4">
                      <Text className="text-green-600 text-xl">✓</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="font-bold text-gray-900 text-base mb-1">{activity.job_name}</Text>
                      <Text className="text-gray-500 text-xs">Amount needs to be processed - {activity.hours} hrs</Text>
                    </View>
                    <View className="items-end">
                      <Text className="font-bold text-green-600 text-lg">+₹{activity.amount}</Text>
                      <Text className="text-gray-400 text-[10px]">{date}</Text>
                    </View>
                  </View>
                </View>
              );
            })
          ) : (
            <View className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 items-center justify-center">
              <Text className="text-gray-500 py-2">No recent activity</Text>
            </View>
          )}
        </View>

        {/* Logout Button */}
        <View className="mx-5 mb-10 mt-2">
          <TouchableOpacity 
            onPress={handleLogout}
            className="bg-red-50 py-4 rounded-3xl items-center border border-red-100 flex-row justify-center shadow-sm"
          >
            <Text className="text-red-600 font-bold text-lg mr-2">Logout</Text>
            
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
