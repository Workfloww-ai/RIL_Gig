import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { apiClient } from '../../src/api/client';
import StatusModal from '../../src/components/StatusModal';

export default function SuperadminDeletionsScreen() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [statusModalConfig, setStatusModalConfig] = useState({ title: '', message: '', isError: false });

  const fetchRequests = async () => {
    try {
      const res = await apiClient.get('/superadmin/deletion-requests');
      if (res.data && res.data.data) {
        setRequests(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch deletion requests', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRequests();
  };

  const handlePermanentDelete = (userId: string) => {
    Alert.alert(
      "Permanent Delete",
      "Are you sure? This action will permanently erase the user and all their data from the database.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete Permanently", 
          style: "destructive",
          onPress: async () => {
            try {
              await apiClient.post(`/superadmin/deletion-requests/${userId}/permanent-delete`);
              setStatusModalConfig({
                title: 'Success',
                message: 'User permanently deleted from the database.',
                isError: false
              });
              setStatusModalVisible(true);
              fetchRequests();
            } catch (err: any) {
              setStatusModalConfig({
                title: 'Error',
                message: err.response?.data?.detail || 'Failed to delete user.',
                isError: true
              });
              setStatusModalVisible(true);
            }
          }
        }
      ]
    );
  };

  const sortedRequests = [...requests].sort((a, b) => {
    const aDate = new Date(a.requested_at);
    const bDate = new Date(b.requested_at);
    const now = new Date();
    
    const aIsReady = (now.getTime() - aDate.getTime()) > 30 * 24 * 60 * 60 * 1000;
    const bIsReady = (now.getTime() - bDate.getTime()) > 30 * 24 * 60 * 60 * 1000;
    
    if (aIsReady && !bIsReady) return -1;
    if (!aIsReady && bIsReady) return 1;
    return aDate.getTime() - bDate.getTime();
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0B5B31" />}
      >
        <Text style={{ fontSize: 24, fontWeight: '800', color: '#1A1A1A', marginBottom: 20 }}>Account Deletions</Text>
        
        {loading ? (
          <ActivityIndicator size="large" color="#0B5B31" style={{ marginTop: 40 }} />
        ) : sortedRequests.length === 0 ? (
          <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 40 }}>
            <Feather name="inbox" size={48} color="#D1D5DB" />
            <Text style={{ fontSize: 16, color: '#6B7280', marginTop: 12 }}>No deletion requests</Text>
          </View>
        ) : (
          sortedRequests.map((req, index) => {
            const reqDate = new Date(req.requested_at);
            const now = new Date();
            const daysPassed = Math.floor((now.getTime() - reqDate.getTime()) / (1000 * 60 * 60 * 24));
            const isReadyForDelete = daysPassed >= 30;
            
            return (
              <View key={req.id || index} style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: '#1A1A1A' }}>{req.first_name} {req.last_name}</Text>
                    <Text style={{ fontSize: 14, color: '#4B5563', marginTop: 4 }}>{req.mobile_number}</Text>
                  </View>
                  <View style={{ backgroundColor: isReadyForDelete ? '#FEF2F2' : '#FFFBEB', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: isReadyForDelete ? '#D32F2F' : '#B45309' }}>
                      {isReadyForDelete ? 'Ready for Deletion' : `${30 - daysPassed} days left`}
                    </Text>
                  </View>
                </View>
                
                <View style={{ backgroundColor: '#F9FAFB', padding: 12, borderRadius: 8, marginBottom: 16 }}>
                  <Text style={{ fontSize: 12, color: '#6B7280', fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Reason</Text>
                  <Text style={{ fontSize: 14, color: '#1A1A1A' }}>{req.reason}</Text>
                  <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 8 }}>Requested on: {reqDate.toLocaleDateString()}</Text>
                </View>
                
                {isReadyForDelete && (
                  <TouchableOpacity
                    onPress={() => handlePermanentDelete(req.user_id)}
                    style={{ backgroundColor: '#D32F2F', paddingVertical: 12, borderRadius: 8, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}
                  >
                    <Feather name="trash-2" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>Permanently Delete</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      <StatusModal
        visible={statusModalVisible}
        title={statusModalConfig.title}
        message={statusModalConfig.message}
        isError={statusModalConfig.isError}
        onClose={() => setStatusModalVisible(false)}
      />
    </View>
  );
}
