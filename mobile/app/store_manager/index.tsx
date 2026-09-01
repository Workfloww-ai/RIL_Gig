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
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/store/authStore';
import { apiClient } from '../../src/api/client';
import RaiseRequestModal from '../../src/components/RaiseRequestModal';

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
  const insets = useSafeAreaInsets();

  // Navigation tab state: 'home' | 'requests' | 'profile'
  const [activeTab, setActiveTab] = useState<'home' | 'requests' | 'profile'>('home');
  const [userProfile, setUserProfile] = useState<{ first_name: string; last_name: string; role_name?: string } | null>(null);
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

  // OTP Verification State
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [otpWorkerId, setOtpWorkerId] = useState<string>('');
  const [otpAssignmentId, setOtpAssignmentId] = useState<string>('');
  const [otpInput, setOtpInput] = useState<string>('');
  const [verifyingOtp, setVerifyingOtp] = useState<boolean>(false);

  const handleOpenOtpModal = (workerId: string, assignmentId: string) => {
    setOtpWorkerId(workerId);
    setOtpAssignmentId(assignmentId);
    setOtpInput('');
    setIsOtpModalOpen(true);
  };

  const handleVerifyOtp = async () => {
    if (otpInput.length !== 4) {
      Alert.alert('Invalid', 'OTP must be 4 digits');
      return;
    }
    setVerifyingOtp(true);
    try {
      await apiClient.post(`/jobs/manager/jobs/assignment/${otpAssignmentId}/verify-otp`, {
        otp_code: otpInput,
        worker_id: otpWorkerId
      });
      Alert.alert('Success', 'Job started successfully');
      setIsOtpModalOpen(false);
      fetchRequests();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to verify OTP');
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Rating Form State
  const [ratingScore, setRatingScore] = useState<number>(5);
  const [selectedTags, setSelectedTags] = useState<string[]>(['On-Time Arrival', 'High Efficiency']);
  const [feedbackText, setFeedbackText] = useState<string>('');
  const [submittingRating, setSubmittingRating] = useState<boolean>(false);

  // Job data state
  const [jobsList, setJobsList] = useState<any[]>([]);

  // Accordion State
  const [expandedSections, setExpandedSections] = useState({
    today: true,
    upcoming: false,
    past: false,
    pending: false,
    declined: false
  });

  const toggleSection = (section: 'today' | 'upcoming' | 'past' | 'pending' | 'declined') => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };
  
  // Sort State
  const [sortOption, setSortOption] = useState<'date_desc' | 'date_asc' | 'open_first' | 'closed_first'>('date_desc');
  const [isSortModalOpen, setIsSortModalOpen] = useState(false);

  // Available Jobs and Stores for Modal
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [availableJobs, setAvailableJobs] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any>(null);

  const sortedJobsList = React.useMemo(() => {
    return [...jobsList].sort((a, b) => {
      if (sortOption === 'date_desc') {
        const dateA = new Date(a.shift_date || 0).getTime();
        const dateB = new Date(b.shift_date || 0).getTime();
        return dateB - dateA;
      }
      if (sortOption === 'date_asc') {
        const dateA = new Date(a.shift_date || 0).getTime();
        const dateB = new Date(b.shift_date || 0).getTime();
        return dateA - dateB;
      }
      if (sortOption === 'open_first') {
        const isAOpen = a.request_status?.toLowerCase() === 'open' ? 1 : 0;
        const isBOpen = b.request_status?.toLowerCase() === 'open' ? 1 : 0;
        if (isAOpen !== isBOpen) return isBOpen - isAOpen;
        const dateA = new Date(a.shift_date || 0).getTime();
        const dateB = new Date(b.shift_date || 0).getTime();
        return dateB - dateA; // secondary sort by date
      }
      if (sortOption === 'closed_first') {
        const isAClosed = a.request_status?.toLowerCase() === 'closed' ? 1 : 0;
        const isBClosed = b.request_status?.toLowerCase() === 'closed' ? 1 : 0;
        if (isAClosed !== isBClosed) return isBClosed - isAClosed;
        const dateA = new Date(a.shift_date || 0).getTime();
        const dateB = new Date(b.shift_date || 0).getTime();
        return dateB - dateA; // secondary sort by date
      }
      return 0;
    });
  }, [jobsList, sortOption]);

  const fetchRequests = async () => {
    try {
      const res = await apiClient.get('/jobs/manager/requests');
      if (res.data) {
        if (res.data.requests) {
          const sortedJobs = [...res.data.requests].sort((a: any, b: any) => {
            const dateA = new Date(a.shift_date || 0).getTime();
            const dateB = new Date(b.shift_date || 0).getTime();
            return dateB - dateA;
          });
          setJobsList(sortedJobs);
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
  const handleSubmitRating = async () => {
    if (!selectedWorker) return;
    setSubmittingRating(true);
    try {
      await apiClient.post(`/jobs/manager/jobs/assignment/${selectedWorker.assignment_id}/complete`, {
        rating_score: ratingScore,
        rating_tags: selectedTags,
        rating_feedback: feedbackText
      });
      
      setIsRatingModalOpen(false);
      setSelectedWorker(null);
      Alert.alert('Success', 'Thank you! The worker performance has been rated and shift is completed.');
      fetchRequests();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to submit rating');
    } finally {
      setSubmittingRating(false);
    }
  };



  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const getWorkerStatusDisplay = (worker: any, job: any) => {
    if (worker.status === 'cancelled') return { label: 'Cancelled', bgColor: '#F3F4F6', textColor: '#9CA3AF' };

    let shiftHasStarted = false;
    let minutesUntilShift = 999;

    if (job.shift_date && job.start_time) {
      const shiftDateTime = new Date(`${job.shift_date}T${job.start_time}`);
      const now = new Date();
      if (now >= shiftDateTime) {
        shiftHasStarted = true;
      }
      minutesUntilShift = (shiftDateTime.getTime() - now.getTime()) / (1000 * 60);
    }

    if (worker.status === 'cancelled') return { label: 'Cancelled', bgColor: '#F3F4F6', textColor: '#9CA3AF' };

    if (worker.status === 'started') return { label: 'Verified', bgColor: '#10B981', textColor: '#FFFFFF' };
    
    if (shiftHasStarted) {
      if (worker.status === 'accepted') return { label: 'No Show', bgColor: '#FEE2E2', textColor: '#D32F2F' };
    }

    if (worker.arrival_status === 'arrived') return { label: 'Arrived', bgColor: '#D1FAE5', textColor: '#059669' };

    // Instantly reflect missed checkpoints as cancelled before the cron job officially cancels them
    if (minutesUntilShift <= 90 && worker.t90_status === 'pending') {
      return { label: 'Cancelled', bgColor: '#F3F4F6', textColor: '#9CA3AF' };
    }
    if (minutesUntilShift <= 60 && worker.t60_status === 'pending') {
      return { label: 'Cancelled', bgColor: '#F3F4F6', textColor: '#9CA3AF' };
    }

    // If they are not cancelled, and T-60 or T-90 is confirmed (or they bypassed it), they are Enroute.
    if (worker.t60_status === 'confirmed' || worker.t90_status === 'confirmed') {
      return { label: 'Enroute', bgColor: '#D1FAE5', textColor: '#059669' };
    }

    // Default / raw status formatting
    if (worker.status === 'started') return { label: 'Started', bgColor: '#FEF3C7', textColor: '#D97706' };
    if (worker.status === 'completed') return { label: 'Completed', bgColor: '#DCFCE7', textColor: '#15803D' };
    return { label: worker.status.charAt(0).toUpperCase() + worker.status.slice(1), bgColor: '#F3E8FF', textColor: '#7E22CE' };
  };

  const handleLogout = () => {
    if (logout) logout();
    router.replace('/');
  };

  // Split jobs into categories based on approval status and date
  const todayStr = new Date().toISOString().split('T')[0];
  
  const pendingJobs = sortedJobsList.filter(job => job.approval_status === 'pending');
  const declinedJobs = sortedJobsList.filter(job => job.approval_status === 'declined' || job.approval_status === 'rejected');
  
  const approvedJobs = sortedJobsList.filter(job => job.approval_status !== 'pending' && job.approval_status !== 'declined' && job.approval_status !== 'rejected');
  const todayJobs = approvedJobs.filter(job => job.shift_date === todayStr);
  const upcomingJobs = approvedJobs.filter(job => job.shift_date > todayStr);
  const pastJobs = approvedJobs.filter(job => job.shift_date < todayStr);

  const renderJobCard = (job: any) => {
    const isExpanded = expandedJobId === job.request_id;
    const acceptedWorkers = job.accepted_workers || [];
    
    let shiftHasStarted = false;
    let isJobEnded = false;
    if (job.shift_date && job.start_time) {
      const shiftDateTime = new Date(`${job.shift_date}T${job.start_time}`);
      if (new Date() >= shiftDateTime) {
        shiftHasStarted = true;
      }
      const hoursDuration = job.hours_duration || 0;
      const endDateTime = new Date(shiftDateTime.getTime() + hoursDuration * 60 * 60 * 1000);
      if (new Date() >= endDateTime) {
        isJobEnded = true;
      }
    }

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
              <View style={{ backgroundColor: job.request_status?.toLowerCase() === 'open' ? '#DCFCE7' : '#FEE2E2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: job.request_status?.toLowerCase() === 'open' ? '#15803D' : '#B91C1C', textTransform: 'capitalize' }}>{job.request_status || 'Open'}</Text>
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
              acceptedWorkers.map((worker: any) => {
                const statusInfo = getWorkerStatusDisplay(worker, job);
                return (
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
                            <Text style={{ color: '#10472B', fontWeight: '700', fontSize: 16 }}>{worker.name.charAt(0).toUpperCase()}</Text>
                          )}
                        </View>
                        <View>
                          <Text style={{ fontWeight: '700', color: '#1A1A1A', fontSize: 15 }}>{worker.name ? worker.name.split(' ').map((n: string) => n.charAt(0).toUpperCase() + n.slice(1).toLowerCase()).join(' ') : ''}</Text>
                          <Text style={{ color: '#666666', fontSize: 12, marginTop: 1 }}>{worker.role}</Text>
                        </View>
                      </View>

                      {/* Worker Status Badge */}
                      <View
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 999,
                          backgroundColor: statusInfo.bgColor,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '700',
                            color: statusInfo.textColor,
                          }}
                        >
                          {statusInfo.label}
                        </Text>
                      </View>
                    </View>

                    {/* VERIFY OTP ACTION BUTTON */}
                    {worker.arrival_status === 'arrived' && worker.status === 'accepted' && !shiftHasStarted && (
                      <TouchableOpacity
                        onPress={() => handleOpenOtpModal(worker.id, worker.assignment_id)}
                        style={{ backgroundColor: '#10B981', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12 }}
                        activeOpacity={0.85}
                      >
                        <Feather name="key" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>Verify Start OTP</Text>
                      </TouchableOpacity>
                    )}

                    {/* RATE WORKER ACTION BUTTON (Primary Red Button) */}
                    {worker.status === 'started' && isJobEnded && (
                      <TouchableOpacity
                        onPress={() => handleOpenRating(worker)}
                        style={{ backgroundColor: '#D32F2F', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12 }}
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
                );
              })
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F8F9' }}>
      {/* ==================== 1. TOP HEADER ==================== */}
      <View style={{ backgroundColor: '#10472B', borderBottomLeftRadius: 28, borderBottomRightRadius: 28, paddingTop: 40, paddingBottom: 24, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => router.push('/store_manager/profile')}
            style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255, 255, 255, 0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.4)', marginRight: 12 }}
            activeOpacity={0.8}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>
              {userProfile?.first_name ? userProfile.first_name.charAt(0).toUpperCase() : 'R'}
            </Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 24, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.5 }}>
              Hi, {userProfile ? `${userProfile.first_name}` : 'Rajesh'}
            </Text>
            <Text style={{ fontSize: 13, color: '#E1EBE5', fontWeight: '500', marginTop: 2 }}>{managerStoreName}</Text>
          </View>
        </View>
      </View>

      {/* ==================== 2. MAIN SCROLLABLE BODY CONTENT ==================== */}
      <ScrollView style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* ==================== HOME TAB (JOBS IN PROCESS & EXPANDABLE ASSIGNED WORKERS) ==================== */}
        {activeTab === 'home' && (
          <View>
            {/* Section Title + Sort Filter Button */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#1A1A1A', letterSpacing: -0.3 }}>Jobs in Process</Text>
              <View style={{ flexDirection: 'row' }}>
                <TouchableOpacity
                  onPress={fetchRequests}
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1, marginRight: 10 }}
                  activeOpacity={0.8}
                >
                  <Feather name="refresh-cw" size={16} color="#10472B" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setIsSortModalOpen(true)}
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="filter" size={18} color="#10472B" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Today Accordion */}
            <TouchableOpacity 
              onPress={() => toggleSection('today')}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#10472B' }}>Jobs Today</Text>
                <View style={{ backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, marginLeft: 12 }}>
                  <Text style={{ color: '#15803D', fontSize: 12, fontWeight: '700' }}>{todayJobs.length}</Text>
                </View>
              </View>
              <Feather name={expandedSections.today ? 'chevron-up' : 'chevron-down'} size={20} color="#6B7280" />
            </TouchableOpacity>

            {expandedSections.today && (
              <View style={{ marginBottom: 16 }}>
                {todayJobs.length === 0 ? (
                  <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB' }}>
                    <Text style={{ color: '#6B7280', fontSize: 14 }}>No job scheduled for today</Text>
                  </View>
                ) : (
                  todayJobs.map(renderJobCard)
                )}
              </View>
            )}

            {/* Upcoming Accordion */}
            <TouchableOpacity 
              onPress={() => toggleSection('upcoming')}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#10472B' }}>Upcoming Jobs</Text>
                <View style={{ backgroundColor: '#DBEAFE', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, marginLeft: 12 }}>
                  <Text style={{ color: '#1D4ED8', fontSize: 12, fontWeight: '700' }}>{upcomingJobs.length}</Text>
                </View>
              </View>
              <Feather name={expandedSections.upcoming ? 'chevron-up' : 'chevron-down'} size={20} color="#6B7280" />
            </TouchableOpacity>

            {expandedSections.upcoming && (
              <View style={{ marginBottom: 16 }}>
                {upcomingJobs.length === 0 ? (
                  <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB' }}>
                    <Text style={{ color: '#6B7280', fontSize: 14 }}>No upcoming jobs</Text>
                  </View>
                ) : (
                  upcomingJobs.map(renderJobCard)
                )}
              </View>
            )}

            {/* Past Accordion */}
            <TouchableOpacity 
              onPress={() => toggleSection('past')}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#10472B' }}>Past Jobs</Text>
                <View style={{ backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, marginLeft: 12 }}>
                  <Text style={{ color: '#4B5563', fontSize: 12, fontWeight: '700' }}>{pastJobs.length}</Text>
                </View>
              </View>
              <Feather name={expandedSections.past ? 'chevron-up' : 'chevron-down'} size={20} color="#6B7280" />
            </TouchableOpacity>

            {expandedSections.past && (
              <View style={{ marginBottom: 16 }}>
                {pastJobs.length === 0 ? (
                  <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB' }}>
                    <Text style={{ color: '#6B7280', fontSize: 14 }}>No past jobs</Text>
                  </View>
                ) : (
                  pastJobs.map(renderJobCard)
                )}
              </View>
            )}


            {/* Pending Approval Accordion */}
            <TouchableOpacity 
              onPress={() => toggleSection('pending')}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#10472B' }}>Pending Approval Jobs</Text>
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
                    <Text style={{ color: '#6B7280', fontSize: 14 }}>No pending jobs</Text>
                  </View>
                ) : (
                  pendingJobs.map(renderJobCard)
                )}
              </View>
            )}

            {/* Declined Accordion */}
            <TouchableOpacity 
              onPress={() => toggleSection('declined')}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 }}
            >
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
                    <Text style={{ color: '#6B7280', fontSize: 14 }}>No declined jobs</Text>
                  </View>
                ) : (
                  declinedJobs.map(renderJobCard)
                )}
              </View>
            )}
          </View>
        )}

        {/* ==================== REQUESTS TAB ==================== */}
        {activeTab === 'requests' && (
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#1A1A1A', letterSpacing: -0.3 }}>My Requests</Text>
              {userProfile?.role_name !== 'supervisor' && (
                <TouchableOpacity
                  onPress={() => setIsRaiseModalOpen(true)}
                  style={{ backgroundColor: '#D32F2F', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, flexDirection: 'row', alignItems: 'center' }}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add-outline" size={18} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>New Request</Text>
                </TouchableOpacity>
              )}
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
                      backgroundColor: job.request_status?.toLowerCase() === 'open' ? '#DCFCE7' : '#FEE2E2',
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: job.request_status?.toLowerCase() === 'open' ? '#15803D' : '#B91C1C', textTransform: 'capitalize' }}>
                      {job.request_status || 'Open'}
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

              <Text style={{ fontSize: 22, fontWeight: '700', color: '#1A1A1A', marginBottom: 2, letterSpacing: -0.3 }}>{userProfile ? (userProfile.first_name + ' ' + userProfile.last_name).toUpperCase() : 'RAJESH KUMAR'}</Text>
              <Text style={{ color: '#666666', fontSize: 13, fontWeight: '500', marginBottom: 12 }}>{userProfile?.role_name ? userProfile.role_name.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Store Manager'} • {managerStoreName}</Text>

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
                <Text style={{ color: '#1A1A1A', fontWeight: '600', fontSize: 14 }}>Sahyogi Escalations</Text>
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
              style={{ backgroundColor: '#FEF2F2', borderRadius: 24, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: '#FEE2F2', flexDirection: 'row', justifyContent: 'center', marginBottom: 40 }}
              activeOpacity={0.85}
            >
              <Text style={{ color: '#D32F2F', fontWeight: '700', fontSize: 16 }}>Logout</Text>
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
          paddingBottom: Platform.OS === 'ios' ? Math.max(24, insets.bottom) : Math.max(12, insets.bottom),
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
            color={activeTab === 'home' ? '#D32F2F' : '#9CA3AF'}
          />
          <Text style={{ fontSize: 11, marginTop: 4, fontWeight: '600', color: activeTab === 'home' ? '#D32F2F' : '#9CA3AF' }}>
            Home
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setActiveTab('requests')} style={{ alignItems: 'center', flex: 1 }} activeOpacity={0.7}>
          <Ionicons
            name={activeTab === 'requests' ? 'clipboard' : 'clipboard-outline'}
            size={22}
            color={activeTab === 'requests' ? '#D32F2F' : '#9CA3AF'}
          />
          <Text style={{ fontSize: 11, marginTop: 4, fontWeight: '600', color: activeTab === 'requests' ? '#D32F2F' : '#9CA3AF' }}>
            Requests
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => { }} style={{ alignItems: 'center', flex: 1 }} activeOpacity={0.7}>
          <Ionicons
            name="bar-chart-outline"
            size={22}
            color="#9CA3AF"
          />
          <Text style={{ fontSize: 11, marginTop: 4, fontWeight: '600', color: '#9CA3AF' }}>
            Insights
          </Text>
        </TouchableOpacity>
      </View>

      {/* ==================== OTP VERIFICATION MODAL ==================== */}
      <Modal visible={isOtpModalOpen} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, width: '100%', maxWidth: 400 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#1A1A1A' }}>Verify Start OTP</Text>
              <TouchableOpacity onPress={() => setIsOtpModalOpen(false)}>
                <Ionicons name="close-circle-outline" size={28} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            <Text style={{ color: '#666666', fontSize: 14, marginBottom: 20 }}>
              Ask the worker for their 4-digit start OTP to officially begin their shift.
            </Text>
            
            <TextInput
              style={{ backgroundColor: '#F3F4F6', borderRadius: 12, padding: 16, fontSize: 24, fontWeight: '700', textAlign: 'center', letterSpacing: 8, marginBottom: 24 }}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="0000"
              value={otpInput}
              onChangeText={setOtpInput}
            />

            <TouchableOpacity
              onPress={handleVerifyOtp}
              disabled={verifyingOtp || otpInput.length !== 4}
              style={{ backgroundColor: (verifyingOtp || otpInput.length !== 4) ? '#9CA3AF' : '#10B981', paddingVertical: 14, borderRadius: 12, alignItems: 'center' }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>
                {verifyingOtp ? 'Verifying...' : 'Verify & Start Job'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
            <Text style={{ textAlign: 'center', fontSize: 14, fontWeight: '700', color: '#D32F2F', marginBottom: 20 }}>
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
                        borderColor: isSelected ? '#D32F2F' : '#E5E7EB',
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '600', color: isSelected ? '#D32F2F' : '#666666' }}>
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
              disabled={submittingRating}
              style={{ backgroundColor: submittingRating ? '#9CA3AF' : '#D32F2F', borderRadius: 14, paddingVertical: 16, alignItems: 'center' }}
              activeOpacity={0.85}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>
                {submittingRating ? 'Submitting...' : 'Submit Rating & Approve Shift'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <RaiseRequestModal
        visible={isRaiseModalOpen}
        onClose={() => setIsRaiseModalOpen(false)}
        onSuccess={fetchRequests}
        managerStoreName={managerStoreName}
      />

      {/* ==================== SORTING MODAL ==================== */}
      <Modal visible={isSortModalOpen} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#1A1A1A' }}>Sort Jobs By</Text>
              <TouchableOpacity onPress={() => setIsSortModalOpen(false)}>
                <Ionicons name="close-circle-outline" size={28} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              onPress={() => { setSortOption('date_desc'); setIsSortModalOpen(false); }}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}
            >
              <Text style={{ fontSize: 16, color: sortOption === 'date_desc' ? '#D32F2F' : '#1A1A1A', fontWeight: sortOption === 'date_desc' ? '700' : '500' }}>Date (Newest First)</Text>
              {sortOption === 'date_desc' && <Ionicons name="checkmark" size={20} color="#D32F2F" />}
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => { setSortOption('date_asc'); setIsSortModalOpen(false); }}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}
            >
              <Text style={{ fontSize: 16, color: sortOption === 'date_asc' ? '#D32F2F' : '#1A1A1A', fontWeight: sortOption === 'date_asc' ? '700' : '500' }}>Date (Oldest First)</Text>
              {sortOption === 'date_asc' && <Ionicons name="checkmark" size={20} color="#D32F2F" />}
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => { setSortOption('open_first'); setIsSortModalOpen(false); }}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}
            >
              <Text style={{ fontSize: 16, color: sortOption === 'open_first' ? '#D32F2F' : '#1A1A1A', fontWeight: sortOption === 'open_first' ? '700' : '500' }}>Status (Open First)</Text>
              {sortOption === 'open_first' && <Ionicons name="checkmark" size={20} color="#D32F2F" />}
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => { setSortOption('closed_first'); setIsSortModalOpen(false); }}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 }}
            >
              <Text style={{ fontSize: 16, color: sortOption === 'closed_first' ? '#D32F2F' : '#1A1A1A', fontWeight: sortOption === 'closed_first' ? '700' : '500' }}>Status (Closed First)</Text>
              {sortOption === 'closed_first' && <Ionicons name="checkmark" size={20} color="#D32F2F" />}
            </TouchableOpacity>

          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
