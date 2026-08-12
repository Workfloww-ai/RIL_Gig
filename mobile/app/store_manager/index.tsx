import React, { useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Image,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/authStore';

// Data Interfaces
interface AcceptanceStatus {
  timeLabel: string;
  expectedTime: string;
  status: 'DONE' | 'IN_PROGRESS' | 'PENDING';
  completedTime?: string;
}

interface AcceptedWorker {
  id: string;
  name: string;
  role: string;
  avatarUrl?: string;
  status: 'Review Pending' | 'En Route' | 'On Site' | 'Confirmed' | 'Completed';
  etaText?: string;
  acceptances: {
    t90: AcceptanceStatus;
    t60: AcceptanceStatus;
    onArrival: AcceptanceStatus;
  };
  rating?: {
    score: number;
    tags: string[];
    feedback?: string;
  };
}

interface JobRequest {
  id: string;
  title: string;
  shiftTime: string;
  status: 'Pending Approval' | 'Active' | 'Filled' | 'Completed';
  workersNeeded: number;
  workersFilled: number;
  compensation: number;
  acceptedWorkers: AcceptedWorker[];
}

export default function StoreManagerDashboard() {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);

  // Navigation tab state: ONLY 'home' | 'requests' | 'profile' (Insights removed per request)
  const [activeTab, setActiveTab] = useState<'home' | 'requests' | 'profile'>('home');

  // Modal States
  const [isRaiseModalOpen, setIsRaiseModalOpen] = useState(false);
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<AcceptedWorker | null>(null);

  // Rating Form State
  const [ratingScore, setRatingScore] = useState<number>(5);
  const [selectedTags, setSelectedTags] = useState<string[]>(['On-Time Arrival', 'High Efficiency']);
  const [feedbackText, setFeedbackText] = useState<string>('');

  // Raise Request Form State
  const [requestStore] = useState('Reliance Smart – Phoenix Marketcity');
  const [requestDate, setRequestDate] = useState('12/08/2026');
  const [requestRole, setRequestRole] = useState('Inventory Restocking Associate');
  const [requestStartTime, setRequestStartTime] = useState('02:00 PM');
  const [requestHours, setRequestHours] = useState('4');
  const [requestNumWorkers, setRequestNumWorkers] = useState('2');
  const [requestCompensation, setRequestCompensation] = useState('800');

  // Job data state
  const [jobsList, setJobsList] = useState<JobRequest[]>([
    {
      id: 'job-1',
      title: 'Inventory Restocking Associate',
      shiftTime: 'Today • 2:00 PM to 6:00 PM',
      status: 'Active',
      workersNeeded: 2,
      workersFilled: 1,
      compensation: 800,
      acceptedWorkers: [
        {
          id: 'w-1',
          name: 'Monalika Goel',
          role: 'Inventory Restocking',
          status: 'Review Pending',
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
          acceptances: {
            t90: {
              timeLabel: '90 Mins Before',
              expectedTime: '12:30 PM',
              status: 'DONE',
              completedTime: '12:30 PM',
            },
            t60: {
              timeLabel: '60 Mins Before',
              expectedTime: '01:00 PM',
              status: 'DONE',
              completedTime: '01:02 PM',
            },
            onArrival: {
              timeLabel: 'On Arrival',
              expectedTime: '01:55 PM',
              status: 'DONE',
              completedTime: '01:55 PM',
            },
          },
        },
      ],
    },
    {
      id: 'job-2',
      title: 'Morning Display Setup',
      shiftTime: 'Today • 8:00 AM to 12:00 PM',
      status: 'Active',
      workersNeeded: 1,
      workersFilled: 1,
      compensation: 600,
      acceptedWorkers: [
        {
          id: 'w-2',
          name: 'Priya',
          role: 'Morning Display Setup',
          status: 'En Route',
          etaText: 'Arriving in 15 mins',
          avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
          acceptances: {
            t90: {
              timeLabel: '90 Mins Before',
              expectedTime: '06:30 AM',
              status: 'DONE',
              completedTime: '06:28 AM',
            },
            t60: {
              timeLabel: '60 Mins Before',
              expectedTime: '07:00 AM',
              status: 'DONE',
              completedTime: '07:00 AM',
            },
            onArrival: {
              timeLabel: 'On Arrival',
              expectedTime: '07:45 AM',
              status: 'IN_PROGRESS',
            },
          },
        },
      ],
    },
  ]);

  // Handle open rating modal
  const handleOpenRating = (worker: AcceptedWorker) => {
    setSelectedWorker(worker);
    setRatingScore(worker.rating?.score || 5);
    setSelectedTags(worker.rating?.tags || ['On-Time Arrival', 'High Efficiency']);
    setFeedbackText(worker.rating?.feedback || '');
    setIsRatingModalOpen(true);
  };

  // Submit Rating
  const handleSubmitRating = () => {
    if (!selectedWorker) return;

    setJobsList((prevJobs) =>
      prevJobs.map((job) => ({
        ...job,
        acceptedWorkers: job.acceptedWorkers.map((w) => {
          if (w.id === selectedWorker.id) {
            return {
              ...w,
              status: 'Completed',
              rating: {
                score: ratingScore,
                tags: selectedTags,
                feedback: feedbackText,
              },
            };
          }
          return w;
        }),
      }))
    );

    setIsRatingModalOpen(false);
    setSelectedWorker(null);
    Alert.alert('Rating Submitted', 'Thank you! The worker performance has been rated and shift payout is approved.');
  };

  // Toggle feedback tags
  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  // Create new manpower request
  const handlePublishRequest = () => {
    if (!requestRole || !requestStartTime) {
      Alert.alert('Missing Details', 'Please fill in all required job request fields.');
      return;
    }

    const newJob: JobRequest = {
      id: `job-${Date.now()}`,
      title: requestRole,
      shiftTime: `Today • ${requestStartTime}`,
      status: 'Pending Approval',
      workersNeeded: parseInt(requestNumWorkers) || 1,
      workersFilled: 0,
      compensation: parseInt(requestCompensation) || 800,
      acceptedWorkers: [],
    };

    setJobsList([newJob, ...jobsList]);
    setIsRaiseModalOpen(false);
    Alert.alert('Request Published', 'Your manpower request has been successfully published to the worker pool!');
  };

  const handleLogout = () => {
    if (logout) logout();
    router.replace('/');
  };

  // Active & Pending Review Counts
  const activeWorkersCount = jobsList.reduce(
    (acc, job) => acc + job.acceptedWorkers.filter((w) => w.status === 'En Route' || w.status === 'On Site' || w.status === 'Confirmed').length,
    0
  );
  const pendingReviewCount = jobsList.reduce(
    (acc, job) => acc + job.acceptedWorkers.filter((w) => w.status === 'Review Pending').length,
    0
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F8F9' }}>
      {/* ==================== 1. TOP HEADER (Forest Green #10472B background with Red accent button) ==================== */}
      {activeTab !== 'profile' ? (
        <View style={{ backgroundColor: '#10472B', borderBottomLeftRadius: 28, borderBottomRightRadius: 28, paddingTop: 40, paddingBottom: 24, paddingHorizontal: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontSize: 24, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.5 }}>Hi, Rajesh Kumar</Text>
              <Text style={{ fontSize: 13, color: '#E1EBE5', fontWeight: '500', marginTop: 2 }}>Reliance Smart – Phoenix Marketcity</Text>
            </View>
            <TouchableOpacity
              onPress={handleLogout}
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>Sign Out</Text>
            </TouchableOpacity>
          </View>

          {/* Dual Metrics Box */}
          <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.12)', borderRadius: 20, padding: 16, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)', marginTop: 20 }}>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Ionicons name="people-outline" size={22} color="#FFFFFF" />
              <Text style={{ fontSize: 24, fontWeight: '700', color: '#FFFFFF', marginTop: 4 }}>{activeWorkersCount || 1}</Text>
              <Text style={{ fontSize: 12, color: '#E1EBE5', fontWeight: '500' }}>Active</Text>
            </View>

            <View style={{ width: 1, height: 36, backgroundColor: 'rgba(255, 255, 255, 0.25)' }} />

            <View style={{ alignItems: 'center', flex: 1 }}>
              <Ionicons name="checkmark-circle-outline" size={22} color="#FFFFFF" />
              <Text style={{ fontSize: 24, fontWeight: '700', color: '#FFFFFF', marginTop: 4 }}>{pendingReviewCount || 1}</Text>
              <Text style={{ fontSize: 12, color: '#E1EBE5', fontWeight: '500' }}>Pending Review</Text>
            </View>
          </View>
        </View>
      ) : (
        /* Top Bar for Profile Screen (Matching Worker Profile Header) */
        <View style={{ backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#1A1A1A', flex: 1, textAlign: 'center' }}>Manager Profile</Text>
        </View>
      )}

      {/* ==================== 2. MAIN SCROLLABLE BODY CONTENT ==================== */}
      <ScrollView style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        
        {/* ==================== HOME TAB ==================== */}
        {activeTab === 'home' && (
          <View>
            {/* Section Title + Primary Red Raise Request Button */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#1A1A1A', letterSpacing: -0.3 }}>Today's Gig Workers</Text>
              <TouchableOpacity
                onPress={() => setIsRaiseModalOpen(true)}
                style={{ backgroundColor: '#E31B23', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, flexDirection: 'row', alignItems: 'center' }}
                activeOpacity={0.85}
              >
                <Ionicons name="add" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 12 }}>+ Raise Request</Text>
              </TouchableOpacity>
            </View>

            {/* List of Jobs & Accepted Workers */}
            {jobsList.map((job) => (
              <View key={job.id} style={{ marginBottom: 16 }}>
                {job.acceptedWorkers.map((worker) => (
                  <View
                    key={worker.id}
                    style={{ backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 }}
                  >
                    {/* Worker Info */}
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 48, height: 48, borderRadius: 24, overflow: 'hidden', backgroundColor: '#E1EBE5', alignItems: 'center', justify: 'center', marginRight: 12, borderWidth: 1, borderColor: '#C3D3CA' }}>
                          {worker.avatarUrl ? (
                            <Image source={{ uri: worker.avatarUrl }} style={{ width: '100%', height: '100%' }} />
                          ) : (
                            <Text style={{ color: '#10472B', fontWeight: '700', fontSize: 18 }}>{worker.name.charAt(0)}</Text>
                          )}
                        </View>
                        <View>
                          <Text style={{ fontWeight: '700', color: '#1A1A1A', fontSize: 16 }}>{worker.name}</Text>
                          <Text style={{ color: '#666666', fontSize: 13, marginTop: 2 }}>{worker.role}</Text>
                        </View>
                      </View>

                      {/* Status Badge */}
                      <View
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 5,
                          borderRadius: 999,
                          backgroundColor:
                            worker.status === 'Review Pending'
                              ? '#FEF3C7'
                              : worker.status === 'En Route'
                              ? '#F3E8FF'
                              : worker.status === 'Completed'
                              ? '#DCFCE7'
                              : '#E0F2FE',
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '700',
                            color:
                              worker.status === 'Review Pending'
                                ? '#D97706'
                                : worker.status === 'En Route'
                                ? '#7E22CE'
                                : worker.status === 'Completed'
                                ? '#15803D'
                                : '#0369A1',
                          }}
                        >
                          {worker.status}
                        </Text>
                      </View>
                    </View>

                    {/* ETA Sub-banner */}
                    {worker.etaText && (
                      <View style={{ backgroundColor: '#F7F8F9', borderRadius: 12, padding: 12, marginTop: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' }}>
                        <Ionicons name="time-outline" size={16} color="#E31B23" style={{ marginRight: 8 }} />
                        <Text style={{ color: '#1A1A1A', fontSize: 12, fontWeight: '500' }}>
                          Arriving in <Text style={{ fontWeight: '700', color: '#1A1A1A' }}>15 mins</Text>
                        </Text>
                      </View>
                    )}

                    {/* 3-STEP ACCEPTANCE TIMELINE CHECKPOINTS */}
                    <View style={{ marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: '#666666', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                        Worker Check-in Timeline (3 Checkpoints)
                      </Text>

                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F7F8F9', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB' }}>
                        {/* Step 1: 90m Before */}
                        <View style={{ alignItems: 'center', flex: 1 }}>
                          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                            <Ionicons name="checkmark-sharp" size={14} color="#10472B" />
                          </View>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#1A1A1A' }}>90m Before</Text>
                          <Text style={{ fontSize: 9, color: '#666666', fontWeight: '500' }}>{worker.acceptances.t90.expectedTime}</Text>
                          <Text style={{ fontSize: 8, color: '#10472B', fontWeight: '700', marginTop: 2 }}>✓ Confirmed</Text>
                        </View>

                        <View style={{ width: 24, height: 2, backgroundColor: '#86EFAC', marginTop: -12 }} />

                        {/* Step 2: 60m Before */}
                        <View style={{ alignItems: 'center', flex: 1 }}>
                          <View
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 14,
                              backgroundColor: worker.acceptances.t60.status === 'DONE' ? '#DCFCE7' : '#FEF3C7',
                              alignItems: 'center',
                              justify: 'center',
                              marginBottom: 4,
                            }}
                          >
                            <Ionicons
                              name={worker.acceptances.t60.status === 'DONE' ? 'checkmark-sharp' : 'navigate-outline'}
                              size={14}
                              color={worker.acceptances.t60.status === 'DONE' ? '#10472B' : '#D97706'}
                            />
                          </View>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#1A1A1A' }}>60m Before</Text>
                          <Text style={{ fontSize: 9, color: '#666666', fontWeight: '500' }}>{worker.acceptances.t60.expectedTime}</Text>
                          <Text
                            style={{
                              fontSize: 8,
                              fontWeight: '700',
                              marginTop: 2,
                              color: worker.acceptances.t60.status === 'DONE' ? '#10472B' : '#D97706',
                            }}
                          >
                            {worker.acceptances.t60.status === 'DONE' ? '✓ En Route' : 'Pending'}
                          </Text>
                        </View>

                        <View
                          style={{
                            width: 24,
                            height: 2,
                            marginTop: -12,
                            backgroundColor: worker.acceptances.onArrival.status === 'DONE' ? '#86EFAC' : '#E5E7EB',
                          }}
                        />

                        {/* Step 3: On Arrival */}
                        <View style={{ alignItems: 'center', flex: 1 }}>
                          <View
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 14,
                              backgroundColor:
                                worker.acceptances.onArrival.status === 'DONE'
                                  ? '#DCFCE7'
                                  : worker.acceptances.onArrival.status === 'IN_PROGRESS'
                                  ? '#FEF3C7'
                                  : '#F3F4F6',
                              alignItems: 'center',
                              justify: 'center',
                              marginBottom: 4,
                            }}
                          >
                            <Ionicons
                              name={
                                worker.acceptances.onArrival.status === 'DONE'
                                  ? 'checkmark-sharp'
                                  : worker.acceptances.onArrival.status === 'IN_PROGRESS'
                                  ? 'time-outline'
                                  : 'location-outline'
                              }
                              size={14}
                              color={
                                worker.acceptances.onArrival.status === 'DONE'
                                  ? '#10472B'
                                  : worker.acceptances.onArrival.status === 'IN_PROGRESS'
                                  ? '#D97706'
                                  : '#9CA3AF'
                              }
                            />
                          </View>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#1A1A1A' }}>On Arrival</Text>
                          <Text style={{ fontSize: 9, color: '#666666', fontWeight: '500' }}>{worker.acceptances.onArrival.expectedTime}</Text>
                          <Text
                            style={{
                              fontSize: 8,
                              fontWeight: '700',
                              marginTop: 2,
                              color:
                                worker.acceptances.onArrival.status === 'DONE'
                                  ? '#10472B'
                                  : worker.acceptances.onArrival.status === 'IN_PROGRESS'
                                  ? '#D97706'
                                  : '#9CA3AF',
                            }}
                          >
                            {worker.acceptances.onArrival.status === 'DONE'
                              ? '✓ Arrived'
                              : worker.acceptances.onArrival.status === 'IN_PROGRESS'
                              ? 'Arriving'
                              : 'Pending'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* WORKER RATING ACTION BUTTON (Primary Red Button) */}
                    {worker.status === 'Review Pending' && (
                      <TouchableOpacity
                        onPress={() => handleOpenRating(worker)}
                        style={{ backgroundColor: '#E31B23', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16 }}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="star" size={16} color="#FFD700" style={{ marginRight: 6 }} />
                        <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>Rate Worker & Approve Shift</Text>
                      </TouchableOpacity>
                    )}

                    {/* RATED STATUS SUMMARY */}
                    {worker.status === 'Completed' && worker.rating && (
                      <View style={{ backgroundColor: '#F0FDF4', borderRadius: 12, padding: 12, marginTop: 12, borderWidth: 1, borderColor: '#DCFCE7', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={{ color: '#10472B', fontSize: 13, fontWeight: '700' }}>
                          {'★'.repeat(worker.rating.score)} {worker.rating.score}.0 Rated
                        </Text>
                        <Text style={{ color: '#15803D', fontSize: 12, fontWeight: '600' }}>Approved ✓</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* ==================== REQUESTS TAB ==================== */}
        {activeTab === 'requests' && (
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#1A1A1A', letterSpacing: -0.3 }}>My Requests</Text>
              <TouchableOpacity
                onPress={() => setIsRaiseModalOpen(true)}
                style={{ backgroundColor: '#E31B23', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, flexDirection: 'row', alignItems: 'center' }}
                activeOpacity={0.85}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 12 }}>+ New Request</Text>
              </TouchableOpacity>
            </View>

            {jobsList.map((job) => (
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
                  <View style={{ alignItems: 'end' }}>
                    <Text style={{ color: '#666666', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Compensation</Text>
                    <Text style={{ color: '#1A1A1A', fontWeight: '700', fontSize: 16 }}>₹{job.compensation}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ==================== PROFILE TAB (Matches Worker Profile Layout Exactly) ==================== */}
        {activeTab === 'profile' && (
          <View style={{ paddingBottom: 20 }}>
            {/* Profile Avatar Card */}
            <View style={{ backgroundColor: '#FFFFFF', borderRadius: 28, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2, marginBottom: 20 }}>
              <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: '#E1EBE5', alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#F2F6F4', marginBottom: 14 }}>
                <Text style={{ color: '#10472B', fontSize: 32, fontWeight: '700' }}>RK</Text>
              </View>

              <Text style={{ fontSize: 22, fontWeight: '700', color: '#1A1A1A', marginBottom: 2, letterSpacing: -0.3 }}>RAJESH KUMAR</Text>
              <Text style={{ color: '#666666', fontSize: 13, fontWeight: '500', marginBottom: 12 }}>Store Manager • Reliance Smart</Text>

              {/* Rating Badge */}
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#FDE68A' }}>
                <Text style={{ color: '#F59E0B', marginRight: 6, fontSize: 14 }}>⭐⭐⭐⭐⭐</Text>
                <Text style={{ color: '#B45309', fontWeight: '700', fontSize: 13 }}>5.0</Text>
              </View>
              <Text style={{ color: '#9CA3AF', fontSize: 11, marginTop: 6 }}>Rated by Gig Workers & Regional Operations</Text>
            </View>

            {/* Stats Grid Card (Matching Worker Profile Grid) */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
              <View style={{ backgroundColor: '#FFFFFF', flex: 1, marginRight: 8, borderRadius: 24, padding: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                  <Text style={{ fontSize: 18 }}>📋</Text>
                </View>
                <Text style={{ color: '#666666', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, textAlign: 'center' }}>Total Requests</Text>
                <Text style={{ fontSize: 22, fontWeight: '700', color: '#1A1A1A', textAlign: 'center' }}>18</Text>
              </View>

              <View style={{ backgroundColor: '#FFFFFF', flex: 1, marginLeft: 8, borderRadius: 24, padding: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                  <Text style={{ fontSize: 18 }}>👥</Text>
                </View>
                <Text style={{ color: '#666666', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, textAlign: 'center' }}>Workers Hired</Text>
                <Text style={{ fontSize: 22, fontWeight: '700', color: '#1A1A1A', textAlign: 'center' }}>42</Text>
              </View>
            </View>

            {/* Recent Activity Card */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: '#1A1A1A', marginBottom: 12 }}>Recent Activity</Text>
              <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, padding: 18, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <Ionicons name="checkmark-circle" size={24} color="#10472B" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: '#1A1A1A', fontSize: 15, marginBottom: 2 }}>Request Approved</Text>
                    <Text style={{ color: '#666666', fontSize: 12 }}>Inventory Restocking Shift</Text>
                  </View>
                  <Text style={{ color: '#9CA3AF', fontSize: 11 }}>Today</Text>
                </View>
              </View>
            </View>

            {/* Logout Button (Matching Worker Logout Button Style) */}
            <TouchableOpacity
              onPress={handleLogout}
              style={{ backgroundColor: '#FEF2F2', borderRadius: 24, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: '#FEE2E2', flexDirection: 'row', justifyContent: 'center' }}
              activeOpacity={0.85}
            >
              <Text style={{ color: '#E31B23', fontWeight: '700', fontSize: 16 }}>Logout</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* ==================== 3. FIXED BOTTOM NAVIGATION BAR (Strictly Fixed at Bottom) ==================== */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          flexDirection: 'row',
          justify: 'space-around',
          paddingVertical: 12,
          paddingBottom: Platform.OS === 'ios' ? 24 : 12,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.08,
          shadowRadius: 6,
          zIndex: 999,
        }}
      >
        <TouchableOpacity onPress={() => setActiveTab('home')} style={{ alignItems: 'center', flex: 1 }} activeOpacity={0.7}>
          <Ionicons
            name={activeTab === 'home' ? 'home' : 'home-outline'}
            size={22}
            color={activeTab === 'home' ? '#E31B23' : '#9CA3AF'}
          />
          <Text style={{ fontSize: 11, marginTop: 4, fontWeight: '600', color: activeTab === 'home' ? '#E31B23' : '#9CA3AF' }}>
            Home
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setActiveTab('requests')} style={{ alignItems: 'center', flex: 1 }} activeOpacity={0.7}>
          <Ionicons
            name={activeTab === 'requests' ? 'clipboard' : 'clipboard-outline'}
            size={22}
            color={activeTab === 'requests' ? '#E31B23' : '#9CA3AF'}
          />
          <Text style={{ fontSize: 11, marginTop: 4, fontWeight: '600', color: activeTab === 'requests' ? '#E31B23' : '#9CA3AF' }}>
            Requests
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setActiveTab('profile')} style={{ alignItems: 'center', flex: 1 }} activeOpacity={0.7}>
          <Ionicons
            name={activeTab === 'profile' ? 'person' : 'person-outline'}
            size={22}
            color={activeTab === 'profile' ? '#E31B23' : '#9CA3AF'}
          />
          <Text style={{ fontSize: 11, marginTop: 4, fontWeight: '600', color: activeTab === 'profile' ? '#E31B23' : '#9CA3AF' }}>
            Profile
          </Text>
        </TouchableOpacity>
      </View>

      {/* ==================== WORKER RATING MODAL ==================== */}
      <Modal visible={isRatingModalOpen} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24 }}>
            {/* Modal Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#1A1A1A' }}>Rate Worker Performance</Text>
              <TouchableOpacity onPress={() => setIsRatingModalOpen(false)}>
                <Ionicons name="close-circle-outline" size={28} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* Selected Worker Info */}
            {selectedWorker && (
              <View style={{ backgroundColor: '#F7F8F9', borderRadius: 16, padding: 14, marginBottom: 20, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' }}>
                <View style={{ width: 48, height: 48, borderRadius: 24, overflow: 'hidden', backgroundColor: '#E1EBE5', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  {selectedWorker.avatarUrl ? (
                    <Image source={{ uri: selectedWorker.avatarUrl }} style={{ width: '100%', height: '100%' }} />
                  ) : (
                    <Text style={{ color: '#10472B', fontWeight: '700', fontSize: 18 }}>{selectedWorker.name.charAt(0)}</Text>
                  )}
                </View>
                <View>
                  <Text style={{ fontWeight: '700', color: '#1A1A1A', fontSize: 16 }}>{selectedWorker.name}</Text>
                  <Text style={{ color: '#666666', fontSize: 12 }}>{selectedWorker.role}</Text>
                </View>
              </View>
            )}

            {/* Star Rating Control */}
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#666666', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center', marginBottom: 8 }}>
              Tap stars to rate performance
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 8 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setRatingScore(star)} style={{ paddingHorizontal: 6, paddingVertical: 4 }}>
                  <Ionicons
                    name={star <= ratingScore ? 'star' : 'star-outline'}
                    size={36}
                    color={star <= ratingScore ? '#FFD700' : '#D1D5DB'}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <Text style={{ textAlign: 'center', fontSize: 14, fontWeight: '700', color: '#E31B23', marginBottom: 20 }}>
              {ratingScore === 5
                ? '★ 5.0 - Outstanding Effort!'
                : ratingScore === 4
                ? '★ 4.0 - Very Good Work'
                : ratingScore === 3
                ? '★ 3.0 - Good Effort'
                : '★ Needs Improvement'}
            </Text>

            {/* Metric Tags */}
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#666666', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Strengths & Highlights</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20 }}>
              {['On-Time Arrival', 'High Efficiency', 'Great Attitude', 'Followed Instructions', 'Kept Store Clean'].map(
                (tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <TouchableOpacity
                      key={tag}
                      onPress={() => toggleTag(tag)}
                      style={{
                        marginRight: 8,
                        marginBottom: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 12,
                        borderWidth: 1,
                        backgroundColor: isSelected ? '#FEF2F2' : '#F7F8F9',
                        borderColor: isSelected ? '#E31B23' : '#E5E7EB',
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '600', color: isSelected ? '#E31B23' : '#666666' }}>
                        {isSelected ? '✓ ' : ''}
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  );
                }
              )}
            </View>

            {/* Feedback TextInput */}
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#666666', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Manager Feedback (Optional)</Text>
            <TextInput
              placeholder="Add optional notes about the worker's shift..."
              placeholderTextColor="#9CA3AF"
              value={feedbackText}
              onChangeText={setFeedbackText}
              multiline
              numberOfLines={3}
              style={{ backgroundColor: '#F7F8F9', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 12, fontSize: 14, color: '#1A1A1A', marginBottom: 24, minHeight: 70 }}
            />

            {/* Primary Red Submit Button */}
            <TouchableOpacity
              onPress={handleSubmitRating}
              style={{ backgroundColor: '#E31B23', borderRadius: 14, paddingVertical: 16, alignItems: 'center' }}
              activeOpacity={0.85}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>Submit Rating & Approve Shift</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ==================== RAISE MANPOWER REQUEST MODAL ==================== */}
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
                  <TextInput
                    value={requestRole}
                    onChangeText={setRequestRole}
                    placeholder="Select a role..."
                    style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, color: '#1A1A1A' }}
                  />
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
                    onChangeText={setRequestCompensation}
                    keyboardType="numeric"
                    placeholder="Auto-set by role"
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
    </SafeAreaView>
  );
}
