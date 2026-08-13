import React, { useState, useEffect } from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, Modal, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../src/api/client';

export default function StoreManagerRequestsScreen() {
  const router = useRouter();
  const [isRaiseModalOpen, setIsRaiseModalOpen] = useState(false);
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  
  // Available Jobs from API
  const [availableJobs, setAvailableJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);

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
  const [requestStartTime, setRequestStartTime] = useState('02:00 PM');
  const [requestHours, setRequestHours] = useState('4');
  const [requestNumWorkers, setRequestNumWorkers] = useState('2');
  const [requestCompensation, setRequestCompensation] = useState('0');

  // Fetch available jobs on mount
  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const response = await apiClient.get('/jobs/available');
        setAvailableJobs(response.data);
      } catch (error) {
        console.error('Failed to fetch jobs', error);
      }
    };
    fetchJobs();
  }, []);

  // Recalculate compensation when job or hours change
  useEffect(() => {
    if (selectedJob && requestHours) {
      const hours = parseFloat(requestHours);
      if (!isNaN(hours) && hours > 0) {
        const total = selectedJob.base_compensation * hours;
        setRequestCompensation(total.toString());
      } else {
        setRequestCompensation('0');
      }
    }
  }, [selectedJob, requestHours]);

  const handlePublishRequest = () => {
    if (!selectedJob || !requestStartTime) {
      Alert.alert('Missing Details', 'Please fill in all required job request fields.');
      return;
    }

    const newReq = {
      id: `req-${Date.now()}`,
      title: selectedJob.title,
      shiftTime: `Today • ${requestStartTime}`,
      status: 'Pending Approval',
      workersNeeded: parseInt(requestNumWorkers) || 1,
      compensation: parseInt(requestCompensation) || 0,
    };

    setRequestsList([newReq, ...requestsList]);
    setIsRaiseModalOpen(false);
    setSelectedJob(null);
    Alert.alert('Request Published', 'Your manpower request has been successfully published to the worker pool!');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F8F9' }}>
      {/* Top Bar Header */}
      <View style={{ backgroundColor: '#10472B', paddingHorizontal: 20, paddingTop: 40, paddingBottom: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <TouchableOpacity onPress={() => router.push('/store_manager')} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 18, marginLeft: 8 }}>My Requests</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setIsRaiseModalOpen(true)}
          style={{ backgroundColor: '#E31B23', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, flexDirection: 'row', alignItems: 'center' }}
        >
          <Ionicons name="add-outline" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 12 }}>New Request</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16 }} showsVerticalScrollIndicator={false}>
        {requestsList.map((job) => (
          <View key={job.id} style={{ backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <Text style={{ fontWeight: '700', color: '#1A1A1A', fontSize: 17, flex: 1, marginRight: 8 }}>{job.title}</Text>
              <View
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 5,
                  borderRadius: 999,
                  backgroundColor: job.status === 'Pending Approval' ? '#FEF3C7' : '#DCFCE7',
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: job.status === 'Pending Approval' ? '#D97706' : '#15803D' }}>
                  {job.status}
                </Text>
              </View>
            </View>

            <Text style={{ color: '#666666', fontSize: 13, fontWeight: '500', marginBottom: 14 }}>{job.shiftTime}</Text>

            <View style={{ backgroundColor: '#F7F8F9', borderRadius: 14, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' }}>
              <View>
                <Text style={{ color: '#666666', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Workers</Text>
                <Text style={{ color: '#1A1A1A', fontWeight: '700', fontSize: 16 }}>{job.workersNeeded} Needed</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: '#666666', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Compensation</Text>
                <Text style={{ color: '#1A1A1A', fontWeight: '700', fontSize: 16 }}>₹{job.compensation}</Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* RAISE REQUEST MODAL */}
      <Modal visible={isRaiseModalOpen} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#1A1A1A' }}>Raise Manpower Request</Text>
              <TouchableOpacity onPress={() => setIsRaiseModalOpen(false)}>
                <Ionicons name="close-circle-outline" size={28} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
              <View style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#666666', marginBottom: 6 }}>Store</Text>
                <TextInput
                  value={requestStore}
                  editable={false}
                  style={{ backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: '#4B5563', fontWeight: '500' }}
                />
              </View>

              <View style={{ flexDirection: 'row', marginBottom: 14 }}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#666666', marginBottom: 6 }}>Date</Text>
                  <TextInput
                     value={requestDate}
                     onChangeText={setRequestDate}
                     placeholder="dd/mm/yyyy"
                     style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, color: '#1A1A1A' }}
                  />
                </View>

                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#666666', marginBottom: 6 }}>Role</Text>
                  <TouchableOpacity 
                    onPress={() => setIsJobModalOpen(true)}
                    style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <Text style={{ fontSize: 14, color: selectedJob ? '#1A1A1A' : '#9CA3AF' }} numberOfLines={1}>
                      {selectedJob ? selectedJob.title : 'Select a role...'}
                    </Text>
                    <Ionicons name="chevron-down-outline" size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={{ flexDirection: 'row', marginBottom: 14 }}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#666666', marginBottom: 6 }}>Start Time</Text>
                  <TextInput
                    value={requestStartTime}
                    onChangeText={setRequestStartTime}
                    placeholder="--:-- --"
                    style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, color: '#1A1A1A' }}
                  />
                </View>

                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#666666', marginBottom: 6 }}>How many hours?</Text>
                  <TextInput
                    value={requestHours}
                    onChangeText={setRequestHours}
                    keyboardType="numeric"
                    style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, color: '#1A1A1A' }}
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', marginBottom: 24 }}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#666666', marginBottom: 6 }}>Number of Workers</Text>
                  <TextInput
                    value={requestNumWorkers}
                    onChangeText={setRequestNumWorkers}
                    keyboardType="numeric"
                    style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, color: '#1A1A1A' }}
                  />
                </View>

                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#666666', marginBottom: 6 }}>Compensation (Fixed ₹)</Text>
                  <TextInput
                    value={requestCompensation}
                    editable={false}
                    placeholder="Auto-calculated"
                    style={{ backgroundColor: '#F7F8F9', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, color: '#1A1A1A', fontWeight: '700' }}
                  />
                </View>
              </View>

              <TouchableOpacity
                onPress={handlePublishRequest}
                style={{ backgroundColor: '#E31B23', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 16 }}
                activeOpacity={0.85}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>Publish to Worker Pool</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* JOB SELECTOR MODAL */}
      <Modal visible={isJobModalOpen} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, maxHeight: '80%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#1A1A1A' }}>Select Role</Text>
              <TouchableOpacity onPress={() => setIsJobModalOpen(false)}>
                <Ionicons name="close-circle" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {availableJobs.map((job, index) => (
                <TouchableOpacity
                  key={job.job_id || index}
                  onPress={() => {
                    setSelectedJob(job);
                    setIsJobModalOpen(false);
                  }}
                  style={{ paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 16, color: '#1A1A1A', fontWeight: selectedJob?.job_id === job.job_id ? '700' : '500' }}>
                    {job.title}
                  </Text>
                  <Text style={{ fontSize: 14, color: '#6B7280' }}>₹{job.base_compensation}/hr</Text>
                </TouchableOpacity>
              ))}
              {availableJobs.length === 0 && (
                <Text style={{ textAlign: 'center', color: '#6B7280', padding: 20 }}>No roles available</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
