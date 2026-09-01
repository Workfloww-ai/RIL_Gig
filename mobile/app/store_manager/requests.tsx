import React, { useState, useEffect } from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, Modal, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../src/api/client';
import RaiseRequestModal from '../../src/components/RaiseRequestModal';

export default function StoreManagerRequestsScreen() {
  const router = useRouter();
  const [isRaiseModalOpen, setIsRaiseModalOpen] = useState(false);
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  
  const [managerStoreName, setManagerStoreName] = useState<string>('Loading store...');
  const [userProfile, setUserProfile] = useState<any>(null);

  // Request state
  const [requestsList, setRequestsList] = useState<any[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<Record<string, boolean>>({});

  const getWorkerStatusDisplay = (worker: any, minutesUntilShift: number, shiftHasStarted: boolean) => {
    if (worker.status === 'cancelled') return { label: '⚪ Cancelled', color: '#9CA3AF', showCancel: false };

    if (worker.arrival_status === 'arrived') return { label: '✅ Arrived', color: '#059669', showCancel: false };

    if (shiftHasStarted) {
      if (worker.arrival_status === 'pending') return { label: '🔴 No Show (Pending Arrival)', color: '#EF4444', showCancel: false };
    }
    
    // Instantly reflect missed checkpoints as cancelled before the cron job officially cancels them
    if (minutesUntilShift <= 90 && worker.t90_status === 'pending') {
      return { label: '⚪ Cancelled', color: '#9CA3AF', showCancel: false };
    }
    if (minutesUntilShift <= 60 && worker.t60_status === 'pending') {
      return { label: '⚪ Cancelled', color: '#9CA3AF', showCancel: false };
    }
    
    // If they are not cancelled, and T-60 or T-90 is confirmed, they are Enroute.
    if (worker.t60_status === 'confirmed' || worker.t90_status === 'confirmed') {
      return { label: '🟢 Enroute', color: '#10B981', showCancel: false };
    }
    
    return { label: '⚪ Pending', color: '#6B7280', showCancel: false };
  };

  // Fetch available jobs and manager requests on mount
  const fetchRequests = async () => {
    try {
      const profileRes = await apiClient.get('/auth/me').catch(() => null);
      if (profileRes?.data) setUserProfile(profileRes.data);

      const res = await apiClient.get('/jobs/manager/requests');
      if (res.data) {
        if (res.data.requests) {
          const sortedRequests = [...res.data.requests].sort((a: any, b: any) => {
            const dateA = new Date(a.shift_date || 0).getTime();
            const dateB = new Date(b.shift_date || 0).getTime();
            return dateB - dateA;
          });
          setRequestsList(sortedRequests);
        }
        if (res.data.store_name) setManagerStoreName(res.data.store_name);
        else setManagerStoreName('Unassigned Store');
      }
    } catch (error) {
      console.error('Failed to fetch manager requests', error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      await fetchRequests();
    };
    fetchData();
  }, []);



  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F8F9' }}>
      {/* Top Bar Header */}
      <View style={{ backgroundColor: '#10472B', paddingHorizontal: 20, paddingTop: 40, paddingBottom: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <TouchableOpacity onPress={() => router.push('/store_manager')} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 18, marginLeft: 8 }}>My Requests</Text>
        </TouchableOpacity>

        {userProfile?.role_name !== 'supervisor' && (
          <TouchableOpacity
            onPress={() => setIsRaiseModalOpen(true)}
            style={{ backgroundColor: '#E31B23', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, flexDirection: 'row', alignItems: 'center' }}
          >
            <Ionicons name="add-outline" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 12 }}>New Request</Text>
          </TouchableOpacity>
        )}
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
                  backgroundColor: job.request_status?.toLowerCase() === 'open' ? '#DCFCE7' : '#FEE2E2',
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: job.request_status?.toLowerCase() === 'open' ? '#15803D' : '#B91C1C', textTransform: 'capitalize' }}>
                  {job.request_status || 'Open'}
                </Text>
              </View>
            </View>

            <Text style={{ color: '#666666', fontSize: 13, fontWeight: '500', marginBottom: 14 }}>
              {job.shift_date} • {job.start_time}
            </Text>

            {job.request_status?.toLowerCase() === 'open' && job.accepted_workers && job.accepted_workers.some((w: any) => w.status === 'cancelled') && !dismissedAlerts[job.request_id || job.id] && (
              <View style={{ marginBottom: 14, backgroundColor: '#FFFBEB', padding: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, borderColor: '#FEF3C7', borderLeftWidth: 4, borderLeftColor: '#F59E0B', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}>
                <Ionicons name="alert-circle" size={20} color="#D97706" style={{ marginRight: 10, marginTop: 2 }} />
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#92400E', marginBottom: 4 }}>Replacement in progress</Text>
                  <Text style={{ fontSize: 12, fontWeight: '500', color: '#B45309', lineHeight: 18 }}>A worker missed their check-in. We are automatically assigning a new replacement ASAP.</Text>
                </View>
                <TouchableOpacity onPress={() => setDismissedAlerts(prev => ({...prev, [job.request_id || job.id]: true}))} style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginTop: 2 }}>
                  <Text style={{ color: '#D97706', fontWeight: '700', fontSize: 11 }}>Got it</Text>
                </TouchableOpacity>
              </View>
            )}

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

      <RaiseRequestModal 
        visible={isRaiseModalOpen} 
        onClose={() => setIsRaiseModalOpen(false)} 
        onSuccess={fetchRequests} 
        managerStoreName={managerStoreName} 
      />
    </SafeAreaView>
  );
}
