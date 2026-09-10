import React, { useEffect, useState } from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, Image, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { apiClient } from '../src/api/client';
import { useAuthStore } from '../src/store/authStore';
import { Watermark } from '../src/components/Watermark';

export default function ProfileScreen() {
  const router = useRouter();
  const logout = useAuthStore(state => state.logout);
  const [userProfile, setUserProfile] = useState<{ first_name: string, last_name: string, ratings?: number, shifts_completed?: number, recent_activity?: any[] } | null>(null);

  const handleLogout = () => {
    logout();
    router.replace('/');
  };
  const [loading, setLoading] = useState(true);

  // Account Deletion States
  const [showDeleteReasonModal, setShowDeleteReasonModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [showDeleteSuccessModal, setShowDeleteSuccessModal] = useState(false);
  const [selectedDeleteReason, setSelectedDeleteReason] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const deleteReasons = [
    "Not using the app anymore",
    "Found another job",
    "Privacy concerns",
    "Other"
  ];

  const handleDeleteRequest = async () => {
    if (!selectedDeleteReason) return;
    setIsDeleting(true);
    try {
      await apiClient.post('/auth/delete-account', { reason: selectedDeleteReason });
      setShowDeleteConfirmModal(false);
      setShowDeleteSuccessModal(true);
    } catch (err) {
      console.error('Failed to delete account', err);
      // Assuming a generic error for now
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await apiClient.get('/auth/me');
        setUserProfile(res.data);
      } catch (err) {
        console.error('Failed to load profile', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-sand pt-8 items-center justify-center">
        <ActivityIndicator size="large" color="#10472B" />
      </SafeAreaView>
    );
  }

  const fullName = userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : 'Student Name';
  const initial = userProfile?.first_name?.charAt(0).toUpperCase() || 'S';
  const totalEarnings = userProfile?.recent_activity?.reduce((sum: number, act: any) => sum + (act.amount || 0), 0) || 0;

  return (
    <Watermark>
      <SafeAreaView className="flex-1 bg-transparent pt-8">
        {/* Header */}
        <View className="bg-cream px-6 py-4 flex-row items-center shadow-sm z-10 pb-6" style={{ position: 'relative' }}>
          <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center bg-sage/10 rounded-full mr-3">
            <Feather name="arrow-left" size={20} color="#666666" />
          </TouchableOpacity>
          <Text className="font-bold text-slate text-lg flex-1 text-center">My Profile</Text>
          <Image
            source={require('../assets/images/newlogo.png')}
            style={{ width: 60, height: 60, resizeMode: 'contain' }}
          />
          {/* Decorative Brand Line - Absolute Bottom */}
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 6, flexDirection: 'row' }}>
            <View style={{ flex: 1, backgroundColor: '#0B5B31' }} />
            <View style={{ width: 0, height: 0, borderTopWidth: 6, borderTopColor: '#0B5B31', borderRightWidth: 6, borderRightColor: 'transparent', marginLeft: -1 }} />
            <View style={{ width: 4, height: 6, backgroundColor: 'transparent' }} />
            <View style={{ width: 0, height: 0, borderBottomWidth: 6, borderBottomColor: '#D32F2F', borderLeftWidth: 6, borderLeftColor: 'transparent', marginRight: -1 }} />
            <View style={{ flex: 1, backgroundColor: '#D32F2F' }} />
          </View>
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Profile Info Card */}
          <View className="bg-cream mx-5 mt-6 rounded-3xl p-6 shadow-sm border border-sage/10 items-center">
            <View className="h-24 w-24 rounded-full bg-moss/10 items-center justify-center border-4 border-moss/10 mb-4 shadow-sm">
              <Text className="text-moss text-4xl font-bold">{initial}</Text>
            </View>

            <Text className="text-2xl font-bold text-slate mb-1">{fullName.toUpperCase()}</Text>
            <Text className="text-muted text-sm font-medium mb-3">SahYogi</Text>

            {/* Dynamic Rating */}
            {userProfile?.shifts_completed ? (
              <>
                <View className="flex-row items-center bg-sand px-4 py-2 rounded-full border border-sage/10">
                  <Text className="text-sage mr-2 text-lg">
                    {'⭐'.repeat(userProfile?.ratings || 0)}
                  </Text>
                  <Text className="text-slate font-bold">{userProfile?.ratings ? `${userProfile.ratings}.0` : '0.0'}</Text>
                </View>
                <Text className="text-sage text-xs mt-2">Rated by Store Managers</Text>
              </>
            ) : (
              <View className="bg-sand px-4 py-2 rounded-full border border-sage/10 mt-1">
                <Text className="text-muted font-medium text-sm">Complete a shift to get ratings</Text>
              </View>
            )}
          </View>

          {/* Stats Grid */}
          <View className="mx-5 mt-6 flex-row justify-between">
            <View className="bg-cream flex-1 mr-2 rounded-3xl p-5 shadow-sm border border-sage/10 items-center justify-center">
              <View className="w-10 h-10 rounded-full bg-moss/5 items-center justify-center mb-3">
                <Text className="text-moss/80 text-xl">💰</Text>
              </View>
              <Text className="text-sage text-xs font-bold tracking-widest uppercase mb-1 text-center">Total Earnings</Text>
              <Text className="text-2xl font-bold text-slate text-center">₹ {totalEarnings.toLocaleString()}</Text>
            </View>

            <View className="bg-cream flex-1 ml-2 rounded-3xl p-5 shadow-sm border border-sage/10 items-center justify-center">
              <View className="w-10 h-10 rounded-full bg-moss/10 items-center justify-center mb-3">
                <Text className="text-moss/80 text-xl">📋</Text>
              </View>
              <Text className="text-sage text-xs font-bold tracking-widest uppercase mb-1 text-center">Shifts Completed</Text>
              <Text className="text-2xl font-bold text-slate text-center">{userProfile?.shifts_completed || 0}</Text>
            </View>
          </View>

          {/* Recent Activity */}
          <View className="mx-5 mt-8 mb-10">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-lg font-bold text-slate">Recent Activity</Text>
              <TouchableOpacity onPress={() => router.push('/payments')}>
                <Text className="text-moss font-bold">View all</Text>
              </TouchableOpacity>
            </View>

            {userProfile?.recent_activity && userProfile.recent_activity.length > 0 ? (
              userProfile.recent_activity.slice(0, 3).map((activity, index) => {
                const date = new Date(activity.shift_date || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                return (
                  <View key={index} className="bg-cream rounded-3xl p-5 mb-4 shadow-sm border border-sage/10">
                    <View className="flex-row items-center">
                      <View className={`w-12 h-12 rounded-full items-center justify-center mr-4 ${activity.payment_status === 'processed' ? 'bg-moss/10' : 'bg-sage/10'}`}>
                        {activity.payment_status === 'processed' ? (
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
                      <View className="items-end">
                        <Text className="font-bold text-moss text-lg">+₹{activity.amount?.toLocaleString() || 0}</Text>
                        <Text className="text-sage text-[10px]">{date}</Text>
                      </View>
                    </View>
                  </View>
                );
              })
            ) : (
              <View className="bg-cream rounded-3xl p-5 shadow-sm border border-sage/10 items-center justify-center">
                <Text className="text-sage py-2">No recent activity available</Text>
              </View>
            )}
          </View>

          {/* Logout Button */}
          <View className="mx-5 mb-10 mt-6">
            <TouchableOpacity
              onPress={handleLogout}
              className="bg-red-50 py-4 rounded-3xl items-center border border-red-100 flex-row justify-center shadow-sm"
              activeOpacity={0.85}
            >
              <Text className="text-red-600 font-bold text-lg mr-2">Logout</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowDeleteReasonModal(true)}
              className="py-4 mt-4 items-center justify-center"
              activeOpacity={0.85}
            >
              <Text className="text-red-400 font-bold text-sm">Delete Account</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Delete Reason Modal */}
      <Modal visible={showDeleteReasonModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: '#1A1A1A', marginBottom: 16 }}>Why are you deleting?</Text>
            {deleteReasons.map((reason, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => setSelectedDeleteReason(reason)}
                style={{
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: selectedDeleteReason === reason ? '#D32F2F' : '#E5E7EB',
                  backgroundColor: selectedDeleteReason === reason ? '#FEF2F2' : '#FFFFFF',
                  marginBottom: 10
                }}
              >
                <Text style={{ fontSize: 16, color: selectedDeleteReason === reason ? '#D32F2F' : '#4B5563', fontWeight: selectedDeleteReason === reason ? '700' : '500' }}>
                  {reason}
                </Text>
              </TouchableOpacity>
            ))}
            <View style={{ flexDirection: 'row', marginTop: 12, gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center' }}
                onPress={() => setShowDeleteReasonModal(false)}
              >
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#4B5563' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: selectedDeleteReason ? '#D32F2F' : '#FCA5A5', alignItems: 'center' }}
                disabled={!selectedDeleteReason}
                onPress={() => {
                  setShowDeleteReasonModal(false);
                  setShowDeleteConfirmModal(true);
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal visible={showDeleteConfirmModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, width: '100%', alignItems: 'center' }}>
            <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Feather name="alert-triangle" size={30} color="#D32F2F" />
            </View>
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#1A1A1A', marginBottom: 12, textAlign: 'center' }}>Are you sure?</Text>
            <Text style={{ fontSize: 15, color: '#4B5563', textAlign: 'center', lineHeight: 22, marginBottom: 24 }}>
              Your account will be deactivated immediately and permanently deleted after 30 days. This action cannot be undone.
            </Text>

            <TouchableOpacity
              onPress={handleDeleteRequest}
              disabled={isDeleting}
              style={{ width: '100%', backgroundColor: '#D32F2F', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 12 }}
            >
              {isDeleting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>Yes, Deactivate Account</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowDeleteConfirmModal(false)}
              disabled={isDeleting}
              style={{ width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: 'center' }}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#4B5563' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete Success Modal */}
      <Modal visible={showDeleteSuccessModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, width: '100%', alignItems: 'center' }}>
            <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Feather name="check" size={30} color="#15803D" />
            </View>
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#1A1A1A', marginBottom: 12, textAlign: 'center' }}>Account Deactivated</Text>
            <Text style={{ fontSize: 15, color: '#4B5563', textAlign: 'center', lineHeight: 22, marginBottom: 24 }}>
              Your account is now deactivated. It will be permanently deleted with all data after 30 days. You can reactivate it before then by contacting support.
            </Text>

            <TouchableOpacity
              onPress={() => {
                setShowDeleteSuccessModal(false);
                handleLogout();
              }}
              style={{ width: '100%', backgroundColor: '#0B5B31', paddingVertical: 14, borderRadius: 12, alignItems: 'center' }}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>Okay, Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Watermark>
  );
}
