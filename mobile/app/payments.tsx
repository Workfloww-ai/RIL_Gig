import React, { useEffect, useState } from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { apiClient } from '../src/api/client';

export default function PaymentsScreen() {
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<any[]>([]);
  const [totalEarnings, setTotalEarnings] = useState(0);

  useEffect(() => {
    const fetchPayments = async () => {
      try {
        const res = await apiClient.get('/auth/me');
        if (res.data && res.data.recent_activity) {
          const activities = res.data.recent_activity;
          
          let total = 0;
          const grouped: Record<string, any> = {};

          activities.forEach((act: any) => {
            total += act.amount || 0;
            if (!act.shift_date) return;
            const d = new Date(act.shift_date);
            const monthStr = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            
            if (!grouped[monthStr]) {
              grouped[monthStr] = {
                id: monthStr,
                month: monthStr,
                amount: 0,
                date: act.shift_date,
                status: 'Processed'
              };
            }
            grouped[monthStr].amount += (act.amount || 0);
            if (new Date(act.shift_date) > new Date(grouped[monthStr].date)) {
               grouped[monthStr].date = act.shift_date;
            }
          });
          
          const sortedPayments = Object.values(grouped).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
          
          // Format date strings
          sortedPayments.forEach((p: any) => {
             p.date = new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          });

          setPayments(sortedPayments);
          // Set total from profile if available, otherwise fallback to calculated total
          // Note: Mock UI showed ₹ 12,500 total but month-wise adds up to ₹ 12,500. We use calculated or profile data.
          setTotalEarnings(total);
        }
      } catch (error) {
        console.error('Error fetching payments:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchPayments();
  }, []);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 pt-8 items-center justify-center">
        <ActivityIndicator size="large" color="#2563EB" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50 pt-8">
      {/* Header */}
      <View className="bg-white px-6 py-4 flex-row items-center border-b border-gray-100 shadow-sm z-10">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center bg-gray-100 rounded-full mr-3">
          <Feather name="arrow-left" size={20} color="#4B5563" />
        </TouchableOpacity>
        <Text className="font-bold text-gray-900 text-lg flex-1 text-center pr-13">Payment History</Text>
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
          
          {payments.length > 0 ? payments.map((payment) => (
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
          )) : (
            <View className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 items-center justify-center">
              <Text className="text-gray-500 py-2">No payment history available</Text>
            </View>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
