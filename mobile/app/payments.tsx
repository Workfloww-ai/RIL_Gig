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
  const [totalReceived, setTotalReceived] = useState(0);
  const [pendingBalance, setPendingBalance] = useState(0);

  useEffect(() => {
    const fetchPayments = async () => {
      try {
        const res = await apiClient.get('/auth/me');
        if (res.data && res.data.recent_activity) {
          setPayments(res.data.recent_activity);
          
          const total = res.data.recent_activity.reduce((sum: number, act: any) => sum + (act.amount || 0), 0);
          const received = res.data.recent_activity.reduce((sum: number, act: any) => sum + (act.payment_status === 'completed' ? (act.amount || 0) : 0), 0);
          setTotalEarnings(total);
          setTotalReceived(received);
          setPendingBalance(total - received);
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
        <ActivityIndicator size="large" color="#10472B" />
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
        <View className="bg-moss mx-5 mt-6 rounded-3xl p-6 shadow-sm">
          <View className="items-center mb-6">
            <Text className="text-sand/80 text-xs font-bold tracking-widest uppercase mb-2">Lifetime Earnings</Text>
            <Text className="text-white text-4xl font-bold">₹ {totalEarnings.toLocaleString()}</Text>
          </View>
          
          <View className="flex-row justify-between border-t border-white/10 pt-4">
            <View className="flex-1 items-center border-r border-white/10">
              <Text className="text-sand/80 text-xs font-bold mb-1 uppercase">Received</Text>
              <Text className="text-white text-xl font-bold">₹ {totalReceived.toLocaleString()}</Text>
            </View>
            <View className="flex-1 items-center">
              <Text className="text-sand/80 text-xs font-bold mb-1 uppercase">Pending</Text>
              <Text className="text-white text-xl font-bold text-[#FBBF24]">₹ {pendingBalance.toLocaleString()}</Text>
            </View>
          </View>
        </View>

        {/* All Shifts List */}
        <View className="px-5 pt-8 pb-10">
          <Text className="text-lg font-bold text-slate mb-4">Shift Payments</Text>
          
          {payments && payments.length > 0 ? payments.map((activity, index) => {
            const date = new Date(activity.shift_date || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            return (
              <View key={index} className="bg-cream rounded-3xl p-5 mb-4 shadow-sm border border-sage/10">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="font-bold text-slate text-lg">{date}</Text>
                  <Text className="font-bold text-moss text-xl">+₹{activity.amount?.toLocaleString() || 0}</Text>
                </View>
                
                <View className="flex-row items-center justify-between border-t border-sage/10 pt-3">
                  <View className="flex-row items-center w-full">
                    <View className={`w-12 h-12 rounded-full items-center justify-center mr-4 ${activity.payment_status === 'completed' ? 'bg-moss/10' : 'bg-sage/10'}`}>
                      {activity.payment_status === 'completed' ? (
                        <Text className="text-moss text-xl">✓</Text>
                      ) : (
                        <Feather name="clock" size={24} color="#CA8A04" />
                      )}
                    </View>
                    <View className="flex-1">
                      <Text className="font-bold text-slate text-base mb-1">{activity.job_name || 'Shift Payment'}</Text>
                      <Text className="text-sage text-xs">
                        {activity.store_name || 'Unknown Store'}
                      </Text>
                    </View>
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
