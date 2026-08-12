import React from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function StoreManagerProfileScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Top Bar Header */}
      <View className="bg-blue-600 px-6 pt-10 pb-6 rounded-b-3xl shadow-sm flex-row items-center">
        <TouchableOpacity onPress={() => router.push('/store_manager')} className="mr-3">
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        <Text className="text-white font-bold text-lg">My Profile</Text>
      </View>

      <ScrollView className="flex-1 px-5 pt-5 pb-10" showsVerticalScrollIndicator={false}>
        <View className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm items-center mb-5">
          <View className="w-20 h-20 rounded-full bg-blue-100 items-center justify-center mb-3 border-2 border-blue-50">
            <Text className="text-blue-700 text-3xl font-bold">RK</Text>
          </View>
          <Text className="text-2xl font-bold text-gray-900">Rajesh Kumar</Text>
          <Text className="text-blue-600 text-xs font-bold mt-0.5">Store Manager</Text>
          <Text className="text-gray-500 text-xs mt-1">Reliance Smart – Phoenix Marketcity</Text>
        </View>

        <View className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-5">
          <TouchableOpacity className="py-3 flex-row items-center justify-between border-b border-gray-100">
            <Text className="text-gray-800 font-semibold text-sm">Store Settings & Locations</Text>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity className="py-3 flex-row items-center justify-between border-b border-gray-100">
            <Text className="text-gray-800 font-semibold text-sm">Gig Worker Escalations</Text>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity className="py-3 flex-row items-center justify-between">
            <Text className="text-gray-800 font-semibold text-sm">Help & Support</Text>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => router.replace('/')}
          className="bg-red-50 border border-red-100 rounded-2xl py-4 items-center"
        >
          <Text className="text-red-600 font-bold text-base">Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
