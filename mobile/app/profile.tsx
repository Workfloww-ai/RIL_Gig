import React, { useEffect, useState } from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, Image, Modal, Linking, LayoutAnimation } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { apiClient } from '../src/api/client';
import { useAuthStore } from '../src/store/authStore';
import { Watermark } from '../src/components/Watermark';
import IDBadge from '../src/components/IDBadge';

export default function ProfileScreen() {
  const router = useRouter();
  const logout = useAuthStore(state => state.logout);
  const [userProfile, setUserProfile] = useState<{ first_name: string, last_name: string, ratings?: number, shifts_completed?: number, recent_activity?: any[] } | null>(null);
  const [showIdCard, setShowIdCard] = useState(false);

  const handleLogout = () => {
    logout();
    router.replace('/');
  };
  const [loading, setLoading] = useState(true);

  // Account Deletion States
  const [showDeleteReasonModal, setShowDeleteReasonModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [showDeleteSuccessModal, setShowDeleteSuccessModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
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

  const FAQS = [
    { question: "How do I start getting jobs?", answer: "After completing your mandatory training modules in the Library, you will start seeing available jobs posted by Store Managers in your area." },
    { question: "What do the different job statuses mean?", answer: "'Available' means you can accept it. 'Accepted' means you are scheduled for it. 'Completed' means you finished the shift and are awaiting payment." },
    { question: "How are ratings and feedback calculated?", answer: "After every completed shift, the Store Manager will rate your performance. Maintaining a high average rating increases your chances of getting more shifts." },
    { question: "What happens if I miss the T45 or T90 checkpoints?", answer: "T45 and T90 are mandatory check-ins during your shift. Missing them cancels your shift and reopens the job in Job pool for replacement." },
    { question: "What is a 'No Show'?", answer: "A 'No Show' is when you accept a job but fail to arrive at the store without prior cancellation. Repeated No Shows will lead to account deactivation." }
  ];

  const toggleFaq = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedFaq(expandedFaq === index ? null : index);
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
            <TouchableOpacity 
              onPress={() => setShowIdCard(true)}
              className="h-24 w-24 rounded-full bg-[#FEF2F2] items-center justify-center border-4 border-[#0B5B31] mb-4 shadow-sm"
              activeOpacity={0.8}
            >
              <Text className="text-[#D32F2F] text-4xl font-bold">{initial}</Text>
            </TouchableOpacity>

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

          {/* Action Buttons */}
          <View className="mx-5 mb-10 mt-6">
            <TouchableOpacity
              onPress={() => setShowSupportModal(true)}
              className="bg-cream py-4 rounded-3xl items-center flex-row justify-center shadow-sm border border-sage/20 mb-4"
              activeOpacity={0.85}
            >
              <Feather name="help-circle" size={20} color="#0B5B31" className="mr-2" />
              <Text className="text-moss font-bold text-lg ml-2">Help & Support</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleLogout}
              className="bg-[#D32F2F] py-4 rounded-3xl items-center flex-row justify-center shadow-sm"
              activeOpacity={0.85}
            >
              <Text className="text-white font-bold text-lg mr-2">Logout</Text>
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

      {/* Help & Support Modal */}
      <Modal visible={showSupportModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#F9FAFB', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' }}>
            
            {/* Modal Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#1A1A1A' }}>Help & Support</Text>
              <TouchableOpacity onPress={() => setShowSupportModal(false)} style={{ padding: 4, backgroundColor: '#F3F4F6', borderRadius: 20 }}>
                <Feather name="x" size={20} color="#4B5563" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#4B5563', marginBottom: 16 }}>Frequently Asked Questions</Text>
              
              {FAQS.map((faq, index) => (
                <View key={index} style={{ backgroundColor: '#FFFFFF', borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' }}>
                  <TouchableOpacity
                    onPress={() => toggleFaq(index)}
                    style={{ padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#1F2937', flex: 1, paddingRight: 12 }}>{faq.question}</Text>
                    <Feather name={expandedFaq === index ? "chevron-up" : "chevron-down"} size={20} color="#9CA3AF" />
                  </TouchableOpacity>
                  
                  {expandedFaq === index && (
                    <View style={{ padding: 16, paddingTop: 0, backgroundColor: '#FFFFFF' }}>
                      <Text style={{ fontSize: 14, color: '#4B5563', lineHeight: 22 }}>{faq.answer}</Text>
                    </View>
                  )}
                </View>
              ))}

              <View style={{ marginTop: 32, padding: 20, backgroundColor: '#FFFFFF', borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 }}>
                <View style={{ width: 48, height: 48, backgroundColor: '#FEF2F2', borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Feather name="phone-call" size={24} color="#D32F2F" />
                </View>
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 }}>Still need help?</Text>
                <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 20 }}>If your query is not resolved, please contact our support team directly.</Text>
                
                <TouchableOpacity
                  onPress={() => Linking.openURL('whatsapp://send?phone=+919211540400')}
                  style={{ backgroundColor: '#D32F2F', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'center' }}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>Contact Support</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
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
      {userProfile && (
        <IDBadge 
          visible={showIdCard} 
          onClose={() => setShowIdCard(false)} 
          user={userProfile} 
        />
      )}
    </Watermark>
  );
}
