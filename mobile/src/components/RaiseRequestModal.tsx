import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, TextInput, Platform, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { apiClient } from '../api/client';
import DateTimePicker from '@react-native-community/datetimepicker';

interface RaiseRequestModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  managerStoreName: string;
}

interface CategoryOption {
  category_id: string;
  name: string;
  domain_id?: string;
}

export default function RaiseRequestModal({ visible, onClose, onSuccess, managerStoreName }: RaiseRequestModalProps) {
  const [storeDomainName, setStoreDomainName] = useState<string>('General');
  const [availableCategories, setAvailableCategories] = useState<CategoryOption[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CategoryOption | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [availableJobs, setAvailableJobs] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [loadingRoles, setLoadingRoles] = useState(false);

  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusModalContent, setStatusModalContent] = useState({ title: '', message: '', type: 'success' });

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
      hours = hours ? hours : 12;
      setRequestStartTime(`${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`);
    }
  };

  // Helper icon for categories
  const getCategoryIcon = (categoryName: string): keyof typeof MaterialCommunityIcons.glyphMap => {
    const lower = categoryName.toLowerCase();
    if (lower.includes('electric')) return 'lightning-bolt';
    if (lower.includes('plumb')) return 'water';
    if (lower.includes('hvac') || lower.includes('ac')) return 'weather-windy';
    if (lower.includes('carpent')) return 'hammer';
    if (lower.includes('mechanic')) return 'wrench';
    if (lower.includes('retail') || lower.includes('cashier')) return 'barcode-scan';
    if (lower.includes('warehouse') || lower.includes('loader')) return 'warehouse';
    if (lower.includes('hospitality') || lower.includes('f&b')) return 'silverware-fork-knife';
    if (lower.includes('logistic') || lower.includes('deliver')) return 'bike-fast';
    if (lower.includes('phlebotom') || lower.includes('medic')) return 'needle';
    return 'briefcase-outline';
  };

  // Fetch store categories on modal open and reset form
  useEffect(() => {
    if (visible) {
      setSelectedCategory(null);
      setSelectedJob(null);
      setAvailableJobs([]);
      setRequestDate(undefined);
      setRequestStartTime(undefined);
      setRequestHours(undefined);
      setRequestNumWorkers(undefined);
      setRequestCompensation(undefined);

      const fetchStoreCategories = async () => {
        try {
          const res = await apiClient.get('/jobs/store-categories');
          if (res.data) {
            setStoreDomainName(res.data.domain_name || 'General');
            setAvailableCategories(res.data.categories || []);
          }
        } catch (error) {
          console.error('Failed to fetch store categories', error);
        }
      };
      fetchStoreCategories();
    }
  }, [visible]);

  // When manager chooses a category, fetch roles for that category
  const handleSelectCategory = async (cat: CategoryOption) => {
    setSelectedCategory(cat);
    setIsCategoryModalOpen(false);
    setSelectedJob(null);
    setAvailableJobs([]);
    setLoadingRoles(true);

    try {
      const res = await apiClient.get('/jobs/roles', {
        params: { category_id: cat.category_id }
      });
      const roles = res.data || [];
      setAvailableJobs(roles);
      // Auto-select if only 1 role exists, or open role selector if multiple
      if (roles.length === 1) {
        setSelectedJob(roles[0]);
      } else if (roles.length > 1) {
        setIsJobModalOpen(true);
      }
    } catch (err) {
      console.error('Failed to fetch roles for category', err);
    } finally {
      setLoadingRoles(false);
    }
  };

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
    if (!selectedCategory) {
      setStatusModalContent({ title: 'Category Required', message: 'Please select a job category for this request.', type: 'error' });
      setShowStatusModal(true);
      return;
    }

    if (!selectedJob || !requestStartTime || !requestDate) {
      setStatusModalContent({ title: 'Missing Details', message: 'Please fill in all required job request fields.', type: 'error' });
      setShowStatusModal(true);
      return;
    }

    const parsedHours = parseFloat(requestHours || '0');
    if (parsedHours < 2) {
      setStatusModalContent({ title: 'Invalid Duration', message: 'Minimum duration for a shift must be at least 2 hours.', type: 'error' });
      setShowStatusModal(true);
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
      category_id: selectedCategory.category_id,
      workers_needed: parseInt(requestNumWorkers) || 1,
      shift_date: formattedDate,
      start_time: formattedTime,
      hours_duration: parseFloat(requestHours) || 4
    };

    try {
      await apiClient.post('/jobs/', payload);
      setSelectedCategory(null);
      setSelectedJob(null);
      setStatusModalContent({ title: 'Request Sent!', message: 'The request has been sent to the superadmin for approval.', type: 'success' });
      setShowStatusModal(true);
    } catch (error: any) {
      console.error("Error creating request", error);
      const detail = error.response?.data?.detail || 'Failed to send request.';
      setStatusModalContent({ title: 'Request Failed', message: detail, type: 'error' });
      setShowStatusModal(true);
    }
  };

  return (
    <>
      {/* RAISE REQUEST MODAL */}
      <Modal visible={visible} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 20, paddingHorizontal: 20, paddingBottom: 16, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <View>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#1A1A1A' }}>Raise Manpower Request</Text>
                <Text style={{ fontSize: 12, color: '#666666', marginTop: 2 }}>
                  Post a new shift for certified SahYogis
                </Text>
              </View>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close-circle-outline" size={26} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }} style={{ maxHeight: 420 }}>
              {/* Store & Domain Info */}
              <View style={{ marginBottom: 12, backgroundColor: '#F8F9FA', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#EEEEEE' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#888888', textTransform: 'uppercase' }}>Assigned Store</Text>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#1A1A1A', marginTop: 2 }} numberOfLines={1}>
                      {managerStoreName}
                    </Text>
                  </View>
                  <View style={{ backgroundColor: '#EAF3EC', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#10472B' }}>
                    <Text style={{ color: '#10472B', fontSize: 11, fontWeight: '800' }}>
                      Domain: {storeDomainName}
                    </Text>
                  </View>
                </View>
              </View>

              {/* 1. Job Category Selection (Required) */}
              <View style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#1A1A1A' }}>1. Select Job Category</Text>
                  <Text style={{ color: '#D32F2F', marginLeft: 2, fontWeight: '700' }}>*</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setIsCategoryModalOpen(true)}
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderWidth: 1.5,
                    borderColor: selectedCategory ? '#10472B' : '#D1D5DB',
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    {selectedCategory ? (
                      <MaterialCommunityIcons
                        name={getCategoryIcon(selectedCategory.name)}
                        size={18}
                        color="#10472B"
                        style={{ marginRight: 8 }}
                      />
                    ) : (
                      <MaterialCommunityIcons
                        name="shape-outline"
                        size={18}
                        color="#9CA3AF"
                        style={{ marginRight: 8 }}
                      />
                    )}
                    <Text style={{ fontSize: 14, color: selectedCategory ? '#10472B' : '#9CA3AF', fontWeight: selectedCategory ? '700' : '500' }}>
                      {selectedCategory ? selectedCategory.name : 'Select Category (e.g. Electrical, Plumber...)'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down-outline" size={16} color="#9CA3AF" />
                </TouchableOpacity>
              </View>

              {/* 2. Job Role Selection (Required) */}
              <View style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#1A1A1A' }}>2. Select Job Role</Text>
                  <Text style={{ color: '#D32F2F', marginLeft: 2, fontWeight: '700' }}>*</Text>
                  {!selectedCategory && (
                    <Text style={{ fontSize: 11, color: '#888888', marginLeft: 6 }}>(Select category first)</Text>
                  )}
                </View>
                <TouchableOpacity
                  disabled={!selectedCategory || loadingRoles}
                  onPress={() => setIsJobModalOpen(true)}
                  style={{
                    backgroundColor: selectedCategory ? '#FFFFFF' : '#F3F4F6',
                    borderWidth: 1.5,
                    borderColor: selectedJob ? '#10472B' : '#D1D5DB',
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    {loadingRoles ? (
                      <ActivityIndicator size="small" color="#10472B" style={{ marginRight: 8 }} />
                    ) : (
                      <Ionicons
                        name="briefcase-outline"
                        size={16}
                        color={selectedJob ? "#10472B" : "#9CA3AF"}
                        style={{ marginRight: 8 }}
                      />
                    )}
                    <Text style={{ fontSize: 14, color: selectedJob ? '#1A1A1A' : '#9CA3AF', fontWeight: selectedJob ? '700' : '500' }}>
                      {selectedJob ? `${selectedJob.job_name} (₹${selectedJob.base_compensation}/hr)` : (loadingRoles ? 'Loading roles...' : 'Select specific role...')}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down-outline" size={16} color="#9CA3AF" />
                </TouchableOpacity>
              </View>

              {/* Date & Start Time */}
              <View style={{ flexDirection: 'row', marginBottom: 12 }}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#666666', marginBottom: 4 }}>Shift Date *</Text>
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
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#666666', marginBottom: 4 }}>Start Time *</Text>
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
              </View>

              {/* Hours & Number of Workers */}
              <View style={{ flexDirection: 'row', marginBottom: 12 }}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#666666', marginBottom: 4 }}>Duration (Hours) *</Text>
                  <TextInput
                    value={requestHours}
                    onChangeText={(val) => setRequestHours(val.replace(/[^0-9.]/g, ''))}
                    placeholder="e.g. 4"
                    keyboardType="numeric"
                    style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1A1A1A' }}
                  />
                </View>

                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#666666', marginBottom: 4 }}>SahYogi Count *</Text>
                  <TextInput
                    value={requestNumWorkers}
                    onChangeText={(val) => setRequestNumWorkers(val.replace(/[^0-9]/g, ''))}
                    placeholder="e.g. 2"
                    keyboardType="numeric"
                    style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1A1A1A' }}
                  />
                </View>
              </View>

              {/* Pay Display */}
              <View style={{ marginBottom: 18 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#666666', marginBottom: 4 }}>Estimated Pay per SahYogi</Text>
                <TextInput
                  value={requestCompensation ? `₹${requestCompensation}` : '₹0'}
                  editable={false}
                  placeholder="Auto-calculated"
                  style={{ backgroundColor: '#F7F8F9', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#10472B', fontWeight: '800' }}
                />
              </View>

              <TouchableOpacity
                onPress={handlePublishRequest}
                style={{ backgroundColor: '#10472B', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
                activeOpacity={0.85}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 16 }}>Send Request For Approval</Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Decorative Brand Line - Absolute Bottom Edge */}
            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 6, flexDirection: 'row' }}>
              <View style={{ flex: 1, backgroundColor: '#0B5B31' }} />
              <View style={{ width: 60, backgroundColor: '#D32F2F' }} />
            </View>
          </View>
        </View>
      </Modal>

      {/* CATEGORY SELECTOR MODAL */}
      <Modal visible={isCategoryModalOpen} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, maxHeight: '80%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <View>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#1A1A1A' }}>Select Job Category</Text>
                <Text style={{ fontSize: 12, color: '#666666', marginTop: 2 }}>
                  Categories allowed in {storeDomainName}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsCategoryModalOpen(false)}>
                <Ionicons name="close-circle" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {availableCategories.map((cat, index) => (
                <TouchableOpacity
                  key={cat.category_id || index}
                  onPress={() => handleSelectCategory(cat)}
                  style={{
                    paddingVertical: 14,
                    paddingHorizontal: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: '#F3F4F6',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: selectedCategory?.category_id === cat.category_id ? '#EAF3EC' : 'transparent',
                    borderRadius: 10,
                    marginBottom: 4
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <MaterialCommunityIcons
                      name={getCategoryIcon(cat.name)}
                      size={20}
                      color="#10472B"
                      style={{ marginRight: 10 }}
                    />
                    <Text style={{ fontSize: 15, color: '#1A1A1A', fontWeight: selectedCategory?.category_id === cat.category_id ? '800' : '600' }}>
                      {cat.name}
                    </Text>
                  </View>
                  {selectedCategory?.category_id === cat.category_id && (
                    <Ionicons name="checkmark-circle" size={18} color="#10472B" />
                  )}
                </TouchableOpacity>
              ))}
              {availableCategories.length === 0 && (
                <Text style={{ textAlign: 'center', color: '#6B7280', padding: 20 }}>
                  No categories found for this store's domain.
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* JOB ROLE SELECTOR MODAL */}
      <Modal visible={isJobModalOpen} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, maxHeight: '80%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <View>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#1A1A1A' }}>Select Role</Text>
                <Text style={{ fontSize: 12, color: '#666666', marginTop: 2 }}>
                  Under {selectedCategory?.name}
                </Text>
              </View>
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
                  style={{
                    paddingVertical: 14,
                    paddingHorizontal: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: '#F3F4F6',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: selectedJob?.job_id === job.job_id ? '#EAF3EC' : 'transparent',
                    borderRadius: 10,
                    marginBottom: 4
                  }}
                >
                  <View>
                    <Text style={{ fontSize: 15, color: '#1A1A1A', fontWeight: selectedJob?.job_id === job.job_id ? '800' : '600' }}>
                      {job.job_name}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#10472B', fontWeight: '700', marginTop: 2 }}>
                      ₹{job.base_compensation} / hour
                    </Text>
                  </View>
                  {selectedJob?.job_id === job.job_id && (
                    <Ionicons name="checkmark-circle" size={18} color="#10472B" />
                  )}
                </TouchableOpacity>
              ))}
              {availableJobs.length === 0 && (
                <Text style={{ textAlign: 'center', color: '#6B7280', padding: 20 }}>No roles available for this category</Text>
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

      <Modal visible={showStatusModal} animationType="fade" transparent={true}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }} activeOpacity={1} onPress={() => {
              setShowStatusModal(false);
              if (statusModalContent.type === 'success') {
                onSuccess();
                onClose();
              }
        }}>
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, paddingLeft: 32, paddingRight: 32, width: '80%', alignItems: 'center', overflow: 'hidden' }} onStartShouldSetResponder={() => true}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: statusModalContent.type === 'success' ? '#DCFCE7' : '#FEF2F2', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Ionicons name={statusModalContent.type === 'success' ? "checkmark-circle" : "close-circle"} size={28} color={statusModalContent.type === 'success' ? "#15803D" : "#D32F2F"} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 12 }}>{statusModalContent.title}</Text>
            <Text style={{ fontSize: 15, color: '#4B5563', textAlign: 'center', lineHeight: 22, marginBottom: 24 }}>
              {statusModalContent.message}
            </Text>
            <TouchableOpacity onPress={() => {
              setShowStatusModal(false);
              if (statusModalContent.type === 'success') {
                onSuccess();
                onClose();
              }
            }} style={{ backgroundColor: '#F3F4F6', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, width: '100%', alignItems: 'center' }}>
              <Text style={{ color: '#4B5563', fontWeight: '600', fontSize: 15 }}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}
