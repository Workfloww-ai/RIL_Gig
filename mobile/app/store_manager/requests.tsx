import React, { useState, useEffect } from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, Modal, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../src/api/client';

export default function StoreManagerRequestsScreen() {
  const router = useRouter();
  const [isRaiseModalOpen, setIsRaiseModalOpen] = useState(false);
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  
  // Available Jobs and Stores from API
  const [availableJobs, setAvailableJobs] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [availableStores, setAvailableStores] = useState<any[]>([]);
  const [selectedStore, setSelectedStore] = useState<any>(null);

  // Request state
  const [requestsList, setRequestsList] = useState<any[]>([]);

  // Form State
  const [requestDate, setRequestDate] = useState('12/08/2026');
  const [requestStartTime, setRequestStartTime] = useState('02:00 PM');
  const [requestHours, setRequestHours] = useState('4');
  const [requestNumWorkers, setRequestNumWorkers] = useState('2');
  const [requestCompensation, setRequestCompensation] = useState('0');

  // Fetch available jobs, stores, and manager requests on mount
  const fetchRequests = async () => {
    try {
      const res = await apiClient.get('/jobs/manager/requests');
      if (res.data && res.data.requests) {
        setRequestsList(res.data.requests);
      }
    } catch (error) {
      console.error('Failed to fetch manager requests', error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [jobsRes, storesRes] = await Promise.all([
          apiClient.get('/jobs/roles'),
          apiClient.get('/stores/')
        ]);
        setAvailableJobs(jobsRes.data);
        if (storesRes.data && storesRes.data.stores) {
          setAvailableStores(storesRes.data.stores);
        }
        await fetchRequests();
      } catch (error) {
        console.error('Failed to fetch jobs or stores', error);
      }
    };
    fetchData();
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

  const handlePublishRequest = async () => {
    if (!selectedJob || !requestStartTime || !requestDate) {
      Alert.alert('Missing Details', 'Please fill in all required job request fields.');
      return;
    }

    // Convert dd/mm/yyyy to yyyy-mm-dd
    const dateParts = requestDate.split('/');
    let formattedDate = requestDate;
    if (dateParts.length === 3) {
      formattedDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
    }

    // Attempt to format time
    let formattedTime = requestStartTime;
    // VERY Basic conversion for '02:00 PM' to '14:00:00'
    const timeParts = requestStartTime.split(' ');
    if (timeParts.length === 2) {
      const [time, period] = timeParts;
      let [hours, minutes] = time.split(':');
      let hr = parseInt(hours, 10);
      if (period.toUpperCase() === 'PM' && hr !== 12) hr += 12;
      if (period.toUpperCase() === 'AM' && hr === 12) hr = 0;
      formattedTime = `${hr.toString().padStart(2, '0')}:${minutes}:00`;
    }

    const payload = {
      job_id: selectedJob.job_id,
      workers_needed: parseInt(requestNumWorkers) || 1,
      shift_date: formattedDate,
      start_time: formattedTime,
      hours_duration: parseFloat(requestHours) || 4
    };

    try {
      await apiClient.post('/jobs/', payload);
      setIsRaiseModalOpen(false);
      setSelectedJob(null);
      Alert.alert('Request Published', 'Your manpower request has been successfully published to the worker pool!');
      fetchRequests();
    } catch (error) {
      console.error("Error creating request", error);
      Alert.alert('Error', 'Failed to publish request.');
    }
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
          <View key={job.request_id || job.id} style={{ backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <Text style={{ fontWeight: '700', color: '#1A1A1A', fontSize: 17, flex: 1, marginRight: 8 }}>{job.job_name || job.title}</Text>
              <View
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 5,
                  borderRadius: 999,
                  backgroundColor: job.approval_status === 'approved' ? '#DCFCE7' : '#FEF3C7',
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: job.approval_status === 'approved' ? '#15803D' : '#D97706' }}>
                  {job.approval_status === 'approved' ? 'Approved' : 'Pending Approval'}
                </Text>
              </View>
            </View>

            <Text style={{ color: '#666666', fontSize: 13, fontWeight: '500', marginBottom: 14 }}>
              {job.shift_date} • {job.start_time}
            </Text>

            <View style={{ backgroundColor: '#F7F8F9', borderRadius: 14, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' }}>
              <View>
                <Text style={{ color: '#666666', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Workers</Text>
                <Text style={{ color: '#1A1A1A', fontWeight: '700', fontSize: 16 }}>{job.workers_needed || job.workersNeeded} Needed</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: '#666666', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Compensation</Text>
                <Text style={{ color: '#1A1A1A', fontWeight: '700', fontSize: 16 }}>₹{(job.base_compensation || 0) * (job.hours_duration || 0)}</Text>
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
                <TouchableOpacity 
                  onPress={() => setIsStoreModalOpen(true)}
                  style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <Text style={{ fontSize: 14, color: selectedStore ? '#1A1A1A' : '#9CA3AF' }} numberOfLines={1}>
                    {selectedStore ? selectedStore.store_name : 'Select a store...'}
                  </Text>
                  <Ionicons name="chevron-down-outline" size={16} color="#9CA3AF" />
                </TouchableOpacity>
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
                      {selectedJob ? selectedJob.job_name : 'Select a role...'}
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
              {availableJobs.map((job: any, index: number) => (
                <TouchableOpacity
                  key={job.job_id || index}
                  onPress={() => {
                    setSelectedJob(job);
                    setIsJobModalOpen(false);
                  }}
                  style={{ paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 16, color: '#1A1A1A', fontWeight: selectedJob?.job_id === job.job_id ? '700' : '500' }}>
                    {job.job_name}
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

      {/* STORE SELECTOR MODAL */}
      <Modal visible={isStoreModalOpen} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, maxHeight: '80%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#1A1A1A' }}>Select Store</Text>
              <TouchableOpacity onPress={() => setIsStoreModalOpen(false)}>
                <Ionicons name="close-circle" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {availableStores.map((store: any, index: number) => (
                <TouchableOpacity
                  key={store.store_id || index}
                  onPress={() => {
                    setSelectedStore(store);
                    setIsStoreModalOpen(false);
                  }}
                  style={{ paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <View>
                    <Text style={{ fontSize: 16, color: '#1A1A1A', fontWeight: selectedStore?.store_id === store.store_id ? '700' : '500' }}>
                      {store.store_name}
                    </Text>
                    {store.city && <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 4 }}>{store.city}</Text>}
                  </View>
                </TouchableOpacity>
              ))}
              {availableStores.length === 0 && (
                <Text style={{ textAlign: 'center', color: '#6B7280', padding: 20 }}>No stores available</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
