import React, { useState } from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, Modal, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function StoreManagerRequestsScreen() {
  const router = useRouter();
  const [isRaiseModalOpen, setIsRaiseModalOpen] = useState(false);

  // Request state
  const [requestsList, setRequestsList] = useState([
    {
      id: 'req-1',
      title: 'Inventory Restocking Associate',
      shiftTime: 'Today • 2:00 PM to 6:00 PM',
      status: 'Pending Approval',
      workersNeeded: 2,
      compensation: 800,
    },
    {
      id: 'req-2',
      title: 'Morning Display Setup',
      shiftTime: 'Today • 8:00 AM to 12:00 PM',
      status: 'Active & Filled',
      workersNeeded: 1,
      compensation: 600,
    },
    {
      id: 'req-3',
      title: 'Cash Counter Assistant',
      shiftTime: 'Tomorrow • 10:00 AM to 2:00 PM',
      status: 'Approved',
      workersNeeded: 1,
      compensation: 700,
    },
  ]);

  // Form State
  const [requestStore] = useState('Reliance Smart – Phoenix Marketcity');
  const [requestDate, setRequestDate] = useState('12/08/2026');
  const [requestRole, setRequestRole] = useState('Inventory Restocking Associate');
  const [requestStartTime, setRequestStartTime] = useState('02:00 PM');
  const [requestHours, setRequestHours] = useState('4');
  const [requestNumWorkers, setRequestNumWorkers] = useState('2');
  const [requestCompensation, setRequestCompensation] = useState('800');

  const handlePublishRequest = () => {
    if (!requestRole || !requestStartTime) {
      Alert.alert('Missing Details', 'Please fill in all required job request fields.');
      return;
    }

    const newReq = {
      id: `req-${Date.now()}`,
      title: requestRole,
      shiftTime: `Today • ${requestStartTime}`,
      status: 'Pending Approval',
      workersNeeded: parseInt(requestNumWorkers) || 1,
      compensation: parseInt(requestCompensation) || 800,
    };

    setRequestsList([newReq, ...requestsList]);
    setIsRaiseModalOpen(false);
    Alert.alert('Request Published', 'Your manpower request has been successfully published to the worker pool!');
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Top Bar Header */}
      <View className="bg-blue-600 px-6 pt-10 pb-6 rounded-b-3xl shadow-sm flex-row items-center justify-between">
        <TouchableOpacity onPress={() => router.push('/store_manager')} className="flex-row items-center">
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
          <Text className="text-white font-bold text-lg ml-2">My Requests</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setIsRaiseModalOpen(true)}
          className="bg-white/20 border border-white/40 px-3 py-1.5 rounded-full"
        >
          <Text className="text-white font-bold text-xs">+ New Request</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-5 pt-5" showsVerticalScrollIndicator={false}>
        {requestsList.map((job) => (
          <View key={job.id} className="bg-white rounded-2xl p-5 mb-4 border border-gray-100 shadow-sm">
            <View className="flex-row justify-between items-start mb-1">
              <Text className="font-bold text-gray-900 text-lg flex-1 mr-2">{job.title}</Text>
              <View
                className={`px-3 py-1 rounded-full ${
                  job.status === 'Pending Approval' ? 'bg-amber-100' : 'bg-emerald-100'
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    job.status === 'Pending Approval' ? 'text-amber-800' : 'text-emerald-800'
                  }`}
                >
                  {job.status}
                </Text>
              </View>
            </View>

            <Text className="text-gray-500 text-xs font-medium mb-3">{job.shiftTime}</Text>

            <View className="bg-gray-50/80 rounded-xl p-4 flex-row justify-between items-center border border-gray-100">
              <View>
                <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">Workers</Text>
                <Text className="text-gray-900 font-bold text-base">{job.workersNeeded} Needed</Text>
              </View>
              <View className="items-end">
                <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">Compensation</Text>
                <Text className="text-gray-900 font-bold text-base">₹{job.compensation}</Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* RAISE REQUEST MODAL */}
      <Modal visible={isRaiseModalOpen} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-[32px] p-6">
            <View className="flex-row justify-between items-center mb-5">
              <Text className="text-xl font-bold text-gray-900">Raise Manpower Request</Text>
              <TouchableOpacity onPress={() => setIsRaiseModalOpen(false)}>
                <Ionicons name="close-circle-outline" size={28} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="max-h-[480px]">
              <View className="mb-4">
                <Text className="text-xs font-bold text-gray-600 mb-1.5">Store</Text>
                <TextInput
                  value={requestStore}
                  editable={false}
                  className="bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 font-medium"
                />
              </View>

              <View className="flex-row space-x-3 mb-4">
                <View className="flex-1 mr-1">
                  <Text className="text-xs font-bold text-gray-600 mb-1.5">Date</Text>
                  <TextInput
                    value={requestDate}
                    onChangeText={setRequestDate}
                    placeholder="dd/mm/yyyy"
                    className="bg-white border border-gray-300 rounded-xl px-3 py-3 text-sm text-gray-900"
                  />
                </View>

                <View className="flex-1 ml-1">
                  <Text className="text-xs font-bold text-gray-600 mb-1.5">Role</Text>
                  <TextInput
                    value={requestRole}
                    onChangeText={setRequestRole}
                    placeholder="Select a role..."
                    className="bg-white border border-gray-300 rounded-xl px-3 py-3 text-sm text-gray-900"
                  />
                </View>
              </View>

              <View className="flex-row space-x-3 mb-4">
                <View className="flex-1 mr-1">
                  <Text className="text-xs font-bold text-gray-600 mb-1.5">Start Time</Text>
                  <TextInput
                    value={requestStartTime}
                    onChangeText={setRequestStartTime}
                    placeholder="--:-- --"
                    className="bg-white border border-gray-300 rounded-xl px-3 py-3 text-sm text-gray-900"
                  />
                </View>

                <View className="flex-1 ml-1">
                  <Text className="text-xs font-bold text-gray-600 mb-1.5">How many hours?</Text>
                  <TextInput
                    value={requestHours}
                    onChangeText={setRequestHours}
                    keyboardType="numeric"
                    className="bg-white border border-gray-300 rounded-xl px-3 py-3 text-sm text-gray-900"
                  />
                </View>
              </View>

              <View className="flex-row space-x-3 mb-6">
                <View className="flex-1 mr-1">
                  <Text className="text-xs font-bold text-gray-600 mb-1.5">Number of Workers</Text>
                  <TextInput
                    value={requestNumWorkers}
                    onChangeText={setRequestNumWorkers}
                    keyboardType="numeric"
                    className="bg-white border border-gray-300 rounded-xl px-3 py-3 text-sm text-gray-900"
                  />
                </View>

                <View className="flex-1 ml-1">
                  <Text className="text-xs font-bold text-gray-600 mb-1.5">Compensation (Fixed ₹)</Text>
                  <TextInput
                    value={requestCompensation}
                    onChangeText={setRequestCompensation}
                    keyboardType="numeric"
                    placeholder="Auto-set by role"
                    className="bg-gray-50 border border-gray-300 rounded-xl px-3 py-3 text-sm text-gray-900 font-semibold"
                  />
                </View>
              </View>

              <TouchableOpacity
                onPress={handlePublishRequest}
                className="bg-blue-600 py-4 rounded-xl items-center shadow-md mb-4"
              >
                <Text className="text-white font-bold text-base">Publish to Worker Pool</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
