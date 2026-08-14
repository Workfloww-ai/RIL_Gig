import React, { useState, useEffect } from 'react';
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
import { apiClient } from '../../src/api/client';

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

  // Navigation tab state: 'home' | 'requests' | 'profile'
  const [activeTab, setActiveTab] = useState<'home' | 'requests' | 'profile'>('home');
  const [userProfile, setUserProfile] = useState<{ first_name: string; last_name: string } | null>(null);
  const [managerStoreName, setManagerStoreName] = useState<string>('Loading store...');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await apiClient.get('/auth/me');
        if (res?.data) setUserProfile(res.data);
      } catch (err) {
        console.error('Failed to load profile in dashboard', err);
      }
    };
    fetchProfile();
  }, []);

  // Interactive Expandable Jobs State (ID of expanded job card, defaults to 'job-1')
  const [expandedJobId, setExpandedJobId] = useState<string | null>('job-1');

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
  const [jobsList, setJobsList] = useState<any[]>([]);
  
  // Available Jobs and Stores for Modal
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [availableJobs, setAvailableJobs] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [availableStores, setAvailableStores] = useState<any[]>([]);
  const [selectedStore, setSelectedStore] = useState<any>(null);

  const fetchRequests = async () => {
    try {
      const res = await apiClient.get('/jobs/manager/requests');
      if (res.data) {
        if (res.data.requests) setJobsList(res.data.requests);
        if (res.data.store_name) setManagerStoreName(res.data.store_name);
        else setManagerStoreName('Unassigned Store');
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

  // Toggle expandable job card
  const toggleExpandJob = (jobId: string) => {
    setExpandedJobId(expandedJobId === jobId ? null : jobId);
  };

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
        accepted_workers: (job.accepted_workers || []).map((w: any) => {
          if (w.id === selectedWorker.id) {
            return {
              ...w,
              status: 'completed',
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
      setIsRaiseModalOpen(false);
      setSelectedJob(null);
      Alert.alert('Request Published', 'Your manpower request has been successfully published to the worker pool!');
      fetchRequests();
    } catch (error) {
      console.error("Error creating request", error);
      Alert.alert('Error', 'Failed to publish request.');
    }
  };

  const handleLogout = () => {
    if (logout) logout();
    router.replace('/');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F8F9' }}>
      {/* ==================== 1. TOP HEADER ==================== */}
      <View style={{ backgroundColor: '#10472B', borderBottomLeftRadius: 28, borderBottomRightRadius: 28, paddingTop: 40, paddingBottom: 24, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 24, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.5 }}>
              Hi, {userProfile ? `${userProfile.first_name}` : 'Rajesh'}
            </Text>
            <Text style={{ fontSize: 13, color: '#E1EBE5', fontWeight: '500', marginTop: 2 }}>{managerStoreName}</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/store_manager/profile')}
            style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255, 255, 255, 0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.4)' }}
            activeOpacity={0.8}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>
              {userProfile?.first_name ? userProfile.first_name.charAt(0).toUpperCase() : 'R'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ==================== 2. MAIN SCROLLABLE BODY CONTENT ==================== */}
      <ScrollView style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        
        {/* ==================== HOME TAB (JOBS IN PROCESS & EXPANDABLE ASSIGNED WORKERS) ==================== */}
        {activeTab === 'home' && (
          <View>
            {/* Section Title + Single '+' Raise Request Button */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#1A1A1A', letterSpacing: -0.3 }}>Jobs in Process</Text>
              <TouchableOpacity
                onPress={() => setIsRaiseModalOpen(true)}
                style={{ backgroundColor: '#E31B23', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, flexDirection: 'row', alignItems: 'center' }}
                activeOpacity={0.85}
              >
                <Ionicons name="add-outline" size={18} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>Raise Request</Text>
              </TouchableOpacity>
            </View>

            {/* List of Jobs in Process (Click to view assigned workers) */}
            {jobsList.map((job) => {
              const isExpanded = expandedJobId === job.request_id;
              const acceptedWorkers = job.accepted_workers || [];
              return (
                <View
                  key={job.request_id}
                  style={{ backgroundColor: '#FFFFFF', borderRadius: 20, marginBottom: 14, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2, overflow: 'hidden' }}
                >
                  {/* Job Card Header (Clickable to Expand / Collapse) */}
                  <TouchableOpacity
                    onPress={() => toggleExpandJob(job.request_id)}
                    style={{ padding: 18, backgroundColor: isExpanded ? '#FAFBFB' : '#FFFFFF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <Text style={{ fontSize: 17, fontWeight: '700', color: '#1A1A1A', flex: 1 }}>{job.job_name}</Text>
                        <View style={{ backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#15803D' }}>{job.request_status}</Text>
                        </View>
                      </View>

                      <Text style={{ fontSize: 13, color: '#666666', fontWeight: '500', marginBottom: 8 }}>{job.shift_date} • {job.start_time}</Text>

                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="people-outline" size={16} color="#10472B" style={{ marginRight: 6 }} />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#10472B' }}>
                          {acceptedWorkers.length} {acceptedWorkers.length === 1 ? 'Worker Assigned' : 'Workers Assigned'}
                        </Text>
                      </View>
                    </View>

                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#1A1A1A" />
                    </View>
                  </TouchableOpacity>

                  {/* EXPANDED SECTION: ASSIGNED WORKERS & STATUS FOR THIS JOB */}
                  {isExpanded && (
                    <View style={{ padding: 18, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6', backgroundColor: '#FFFFFF' }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#666666', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                        Assigned Workers & Check-in Status
                      </Text>

                      {acceptedWorkers.length === 0 ? (
                        <Text style={{ color: '#9CA3AF', fontSize: 13, fontStyle: 'italic' }}>No workers assigned yet for this job.</Text>
                      ) : (
                        acceptedWorkers.map((worker: any) => (
                          <View
                            key={worker.id}
                            style={{ backgroundColor: '#F7F8F9', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' }}
                          >
                            {/* Worker Header */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden', backgroundColor: '#E1EBE5', alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1, borderColor: '#C3D3CA' }}>
                                  {worker.avatarUrl ? (
                                    <Image source={{ uri: worker.avatarUrl }} style={{ width: '100%', height: '100%' }} />
                                  ) : (
                                    <Text style={{ color: '#10472B', fontWeight: '700', fontSize: 16 }}>{worker.name.charAt(0)}</Text>
                                  )}
                                </View>
                                <View>
                                  <Text style={{ fontWeight: '700', color: '#1A1A1A', fontSize: 15 }}>{worker.name}</Text>
                                  <Text style={{ color: '#666666', fontSize: 12, marginTop: 1 }}>{worker.role}</Text>
                                </View>
                              </View>

                              {/* Worker Status Badge */}
                              <View
                                style={{
                                  paddingHorizontal: 10,
                                  paddingVertical: 4,
                                  borderRadius: 999,
                                  backgroundColor:
                                    worker.status === 'Review Pending'
                                      ? '#FEF3C7'
                                      : worker.status === 'accepted'
                                      ? '#F3E8FF'
                                      : worker.status === 'completed'
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
                                        : worker.status === 'accepted'
                                        ? '#7E22CE'
                                        : worker.status === 'completed'
                                        ? '#15803D'
                                        : '#0369A1',
                                  }}
                                >
                                  {worker.status}
                                </Text>
                              </View>
                            </View>

                            {/* RATE WORKER ACTION BUTTON (Primary Red Button) */}
                            {worker.status === 'Review Pending' && (
                              <TouchableOpacity
                                onPress={() => handleOpenRating(worker)}
                                style={{ backgroundColor: '#E31B23', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12 }}
                                activeOpacity={0.85}
                              >
                                <Ionicons name="star" size={14} color="#FFD700" style={{ marginRight: 6 }} />
                                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>Rate Worker & Approve Shift</Text>
                              </TouchableOpacity>
                            )}

                            {/* RATED STATUS SUMMARY */}
                            {worker.status === 'completed' && worker.rating && (
                              <View style={{ backgroundColor: '#F0FDF4', borderRadius: 10, padding: 10, marginTop: 10, borderWidth: 1, borderColor: '#DCFCE7', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Text style={{ color: '#10472B', fontSize: 12, fontWeight: '700' }}>
                                  {'★'.repeat(worker.rating.score)} {worker.rating.score}.0 Rated
                                </Text>
                                <Text style={{ color: '#15803D', fontSize: 11, fontWeight: '600' }}>Approved ✓</Text>
                              </View>
                            )}
                          </View>
                        ))
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* ==================== REQUESTS TAB ==================== */}
        {activeTab === 'requests' && (
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#1A1A1A', letterSpacing: -0.3 }}>My Requests</Text>
              <TouchableOpacity
                onPress={() => setIsRaiseModalOpen(true)}
                style={{ backgroundColor: '#E31B23', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, flexDirection: 'row', alignItems: 'center' }}
                activeOpacity={0.85}
              >
                <Ionicons name="add-outline" size={18} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>New Request</Text>
              </TouchableOpacity>
            </View>

            {jobsList.map((job) => (
              <View key={job.request_id} style={{ backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <Text style={{ fontWeight: '700', color: '#1A1A1A', fontSize: 17, flex: 1, marginRight: 8 }}>{job.job_name}</Text>
                  <View
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 5,
                      borderRadius: 999,
                      backgroundColor: job.request_status === 'Pending Approval' ? '#FEF3C7' : '#DCFCE7',
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: job.request_status === 'Pending Approval' ? '#D97706' : '#15803D' }}>
                      {job.request_status}
                    </Text>
                  </View>
                </View>

                <Text style={{ color: '#666666', fontSize: 13, fontWeight: '500', marginBottom: 14 }}>{job.shift_date} • {job.start_time}</Text>

                <View style={{ backgroundColor: '#F7F8F9', borderRadius: 14, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' }}>
                  <View>
                    <Text style={{ color: '#666666', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Workers</Text>
                    <Text style={{ color: '#1A1A1A', fontWeight: '700', fontSize: 16 }}>{job.workers_needed} Needed</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: '#666666', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Compensation</Text>
                    <Text style={{ color: '#1A1A1A', fontWeight: '700', fontSize: 16 }}>₹{job.base_compensation * job.hours_duration}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ==================== PROFILE TAB (Clean Profile Without Stats Grid & Activity) ==================== */}
        {activeTab === 'profile' && (
          <View style={{ paddingBottom: 20 }}>
            {/* Profile Avatar Card */}
            <View style={{ backgroundColor: '#FFFFFF', borderRadius: 28, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2, marginBottom: 20 }}>
              <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: '#E1EBE5', alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#F2F6F4', marginBottom: 14 }}>
                <Text style={{ color: '#10472B', fontSize: 32, fontWeight: '700' }}>RK</Text>
              </View>

              <Text style={{ fontSize: 22, fontWeight: '700', color: '#1A1A1A', marginBottom: 2, letterSpacing: -0.3 }}>{userProfile ? `${userProfile.first_name} ${userProfile.last_name}`.toUpperCase() : 'RAJESH KUMAR'}</Text>
              <Text style={{ color: '#666666', fontSize: 13, fontWeight: '500', marginBottom: 12 }}>Store Manager • {managerStoreName}</Text>

              {/* Rating Badge */}
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#FDE68A' }}>
                <Text style={{ color: '#F59E0B', marginRight: 6, fontSize: 14 }}>⭐⭐⭐⭐⭐</Text>
                <Text style={{ color: '#B45309', fontWeight: '700', fontSize: 13 }}>5.0</Text>
              </View>
              <Text style={{ color: '#9CA3AF', fontSize: 11, marginTop: 6 }}>Rated by Gig Workers & Operations</Text>
            </View>

            {/* Settings Options */}
            <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2, marginBottom: 20 }}>
              <TouchableOpacity style={{ paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                <Text style={{ color: '#1A1A1A', fontWeight: '600', fontSize: 14 }}>Store Settings & Locations</Text>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </TouchableOpacity>

              <TouchableOpacity style={{ paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                <Text style={{ color: '#1A1A1A', fontWeight: '600', fontSize: 14 }}>Gig Worker Escalations</Text>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </TouchableOpacity>

              <TouchableOpacity style={{ paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: '#1A1A1A', fontWeight: '600', fontSize: 14 }}>Help & Support</Text>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* Logout Button */}
            <TouchableOpacity
              onPress={handleLogout}
              style={{ backgroundColor: '#FEF2F2', borderRadius: 24, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: '#FEE2E2', flexDirection: 'row', justifyContent: 'center', marginBottom: 40 }}
              activeOpacity={0.85}
            >
              <Text style={{ color: '#E31B23', fontWeight: '700', fontSize: 16 }}>Logout</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* ==================== 3. FIXED BOTTOM NAVIGATION BAR ==================== */}
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
          justifyContent: 'space-around',
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

        <TouchableOpacity onPress={() => router.push('/store_manager/profile')} style={{ alignItems: 'center', flex: 1 }} activeOpacity={0.7}>
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#1A1A1A' }}>Rate Worker Performance</Text>
              <TouchableOpacity onPress={() => setIsRatingModalOpen(false)}>
                <Ionicons name="close-circle-outline" size={28} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

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
                      {selectedJob ? selectedJob.title : 'Select a role...'}
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
                    {job.title}
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
