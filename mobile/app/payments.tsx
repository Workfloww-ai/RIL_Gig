import React from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

// Mock data for payments
const paymentHistory = [
  { id: '1', month: 'August 2026', amount: 4500, date: 'Aug 31, 2026', status: 'Processed' },
  { id: '2', month: 'July 2026', amount: 5000, date: 'Jul 31, 2026', status: 'Processed' },
  { id: '3', month: 'June 2026', amount: 3000, date: 'Jun 30, 2026', status: 'Processed' },
];

export default function PaymentsScreen() {
  const router = useRouter();

  const totalEarnings = paymentHistory.reduce((sum, record) => sum + record.amount, 0);

  return (
    <SafeAreaView className="flex-1 bg-gray-50 pt-8">
      {/* Header */}
      <View className="bg-white px-6 py-4 flex-row items-center border-b border-gray-100 shadow-sm z-10">
        <TouchableOpacity onPress={() => router.back()} className="mr-4 p-2 -ml-2">
          <Text className="text-gray-500 font-bold text-lg">← Back</Text>
        </TouchableOpacity>
        <Text className="font-bold text-gray-900 text-lg flex-1 text-center pr-8">Payment History</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        
        {/* Earnings Summary Card */}
        <View className="bg-primary-600 mx-5 mt-6 rounded-3xl p-6 shadow-sm items-center">
          <Text className="text-primary-100 text-xs font-bold tracking-widest uppercase mb-2">Lifetime Earnings</Text>
          <Text className="text-white text-4xl font-bold mb-4">₹ {totalEarnings.toLocaleString()}</Text>
          <View className="bg-primary-700 px-4 py-2 rounded-full border border-primary-500">
            <Text className="text-white text-xs font-medium">All payments processed successfully</Text>
          </View>
        </View>

        {/* Month-wise List */}
        <View className="px-5 pt-8 pb-10">
          <Text className="text-lg font-bold text-gray-900 mb-4">Month-wise Payments</Text>
          
          {paymentHistory.map((payment) => (
            <View key={payment.id} className="bg-white rounded-3xl p-5 mb-4 shadow-sm border border-gray-100">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="font-bold text-gray-900 text-lg">{payment.month}</Text>
                <Text className="font-bold text-green-600 text-xl">+₹{payment.amount.toLocaleString()}</Text>
              </View>
              
              <View className="flex-row items-center justify-between border-t border-gray-50 pt-3">
                <View className="flex-row items-center">
                  <View className="w-6 h-6 rounded-full bg-green-100 items-center justify-center mr-2">
                    <Text className="text-green-600 text-[10px]">✓</Text>
                  </View>
                  <Text className="text-gray-500 text-xs font-medium">{payment.status}</Text>
                </View>
                <Text className="text-gray-400 text-xs">{payment.date}</Text>
              </View>
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
