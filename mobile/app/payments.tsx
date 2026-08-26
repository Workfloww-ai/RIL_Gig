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
          setPayments(res.data.recent_activity);
          
          const total = res.data.recent_activity.reduce((sum: number, act: any) => sum + (act.amount || 0), 0);
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
      <SafeAreaView className="flex-1 bg-sand pt-8 items-center justify-center">
        <ActivityIndicator size="large" color="#0B5B31" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-sand pt-8">
      {/* Header */}
      <View className="bg-cream px-6 py-4 flex-row items-center border-b border-sage/10 shadow-sm z-10">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center bg-sage/10 rounded-full mr-3">
          <Feather name="arrow-left" size={20} color="#666666" />
        </TouchableOpacity>
        <Text className="font-bold text-slate text-lg flex-1 text-center pr-13">Payment History</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        
        {/* Earnings Summary Card */}
        <View className="bg-moss mx-5 mt-6 rounded-3xl p-6 shadow-sm items-center">
          <Text className="text-sand text-xs font-bold tracking-widest uppercase mb-2">Lifetime Earnings</Text>
          <Text className="text-white text-4xl font-bold mb-4">₹ {totalEarnings.toLocaleString()}</Text>
          <View className="bg-moss/90 px-4 py-2 rounded-full border border-moss/50">
            <Text className="text-white text-xs font-medium">Earnings from all completed shifts</Text>
          </View>
        </View>

        {/* All Shifts List */}
        <View className="px-5 pt-8 pb-10">
          <Text className="text-lg font-bold text-slate mb-4">All Activity</Text>
          
          {payments.length > 0 ? payments.map((activity, index) => {
            const date = activity.shift_date ? new Date(activity.shift_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
            return (
              <View key={activity.id || index} className="bg-cream rounded-3xl p-5 shadow-sm border border-sage/10 mb-3">
                <View className="flex-row items-center">
                  <View className={`w-12 h-12 rounded-full items-center justify-center mr-4 ${activity.payment_status === 'processed' ? 'bg-green-100' : 'bg-yellow-100'}`}>
                    {activity.payment_status === 'processed' ? (
                      <Text className="text-green-600 text-xl">✓</Text>
                    ) : (
                      <Feather name="clock" size={24} color="#CA8A04" />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="font-bold text-slate text-base mb-1">{activity.job_name}</Text>
                    <Text className="text-sage text-xs">
                      {activity.payment_status === 'processed' ? 'Payment Processed' : 'Amount needs to be processed'} - {activity.hours} hrs
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="font-bold text-green-600 text-lg">+₹{activity.amount}</Text>
                    <Text className="text-sage text-[10px]">{date}</Text>
                  </View>
                </View>
              </View>
            );
          }) : (
            <View className="bg-cream rounded-3xl p-5 shadow-sm border border-sage/10 items-center justify-center">
              <Text className="text-sage py-2">No activity available</Text>
            </View>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
