import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, TextInput, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../api/client';
import DateTimePicker from '@react-native-community/datetimepicker';

interface RaiseRequestModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  managerStoreName: string;
}

export default function RaiseRequestModal({ visible, onClose, onSuccess, managerStoreName }: RaiseRequestModalProps) {
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [availableJobs, setAvailableJobs] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any>(null);

  // Form State
  const [requestDate, setRequestDate] = useState<string | undefined>();
  const [requestStartTime, setRequestStartTime] = useState<string | undefined>();
  const [requestHours, setRequestHours] = useState<string | undefined>();
  const [requestNumWorkers, setRequestNumWorkers] = useState<string | undefined>();
  const [requestCompensation, setRequestCompensation] = useState<string | undefined>();

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [dateObj, setDateObj] = useState(new Date());

  const onDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selectedDate) {
      setDateObj(selectedDate);
      const day = selectedDate.getDate().toString().padStart(2, '0');
      const month = (selectedDate.getMonth() + 1).toString().padStart(2, '0');
      const year = selectedDate.getFullYear();
      setRequestDate(`${day}/${month}/${year}`);
    }
  };

  const onTimeChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (selectedDate) {
      setDateObj(selectedDate);
      let hours = selectedDate.getHours();
      let minutes = selectedDate.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
      setRequestStartTime(`${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`);
    }
  };

  useEffect(() => {
    if (visible && availableJobs.length === 0) {
      const fetchJobs = async () => {
        try {
          const jobsRes = await apiClient.get('/jobs/roles');
          setAvailableJobs(jobsRes.data);
        } catch (error) {
          console.error('Failed to fetch jobs', error);
        }
      };
      fetchJobs();
    }
  }, [visible]);

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

    const dateParts = requestDate.split('/');
    let formattedDate = requestDate;
    if (dateParts.length === 3) {
      formattedDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
    }

    let formattedTime = requestStartTime;
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
      setSelectedJob(null);
      Alert.alert('Request Sent!', 'The request has been sent to the superadmin for approval.');
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error creating request", error);
      Alert.alert('Error', 'Failed to send request.');
    }
  };

  return (
    <>
      {/* RAISE REQUEST MODAL */}
      <Modal visible={visible} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 20, paddingHorizontal: 20, paddingBottom: 16, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#1A1A1A' }}>Raise Manpower Request</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close-circle-outline" size={26} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }} style={{ maxHeight: 380 }}>
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#666666', marginBottom: 4 }}>Store</Text>
                <View
                  style={{ backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <Text style={{ fontSize: 14, color: '#1A1A1A' }} numberOfLines={1}>
                    {managerStoreName}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', marginBottom: 12 }}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#666666', marginBottom: 4 }}>Date</Text>
                  <TouchableOpacity
                    onPress={() => setShowDatePicker(true)}
                    style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <Text style={{ fontSize: 14, color: requestDate ? '#1A1A1A' : '#9CA3AF' }} numberOfLines={1}>
                      {requestDate || 'dd/mm/yyyy'}
                    </Text>
                    <Ionicons name="calendar-outline" size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>

                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#666666', marginBottom: 4 }}>Role</Text>
                  <TouchableOpacity
                    onPress={() => setIsJobModalOpen(true)}
                    style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <Text style={{ fontSize: 14, color: selectedJob ? '#1A1A1A' : '#9CA3AF' }} numberOfLines={1}>
                      {selectedJob ? selectedJob.job_name : 'Select a role...'}
                    </Text>
                    <Ionicons name="chevron-down-outline" size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={{ flexDirection: 'row', marginBottom: 12 }}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#666666', marginBottom: 4 }}>Start Time</Text>
                  <TouchableOpacity
                    onPress={() => setShowTimePicker(true)}
                    style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <Text style={{ fontSize: 14, color: requestStartTime ? '#1A1A1A' : '#9CA3AF' }} numberOfLines={1}>
                      {requestStartTime || '--:-- --'}
                    </Text>
                    <Ionicons name="time-outline" size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>

                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#666666', marginBottom: 4 }}>Hours per SahYogi</Text>
                  <TextInput
                    value={requestHours}
                    onChangeText={(val) => setRequestHours(val.replace(/[^0-9.]/g, ''))}
                    keyboardType="numeric"
                    style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1A1A1A' }}
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', marginBottom: 20 }}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#666666', marginBottom: 4 }}>Number of SahYogi</Text>
                  <TextInput
                    value={requestNumWorkers}
                    onChangeText={(val) => setRequestNumWorkers(val.replace(/[^0-9]/g, ''))}
                    keyboardType="numeric"
                    style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1A1A1A' }}
                  />
                </View>

                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#666666', marginBottom: 4 }}>Pay per SahYogi</Text>
                  <TextInput
                    value={requestCompensation}
                    editable={false}
                    placeholder="Auto-calculated"
                    style={{ backgroundColor: '#F7F8F9', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1A1A1A', fontWeight: '700' }}
                  />
                </View>
              </View>

              <TouchableOpacity
                onPress={handlePublishRequest}
                style={{ backgroundColor: '#D32F2F', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 0 }}
                activeOpacity={0.85}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>Send Request For Approval</Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Decorative Brand Line - Absolute Bottom Edge */}
            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 6, flexDirection: 'row' }}>
              <View style={{ flex: 1, backgroundColor: '#0B5B31' }} />
              <View style={{ width: 16, height: 6, backgroundColor: '#0B5B31', zIndex: 2 }}>
                <View style={{ position: 'absolute', left: 4, width: 40, height: 6, backgroundColor: '#D32F2F', transform: [{ skewX: '45deg' }] }} />
                <View style={{ position: 'absolute', left: 4, width: 4, height: 6, backgroundColor: '#FFFFFF', transform: [{ skewX: '45deg' }] }} />
              </View>
              <View style={{ flex: 1, backgroundColor: '#D32F2F', zIndex: 1 }} />
            </View>
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
                </TouchableOpacity>
              ))}
              {availableJobs.length === 0 && (
                <Text style={{ textAlign: 'center', color: '#6B7280', padding: 20 }}>No roles available</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {showDatePicker && (
        <DateTimePicker
          value={dateObj}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onChange={onDateChange}
        />
      )}
      {showTimePicker && (
        <DateTimePicker
          value={dateObj}
          mode="time"
          display="default"
          onChange={onTimeChange}
        />
      )}
    </>
  );
}
