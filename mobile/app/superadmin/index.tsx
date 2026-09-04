import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform, Modal, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiClient } from '../../src/api/client';

export default function SuperadminDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [requestsList, setRequestsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [expandedSections, setExpandedSections] = useState({
    pending: true,
    approved: false,
    declined: false
  });

  const [isDeclineModalOpen, setIsDeclineModalOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [jobToDecline, setJobToDecline] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [declineReasonsList, setDeclineReasonsList] = useState<{id: string, reason_text: string}[]>([]);

  const toggleSection = (section: 'pending' | 'approved' | 'declined') => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/superadmin/requests');
      if (res.data && res.data.requests) {
        setRequestsList(res.data.requests);
      }
    } catch (error) {
      console.error('Failed to fetch superadmin requests', error);
      Alert.alert('Error', 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  const fetchDeclineReasons = async () => {
    try {
      const res = await apiClient.get('/superadmin/decline-reasons');
      if (res.data && res.data.reasons) {
        setDeclineReasonsList(res.data.reasons);
      }
    } catch (error) {
      console.error('Failed to fetch decline reasons', error);
    }
  };

  useEffect(() => {
    fetchRequests();
    fetchDeclineReasons();
  }, []);

  const handleAction = async (requestId: string, action: 'approve' | 'reject', reason?: string) => {
    setProcessingId(requestId);
    try {
      const payload = action === 'reject' ? { decline_reason: reason || 'No reason provided' } : undefined;
      await apiClient.post(`/superadmin/requests/${requestId}/${action}`, payload);
      Alert.alert('Success', action === 'approve' ? 'Job has been published live.' : 'Job has been rejected.');
      if (action === 'reject') {
        setIsDeclineModalOpen(false);
        setIsDropdownOpen(false);
        setDeclineReason('');
        setJobToDecline(null);
      }
      await fetchRequests();
    } catch (error: any) {
      console.error(`Failed to ${action} request`, error);
      Alert.alert('Error', error.response?.data?.detail || `Failed to ${action} job.`);
    } finally {
      setProcessingId(null);
    }
  };

  const pendingJobs = requestsList.filter(job => job.approval_status === 'pending');
  const approvedJobs = requestsList.filter(job => job.approval_status === 'approved' || job.approval_status === 'confirmed');
  const declinedJobs = requestsList.filter(job => job.approval_status === 'declined' || job.approval_status === 'rejected');

  const renderJobCard = (job: any, isPending: boolean) => (
    <View key={job.request_id} style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#F3F4F6', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <Text style={{ fontWeight: '700', color: '#111827', fontSize: 16, flex: 1, marginRight: 8 }}>{job.job_name}</Text>
        <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: job.approval_status === 'pending' ? '#FEF3C7' : job.approval_status === 'declined' ? '#FEE2E2' : '#DCFCE7' }}>
          <Text style={{ fontSize: 11, fontWeight: '600', color: job.approval_status === 'pending' ? '#D97706' : job.approval_status === 'declined' ? '#DC2626' : '#15803D', textTransform: 'capitalize' }}>
            {job.approval_status}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        <Ionicons name="location-outline" size={14} color="#6B7280" style={{ marginRight: 4 }} />
        <Text style={{ color: '#6B7280', fontSize: 13, fontWeight: '500' }}>{job.store_name}</Text>
      </View>

      <View style={{ backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#6B7280', fontSize: 12, fontWeight: '500', marginBottom: 4 }}>Date</Text>
            <Text style={{ color: '#111827', fontWeight: '700', fontSize: 15 }}>{job.shift_date}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#6B7280', fontSize: 12, fontWeight: '500', marginBottom: 4 }}>Timing</Text>
            <Text style={{ color: '#111827', fontWeight: '700', fontSize: 15 }}>{job.start_time}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#6B7280', fontSize: 12, fontWeight: '500', marginBottom: 4 }}>Sahyogi's Needed</Text>
            <Text style={{ color: '#111827', fontWeight: '700', fontSize: 15 }}>{job.workers_needed}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#6B7280', fontSize: 12, fontWeight: '500', marginBottom: 4 }}>Compensation</Text>
            <Text style={{ color: '#10B981', fontWeight: '700', fontSize: 15 }}>₹{job.compensation}</Text>
          </View>
        </View>
      </View>

      {job.approval_status === 'declined' && job.decline_reason && (
        <View style={{ backgroundColor: '#FEF2F2', padding: 12, borderRadius: 8, marginBottom: 12 }}>
          <Text style={{ color: '#B91C1C', fontSize: 12, fontWeight: '600', marginBottom: 4 }}>Reason for Decline:</Text>
          <Text style={{ color: '#991B1B', fontSize: 14 }}>{job.decline_reason}</Text>
        </View>
      )}

      {isPending && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <TouchableOpacity
            onPress={() => handleAction(job.request_id, 'approve')}
            disabled={processingId === job.request_id}
            style={{ flex: 1, backgroundColor: '#059669', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginRight: 8, opacity: processingId === job.request_id ? 0.7 : 1 }}
          >
            {processingId === job.request_id ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>Publish Live</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setJobToDecline(job.request_id);
              setIsDeclineModalOpen(true);
            }}
            disabled={processingId === job.request_id}
            style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginLeft: 8, borderWidth: 1, borderColor: '#FCA5A5', opacity: processingId === job.request_id ? 0.7 : 1 }}
          >
            <Text style={{ color: '#D32F2F', fontWeight: '700', fontSize: 14 }}>Reject</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#10472B" />
        </View>
      ) : (
        <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }} contentContainerStyle={{ paddingBottom: 100 + insets.bottom }} showsVerticalScrollIndicator={false}>

          <TouchableOpacity onPress={() => toggleSection('pending')} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#10472B' }}>Pending Approval</Text>
              <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, marginLeft: 12 }}>
                <Text style={{ color: '#D97706', fontSize: 12, fontWeight: '700' }}>{pendingJobs.length}</Text>
              </View>
            </View>
            <Feather name={expandedSections.pending ? 'chevron-up' : 'chevron-down'} size={20} color="#6B7280" />
          </TouchableOpacity>

          {expandedSections.pending && (
            <View style={{ marginBottom: 16 }}>
              {pendingJobs.length === 0 ? (
                <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB' }}>
                  <Text style={{ color: '#6B7280', fontSize: 14 }}>No pending requests</Text>
                </View>
              ) : (
                pendingJobs.map(job => renderJobCard(job, true))
              )}
            </View>
          )}

          <TouchableOpacity onPress={() => toggleSection('approved')} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#10472B' }}>Approved Jobs</Text>
              <View style={{ backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, marginLeft: 12 }}>
                <Text style={{ color: '#15803D', fontSize: 12, fontWeight: '700' }}>{approvedJobs.length}</Text>
              </View>
            </View>
            <Feather name={expandedSections.approved ? 'chevron-up' : 'chevron-down'} size={20} color="#6B7280" />
          </TouchableOpacity>

          {expandedSections.approved && (
            <View style={{ marginBottom: 16 }}>
              {approvedJobs.length === 0 ? (
                <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB' }}>
                  <Text style={{ color: '#6B7280', fontSize: 14 }}>No approved jobs history</Text>
                </View>
              ) : (
                approvedJobs.map(job => renderJobCard(job, false))
              )}
            </View>
          )}

          <TouchableOpacity onPress={() => toggleSection('declined')} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#10472B' }}>Declined Jobs</Text>
              <View style={{ backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, marginLeft: 12 }}>
                <Text style={{ color: '#DC2626', fontSize: 12, fontWeight: '700' }}>{declinedJobs.length}</Text>
              </View>
            </View>
            <Feather name={expandedSections.declined ? 'chevron-up' : 'chevron-down'} size={20} color="#6B7280" />
          </TouchableOpacity>

          {expandedSections.declined && (
            <View style={{ marginBottom: 16 }}>
              {declinedJobs.length === 0 ? (
                <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB' }}>
                  <Text style={{ color: '#6B7280', fontSize: 14 }}>No declined jobs history</Text>
                </View>
              ) : (
                declinedJobs.map(job => renderJobCard(job, false))
              )}
            </View>
          )}

        </ScrollView>
      )}

      <Modal visible={isDeclineModalOpen} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#FFF', borderRadius: 16, padding: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 10 }}>Decline Request</Text>
            <Text style={{ color: '#6B7280', marginBottom: 16 }}>Please provide a reason for declining this request. This will be visible to the store manager.</Text>

            {/* Custom Dropdown */}
            <View style={{ marginBottom: 20, zIndex: 1000 }}>
              <TouchableOpacity
                onPress={() => setIsDropdownOpen(!isDropdownOpen)}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: '#F9FAFB',
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <Text style={{ color: declineReason ? '#111827' : '#9CA3AF', fontSize: 15 }}>
                  {declineReason || 'Select a reason'}
                </Text>
                <Feather name={isDropdownOpen ? 'chevron-up' : 'chevron-down'} size={20} color="#6B7280" />
              </TouchableOpacity>

              {isDropdownOpen && (
                <View style={{
                  backgroundColor: '#FFF',
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                  borderRadius: 12,
                  marginTop: 4,
                  maxHeight: 150
                }}>
                  <ScrollView nestedScrollEnabled={true}>
                    {declineReasonsList.map((reasonObj, index) => (
                      <TouchableOpacity
                        key={reasonObj.id}
                        style={{
                          padding: 12,
                          borderBottomWidth: index === declineReasonsList.length - 1 ? 0 : 1,
                          borderBottomColor: '#E5E7EB'
                        }}
                        onPress={() => {
                          setDeclineReason(reasonObj.reason_text);
                          setIsDropdownOpen(false);
                        }}
                      >
                        <Text style={{ color: '#111827', fontSize: 15 }}>{reasonObj.reason_text}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TouchableOpacity
                onPress={() => {
                  setIsDeclineModalOpen(false);
                  setIsDropdownOpen(false);
                  setDeclineReason('');
                  setJobToDecline(null);
                }}
                style={{ flex: 1, backgroundColor: '#F3F4F6', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginRight: 8 }}
              >
                <Text style={{ color: '#4B5563', fontWeight: '700', fontSize: 15 }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  if (!declineReason.trim()) {
                    Alert.alert('Required', 'Please enter a decline reason.');
                    return;
                  }
                  if (jobToDecline) {
                    handleAction(jobToDecline, 'reject', declineReason.trim());
                  }
                }}
                style={{ flex: 1, backgroundColor: '#D32F2F', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginLeft: 8 }}
              >
                <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>Reject Job</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}
