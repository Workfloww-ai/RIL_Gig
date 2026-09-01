import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiClient } from '../../src/api/client';

export default function SuperadminDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [requestsList, setRequestsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/superadmin/requests');
      if (res.data && res.data.requests) {
        setRequestsList(res.data.requests);
      }
    } catch (error) {
      console.error('Failed to fetch superadmin requests', error);
      Alert.alert('Error', 'Failed to load pending requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleAction = async (requestId: string, action: 'approve' | 'reject') => {
    setProcessingId(requestId);
    try {
      await apiClient.post(`/superadmin/requests/${requestId}/${action}`);
      Alert.alert('Success', action === 'approve' ? 'Job has been published live.' : 'Job has been rejected.');
      // Refresh list
      await fetchRequests();
    } catch (error: any) {
      console.error(`Failed to ${action} request`, error);
      Alert.alert('Error', error.response?.data?.detail || `Failed to ${action} job.`);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#10472B" />
        </View>
      ) : (
        <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }} contentContainerStyle={{ paddingBottom: 100 + insets.bottom }} showsVerticalScrollIndicator={false}>
          {requestsList.length === 0 ? (
            <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#F3F4F6', marginTop: 40 }}>
              <Ionicons name="checkmark-circle-outline" size={48} color="#10B981" style={{ marginBottom: 12 }} />
              <Text style={{ color: '#111827', fontSize: 18, fontWeight: '700', marginBottom: 6 }}>All Caught Up!</Text>
              <Text style={{ color: '#6B7280', fontSize: 14, textAlign: 'center' }}>There are no pending job requests to approve at the moment.</Text>
            </View>
          ) : (
            requestsList.map((job) => (
              <View key={job.request_id} style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#F3F4F6', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 }}>
                
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <Text style={{ fontWeight: '700', color: '#111827', fontSize: 16, flex: 1, marginRight: 8 }}>{job.job_name}</Text>
                  <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: '#FEF3C7' }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#D97706' }}>Pending Approval</Text>
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
                      <Text style={{ color: '#6B7280', fontSize: 12, fontWeight: '500', marginBottom: 4 }}>Workers Needed</Text>
                      <Text style={{ color: '#111827', fontWeight: '700', fontSize: 15 }}>{job.workers_needed}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#6B7280', fontSize: 12, fontWeight: '500', marginBottom: 4 }}>Compensation</Text>
                      <Text style={{ color: '#10B981', fontWeight: '700', fontSize: 15 }}>₹{job.compensation}</Text>
                    </View>
                  </View>
                </View>

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
                    onPress={() => handleAction(job.request_id, 'reject')}
                    disabled={processingId === job.request_id}
                    style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginLeft: 8, borderWidth: 1, borderColor: '#FCA5A5', opacity: processingId === job.request_id ? 0.7 : 1 }}
                  >
                    <Text style={{ color: '#D32F2F', fontWeight: '700', fontSize: 14 }}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}
