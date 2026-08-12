import React from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function StoreManagerInsightsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Top Bar Header */}
      <View className="bg-blue-600 px-6 pt-10 pb-6 rounded-b-3xl shadow-sm flex-row items-center">
        <TouchableOpacity onPress={() => router.push('/store_manager')} className="mr-3">
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        <Text className="text-white font-bold text-lg">Store Insights</Text>
      </View>

      <ScrollView className="flex-1 px-5 pt-5 pb-10" showsVerticalScrollIndicator={false}>
        <Text className="text-xl font-bold text-gray-900 tracking-tight mb-4">Performance Overview</Text>

        <View className="flex-row flex-wrap justify-between">
          <View className="bg-white w-[48%] rounded-2xl p-4 mb-4 border border-gray-100 shadow-sm">
            <Text className="text-gray-400 text-[10px] font-bold uppercase mb-1">Total Gig Hours</Text>
            <Text className="text-2xl font-bold text-gray-900">148 hrs</Text>
            <Text className="text-emerald-600 text-[10px] font-semibold mt-1">↑ +12% vs last month</Text>
          </View>

          <View className="bg-white w-[48%] rounded-2xl p-4 mb-4 border border-gray-100 shadow-sm">
            <Text className="text-gray-400 text-[10px] font-bold uppercase mb-1">On-Time Arrival</Text>
            <Text className="text-2xl font-bold text-gray-900">98.5%</Text>
            <Text className="text-emerald-600 text-[10px] font-semibold mt-1">Top 5% in Region</Text>
          </View>

          <View className="bg-white w-[48%] rounded-2xl p-4 mb-4 border border-gray-100 shadow-sm">
            <Text className="text-gray-400 text-[10px] font-bold uppercase mb-1">Avg Worker Rating</Text>
            <Text className="text-2xl font-bold text-gray-900">4.9 / 5.0</Text>
            <Text className="text-amber-500 text-[10px] font-semibold mt-1">⭐⭐⭐⭐⭐</Text>
          </View>

          <View className="bg-white w-[48%] rounded-2xl p-4 mb-4 border border-gray-100 shadow-sm">
            <Text className="text-gray-400 text-[10px] font-bold uppercase mb-1">Monthly Payout</Text>
            <Text className="text-2xl font-bold text-gray-900">₹29,600</Text>
            <Text className="text-gray-500 text-[10px] font-semibold mt-1">100% On-time Payment</Text>
          </View>
        </View>

        {/* Worker Satisfaction Card */}
        <View className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm mb-6">
          <Text className="font-bold text-gray-900 text-base mb-2">Check-in Compliance Rate</Text>
          <View className="bg-gray-100 h-3 rounded-full overflow-hidden mb-2">
            <View className="bg-blue-600 h-full w-[96%]" />
          </View>
          <Text className="text-gray-500 text-xs font-medium">
            96% of workers verified all 3 check-in checkpoints (90m, 60m, Arrival).
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
