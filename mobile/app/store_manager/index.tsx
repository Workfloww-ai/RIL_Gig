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
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';

// Worker data interface
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

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<'home' | 'requests' | 'insights' | 'profile'>('home');

  // Modal States
  const [isRaiseModalOpen, setIsRaiseModalOpen] = useState(false);
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<AcceptedWorker | null>(null);

  // Rating Form State
  const [ratingScore, setRatingScore] = useState<number>(5);
  const [selectedTags, setSelectedTags] = useState<string[]>(['On-Time Arrival', 'High Efficiency']);
  const [feedbackText, setFeedbackText] = useState<string>('');

  // Raise Request Form State
  const [requestStore, setRequestStore] = useState('Reliance Smart – Phoenix Marketcity');
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

  // Handle open rating modal for worker
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
    Alert.alert('Rating Submitted', 'Thank you! The worker has been rated and shift payout is approved.');
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
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* 1. Header Component (Blue Curved Bar) */}
      <View className="bg-blue-600 rounded-b-[28px] pt-10 pb-6 px-5 shadow-md">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-white tracking-tight">Hi, Rajesh Kumar</Text>
            <Text className="text-blue-100 text-xs font-medium mt-0.5">Reliance Smart – Phoenix Marketcity</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.replace('/')}
            className="bg-white/20 border border-white/30 rounded-full px-4 py-1.5 flex-row items-center"
          >
            <Text className="text-white text-xs font-semibold">Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* Header Stats Bar */}
        <View className="bg-blue-700/60 rounded-2xl p-4 flex-row justify-around items-center border border-blue-400/30 mt-5">
          <View className="items-center flex-1">
            <Ionicons name="people-outline" size={22} color="#ffffff" />
            <Text className="text-white text-2xl font-bold mt-1">{activeWorkersCount || 1}</Text>
            <Text className="text-blue-100 text-xs font-medium">Active</Text>
          </View>

          <View className="w-[1px] h-10 bg-blue-400/30" />

          <View className="items-center flex-1">
            <Ionicons name="checkmark-circle-outline" size={22} color="#ffffff" />
            <Text className="text-white text-2xl font-bold mt-1">{pendingReviewCount || 1}</Text>
            <Text className="text-blue-100 text-xs font-medium">Pending Review</Text>
          </View>
        </View>
      </View>

      {/* 2. Main Tab Body Content */}
      <ScrollView className="flex-1 px-5 pt-5" showsVerticalScrollIndicator={false}>
        {/* ==================== HOME TAB ==================== */}
        {activeTab === 'home' && (
          <View className="pb-28">
            {/* Section Header */}
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold text-gray-900 tracking-tight">Today's Gig Workers</Text>
              <TouchableOpacity
                onPress={() => setIsRaiseModalOpen(true)}
                className="bg-blue-600 px-4 py-2 rounded-xl flex-row items-center shadow-sm"
              >
                <Ionicons name="add" size={16} color="#ffffff" className="mr-1" />
                <Text className="text-white font-bold text-xs">+ Raise Request</Text>
              </TouchableOpacity>
            </View>

            {/* Jobs & Accepted Workers List */}
            {jobsList.map((job) => (
              <View key={job.id} className="mb-4">
                {/* Workers inside this job */}
                {job.acceptedWorkers.map((worker) => (
                  <View
                    key={worker.id}
                    className="bg-white rounded-2xl p-4 mb-3 border border-gray-100 shadow-sm"
                  >
                    {/* Worker Top Info Header */}
                    <View className="flex-row items-start justify-between">
                      <View className="flex-row items-center">
                        <View className="w-12 h-12 rounded-full overflow-hidden bg-blue-100 items-center justify-center mr-3 border border-gray-100">
                          {worker.avatarUrl ? (
                            <Image source={{ uri: worker.avatarUrl }} className="w-full h-full" />
                          ) : (
                            <Text className="text-blue-700 font-bold text-lg">{worker.name.charAt(0)}</Text>
                          )}
                        </View>
                        <View>
                          <Text className="font-bold text-gray-900 text-base">{worker.name}</Text>
                          <Text className="text-gray-500 text-xs mt-0.5">{worker.role}</Text>
                        </View>
                      </View>

                      {/* Status Badge */}
                      <View
                        className={`px-3 py-1 rounded-full ${
                          worker.status === 'Review Pending'
                            ? 'bg-amber-100'
                            : worker.status === 'En Route'
                            ? 'bg-purple-100'
                            : worker.status === 'Completed'
                            ? 'bg-emerald-100'
                            : 'bg-blue-100'
                        }`}
                      >
                        <Text
                          className={`text-xs font-bold ${
                            worker.status === 'Review Pending'
                              ? 'text-amber-800'
                              : worker.status === 'En Route'
                              ? 'text-purple-800'
                              : worker.status === 'Completed'
                              ? 'text-emerald-800'
                              : 'text-blue-800'
                          }`}
                        >
                          {worker.status}
                        </Text>
                      </View>
                    </View>

                    {/* ETA Sub-banner (if En Route) */}
                    {worker.etaText && (
                      <View className="bg-gray-50 rounded-xl p-3 mt-3 flex-row items-center border border-gray-100">
                        <Ionicons name="time-outline" size={16} color="#2563eb" className="mr-2" />
                        <Text className="text-gray-700 text-xs font-medium ml-1">
                          Arriving in <Text className="font-bold text-gray-900">15 mins</Text>
                        </Text>
                      </View>
                    )}

                    {/* 3-STEP ACCEPTANCE TIMELINE CONTAINER */}
                    <View className="mt-4 pt-3 border-t border-gray-100">
                      <Text className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2.5">
                        Worker Check-in Timeline (3 Acceptance Checkpoints)
                      </Text>

                      <View className="flex-row items-center justify-between bg-gray-50/80 p-3 rounded-xl border border-gray-100">
                        {/* Step 1: T-90 Mins */}
                        <View className="items-center flex-1">
                          <View className="w-7 h-7 rounded-full bg-emerald-100 items-center justify-center mb-1">
                            <Ionicons name="checkmark-sharp" size={14} color="#059669" />
                          </View>
                          <Text className="text-[11px] font-bold text-gray-900">90m Before</Text>
                          <Text className="text-[9px] text-gray-500 font-medium">{worker.acceptances.t90.expectedTime}</Text>
                          <Text className="text-[8px] text-emerald-600 font-bold mt-0.5">✓ Confirmed</Text>
                        </View>

                        {/* Line Divider */}
                        <View className="w-6 h-[2px] bg-emerald-300 -mt-3" />

                        {/* Step 2: T-60 Mins */}
                        <View className="items-center flex-1">
                          <View
                            className={`w-7 h-7 rounded-full items-center justify-center mb-1 ${
                              worker.acceptances.t60.status === 'DONE' ? 'bg-emerald-100' : 'bg-blue-100'
                            }`}
                          >
                            <Ionicons
                              name={worker.acceptances.t60.status === 'DONE' ? 'checkmark-sharp' : 'navigate-outline'}
                              size={14}
                              color={worker.acceptances.t60.status === 'DONE' ? '#059669' : '#2563eb'}
                            />
                          </View>
                          <Text className="text-[11px] font-bold text-gray-900">60m Before</Text>
                          <Text className="text-[9px] text-gray-500 font-medium">{worker.acceptances.t60.expectedTime}</Text>
                          <Text
                            className={`text-[8px] font-bold mt-0.5 ${
                              worker.acceptances.t60.status === 'DONE' ? 'text-emerald-600' : 'text-blue-600'
                            }`}
                          >
                            {worker.acceptances.t60.status === 'DONE' ? '✓ En Route' : 'Pending'}
                          </Text>
                        </View>

                        {/* Line Divider */}
                        <View
                          className={`w-6 h-[2px] -mt-3 ${
                            worker.acceptances.onArrival.status === 'DONE' ? 'bg-emerald-300' : 'bg-gray-200'
                          }`}
                        />

                        {/* Step 3: On Arrival */}
                        <View className="items-center flex-1">
                          <View
                            className={`w-7 h-7 rounded-full items-center justify-center mb-1 ${
                              worker.acceptances.onArrival.status === 'DONE'
                                ? 'bg-emerald-100'
                                : worker.acceptances.onArrival.status === 'IN_PROGRESS'
                                ? 'bg-amber-100'
                                : 'bg-gray-100'
                            }`}
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
                                  ? '#059669'
                                  : worker.acceptances.onArrival.status === 'IN_PROGRESS'
                                  ? '#d97706'
                                  : '#9ca3af'
                              }
                            />
                          </View>
                          <Text className="text-[11px] font-bold text-gray-900">On Arrival</Text>
                          <Text className="text-[9px] text-gray-500 font-medium">{worker.acceptances.onArrival.expectedTime}</Text>
                          <Text
                            className={`text-[8px] font-bold mt-0.5 ${
                              worker.acceptances.onArrival.status === 'DONE'
                                ? 'text-emerald-600'
                                : worker.acceptances.onArrival.status === 'IN_PROGRESS'
                                ? 'text-amber-600'
                                : 'text-gray-400'
                            }`}
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

                    {/* WORKER RATING ACTION BUTTON (When Shift Completed / Pending Review) */}
                    {worker.status === 'Review Pending' && (
                      <TouchableOpacity
                        onPress={() => handleOpenRating(worker)}
                        className="bg-blue-600 rounded-xl py-3 px-4 flex-row items-center justify-center mt-4 shadow-sm"
                      >
                        <Ionicons name="star" size={16} color="#fbbf24" className="mr-1.5" />
                        <Text className="text-white font-bold text-sm ml-1">Rate Worker & Approve Shift</Text>
                      </TouchableOpacity>
                    )}

                    {/* RATED STATUS SUMMARY (If already rated) */}
                    {worker.status === 'Completed' && worker.rating && (
                      <View className="bg-emerald-50 rounded-xl p-3 mt-3 border border-emerald-100 flex-row items-center justify-between">
                        <View className="flex-row items-center">
                          <Text className="text-emerald-800 text-sm font-bold mr-2">
                            {'★'.repeat(worker.rating.score)} {worker.rating.score}.0 Rated
                          </Text>
                        </View>
                        <Text className="text-emerald-700 text-xs font-semibold">Approved ✓</Text>
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
          <View className="pb-28">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold text-gray-900 tracking-tight">My Requests</Text>
              <TouchableOpacity
                onPress={() => setIsRaiseModalOpen(true)}
                className="bg-blue-600 px-4 py-2 rounded-xl flex-row items-center shadow-sm"
              >
                <Text className="text-white font-bold text-xs">+ New Request</Text>
              </TouchableOpacity>
            </View>

            {jobsList.map((job) => (
              <View key={job.id} className="bg-white rounded-2xl p-5 mb-4 border border-gray-100 shadow-sm">
                <View className="flex-row justify-between items-start mb-1">
                  <Text className="font-bold text-gray-900 text-lg flex-1 mr-2">{job.title}</Text>
                  <View
                    className={`px-3 py-1 rounded-full ${
                      job.status === 'Pending Approval' ? 'bg-amber-100' : 'bg-emerald-100'
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        job.status === 'Pending Approval' ? 'text-amber-800' : 'text-emerald-800'
                      }`}
                    >
                      {job.status}
                    </Text>
                  </View>
                </View>

                <Text className="text-gray-500 text-xs font-medium mb-3">{job.shiftTime}</Text>

                <View className="bg-gray-50/80 rounded-xl p-4 flex-row justify-between items-center border border-gray-100">
                  <View>
                    <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">Workers</Text>
                    <Text className="text-gray-900 font-bold text-base">{job.workersNeeded} Needed</Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">Compensation</Text>
                    <Text className="text-gray-900 font-bold text-base">₹{job.compensation}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ==================== INSIGHTS TAB ==================== */}
        {activeTab === 'insights' && (
          <View className="pb-28">
            <Text className="text-xl font-bold text-gray-900 tracking-tight mb-4">Store Performance Insights</Text>

            <View className="flex-row flex-wrap justify-between">
              <View className="bg-white w-[48%] rounded-2xl p-4 mb-4 border border-gray-100 shadow-sm">
                <Text className="text-gray-400 text-[10px] font-bold uppercase mb-1">Total Gig Hours</Text>
                <Text className="text-2xl font-bold text-gray-900">148 hrs</Text>
                <Text className="text-emerald-600 text-[10px] font-semibold mt-1">↑ +12% vs last month</Text>
              </View>

              <View className="bg-white w-[48%] rounded-2xl p-4 mb-4 border border-gray-100 shadow-sm">
                <Text className="text-gray-400 text-[10px] font-bold uppercase mb-1">On-Time Arrival</Text>
                <Text className="text-2xl font-bold text-gray-900">98.5%</Text>
                <Text className="text-emerald-600 text-[10px] font-semibold mt-1">Top 5% in Region</Text>
              </View>

              <View className="bg-white w-[48%] rounded-2xl p-4 mb-4 border border-gray-100 shadow-sm">
                <Text className="text-gray-400 text-[10px] font-bold uppercase mb-1">Avg Worker Rating</Text>
                <Text className="text-2xl font-bold text-gray-900">4.9 / 5.0</Text>
                <Text className="text-amber-500 text-[10px] font-semibold mt-1">⭐⭐⭐⭐⭐</Text>
              </View>

              <View className="bg-white w-[48%] rounded-2xl p-4 mb-4 border border-gray-100 shadow-sm">
                <Text className="text-gray-400 text-[10px] font-bold uppercase mb-1">Monthly Payout</Text>
                <Text className="text-2xl font-bold text-gray-900">₹29,600</Text>
                <Text className="text-gray-500 text-[10px] font-semibold mt-1">100% On-time Payment</Text>
              </View>
            </View>
          </View>
        )}

        {/* ==================== PROFILE TAB ==================== */}
        {activeTab === 'profile' && (
          <View className="pb-28">
            <Text className="text-xl font-bold text-gray-900 tracking-tight mb-4">Manager Profile</Text>

            <View className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm items-center mb-5">
              <View className="w-20 h-20 rounded-full bg-blue-100 items-center justify-center mb-3 border-2 border-blue-50">
                <Text className="text-blue-700 text-3xl font-bold">RK</Text>
              </View>
              <Text className="text-2xl font-bold text-gray-900">Rajesh Kumar</Text>
              <Text className="text-blue-600 text-xs font-bold mt-0.5">Store Manager</Text>
              <Text className="text-gray-500 text-xs mt-1">Reliance Smart – Phoenix Marketcity</Text>
            </View>

            <View className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-5">
              <TouchableOpacity className="py-3 flex-row items-center justify-between border-b border-gray-100">
                <Text className="text-gray-800 font-semibold text-sm">Store Settings & Locations</Text>
                <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
              </TouchableOpacity>

              <TouchableOpacity className="py-3 flex-row items-center justify-between border-b border-gray-100">
                <Text className="text-gray-800 font-semibold text-sm">Gig Worker Escalations</Text>
                <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
              </TouchableOpacity>

              <TouchableOpacity className="py-3 flex-row items-center justify-between">
                <Text className="text-gray-800 font-semibold text-sm">Help & Support</Text>
                <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => router.replace('/')}
              className="bg-red-50 border border-red-100 rounded-2xl py-4 items-center"
            >
              <Text className="text-red-600 font-bold text-base">Sign Out</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* 3. Bottom Navigation Bar */}
      <View className="bg-white border-t border-gray-100 flex-row justify-around py-3 px-2 absolute bottom-0 left-0 right-0 shadow-lg">
        <TouchableOpacity onPress={() => setActiveTab('home')} className="items-center flex-1">
          <Ionicons
            name={activeTab === 'home' ? 'home' : 'home-outline'}
            size={22}
            color={activeTab === 'home' ? '#2563eb' : '#9ca3af'}
          />
          <Text className={`text-[11px] mt-1 font-semibold ${activeTab === 'home' ? 'text-blue-600' : 'text-gray-400'}`}>
            Home
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setActiveTab('requests')} className="items-center flex-1">
          <Ionicons
            name={activeTab === 'requests' ? 'clipboard' : 'clipboard-outline'}
            size={22}
            color={activeTab === 'requests' ? '#2563eb' : '#9ca3af'}
          />
          <Text
            className={`text-[11px] mt-1 font-semibold ${
              activeTab === 'requests' ? 'text-blue-600' : 'text-gray-400'
            }`}
          >
            Requests
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setActiveTab('insights')} className="items-center flex-1">
          <Ionicons
            name={activeTab === 'insights' ? 'bar-chart' : 'bar-chart-outline'}
            size={22}
            color={activeTab === 'insights' ? '#2563eb' : '#9ca3af'}
          />
          <Text
            className={`text-[11px] mt-1 font-semibold ${
              activeTab === 'insights' ? 'text-blue-600' : 'text-gray-400'
            }`}
          >
            Insights
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setActiveTab('profile')} className="items-center flex-1">
          <Ionicons
            name={activeTab === 'profile' ? 'person' : 'person-outline'}
            size={22}
            color={activeTab === 'profile' ? '#2563eb' : '#9ca3af'}
          />
          <Text
            className={`text-[11px] mt-1 font-semibold ${activeTab === 'profile' ? 'text-blue-600' : 'text-gray-400'}`}
          >
            Profile
          </Text>
        </TouchableOpacity>
      </View>

      {/* ==================== WORKER RATING MODAL ==================== */}
      <Modal visible={isRatingModalOpen} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-[32px] p-6">
            {/* Modal Header */}
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold text-gray-900">Rate Worker Performance</Text>
              <TouchableOpacity onPress={() => setIsRatingModalOpen(false)} className="p-1">
                <Ionicons name="close-circle-outline" size={28} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            {/* Selected Worker Header */}
            {selectedWorker && (
              <View className="bg-gray-50 rounded-2xl p-4 mb-5 flex-row items-center border border-gray-100">
                <View className="w-12 h-12 rounded-full overflow-hidden bg-blue-100 items-center justify-center mr-3">
                  {selectedWorker.avatarUrl ? (
                    <Image source={{ uri: selectedWorker.avatarUrl }} className="w-full h-full" />
                  ) : (
                    <Text className="text-blue-700 font-bold text-lg">{selectedWorker.name.charAt(0)}</Text>
                  )}
                </View>
                <View>
                  <Text className="font-bold text-gray-900 text-base">{selectedWorker.name}</Text>
                  <Text className="text-gray-500 text-xs">{selectedWorker.role}</Text>
                </View>
              </View>
            )}

            {/* Star Selector */}
            <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 text-center">
              Tap stars to rate worker
            </Text>
            <View className="flex-row justify-center items-center space-x-2 mb-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setRatingScore(star)} className="px-1.5 py-1">
                  <Ionicons
                    name={star <= ratingScore ? 'star' : 'star-outline'}
                    size={36}
                    color={star <= ratingScore ? '#fbbf24' : '#d1d5db'}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <Text className="text-center text-sm font-bold text-blue-600 mb-5">
              {ratingScore === 5
                ? '★ 5.0 - Excellent Performance!'
                : ratingScore === 4
                ? '★ 4.0 - Very Good Work'
                : ratingScore === 3
                ? '★ 3.0 - Good Effort'
                : '★ Needs Improvement'}
            </Text>

            {/* Performance Metric Tags */}
            <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Highlights & Strengths</Text>
            <View className="flex-row flex-wrap mb-5">
              {['On-Time Arrival', 'High Efficiency', 'Great Attitude', 'Followed Instructions', 'Kept Store Clean'].map(
                (tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <TouchableOpacity
                      key={tag}
                      onPress={() => toggleTag(tag)}
                      className={`mr-2 mb-2 px-3 py-2 rounded-xl border ${
                        isSelected
                          ? 'bg-blue-50 border-blue-600 text-blue-700'
                          : 'bg-gray-50 border-gray-200 text-gray-600'
                      }`}
                    >
                      <Text className={`text-xs font-semibold ${isSelected ? 'text-blue-700' : 'text-gray-600'}`}>
                        {isSelected ? '✓ ' : ''}
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  );
                }
              )}
            </View>

            {/* Optional Feedback Input */}
            <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Manager Comments (Optional)</Text>
            <TextInput
              placeholder="Add optional notes about the worker's shift..."
              placeholderTextColor="#9ca3af"
              value={feedbackText}
              onChangeText={setFeedbackText}
              multiline
              numberOfLines={3}
              className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm text-gray-900 mb-6 min-h-[70px]"
            />

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleSubmitRating}
              className="bg-blue-600 py-4 rounded-xl items-center shadow-sm"
            >
              <Text className="text-white font-bold text-base">Submit Rating & Approve Payout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ==================== RAISE MANPOWER REQUEST MODAL ==================== */}
      <Modal visible={isRaiseModalOpen} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-[32px] p-6">
            {/* Modal Header */}
            <View className="flex-row justify-between items-center mb-5">
              <Text className="text-xl font-bold text-gray-900">Raise Manpower Request</Text>
              <TouchableOpacity onPress={() => setIsRaiseModalOpen(false)} className="p-1">
                <Ionicons name="close-circle-outline" size={28} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            {/* Form Fields */}
            <ScrollView showsVerticalScrollIndicator={false} className="max-h-[500px]">
              {/* Store Field */}
              <View className="mb-4">
                <Text className="text-xs font-bold text-gray-600 mb-1.5">Store</Text>
                <TextInput
                  value={requestStore}
                  editable={false}
                  className="bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 font-medium"
                />
              </View>

              {/* Grid 1: Date & Role */}
              <View className="flex-row space-x-3 mb-4">
                <View className="flex-1 mr-1">
                  <Text className="text-xs font-bold text-gray-600 mb-1.5">Date</Text>
                  <TextInput
                    value={requestDate}
                    onChangeText={setRequestDate}
                    placeholder="dd/mm/yyyy"
                    className="bg-white border border-gray-300 rounded-xl px-3 py-3 text-sm text-gray-900"
                  />
                </View>

                <View className="flex-1 ml-1">
                  <Text className="text-xs font-bold text-gray-600 mb-1.5">Role</Text>
                  <TextInput
                    value={requestRole}
                    onChangeText={setRequestRole}
                    placeholder="Select a role..."
                    className="bg-white border border-gray-300 rounded-xl px-3 py-3 text-sm text-gray-900"
                  />
                </View>
              </View>

              {/* Grid 2: Start Time & Hours */}
              <View className="flex-row space-x-3 mb-4">
                <View className="flex-1 mr-1">
                  <Text className="text-xs font-bold text-gray-600 mb-1.5">Start Time</Text>
                  <TextInput
                    value={requestStartTime}
                    onChangeText={setRequestStartTime}
                    placeholder="--:-- --"
                    className="bg-white border border-gray-300 rounded-xl px-3 py-3 text-sm text-gray-900"
                  />
                </View>

                <View className="flex-1 ml-1">
                  <Text className="text-xs font-bold text-gray-600 mb-1.5">How many hours?</Text>
                  <TextInput
                    value={requestHours}
                    onChangeText={setRequestHours}
                    keyboardType="numeric"
                    className="bg-white border border-gray-300 rounded-xl px-3 py-3 text-sm text-gray-900"
                  />
                </View>
              </View>

              {/* Grid 3: Number of Workers & Compensation */}
              <View className="flex-row space-x-3 mb-6">
                <View className="flex-1 mr-1">
                  <Text className="text-xs font-bold text-gray-600 mb-1.5">Number of Workers</Text>
                  <TextInput
                    value={requestNumWorkers}
                    onChangeText={setRequestNumWorkers}
                    keyboardType="numeric"
                    className="bg-white border border-gray-300 rounded-xl px-3 py-3 text-sm text-gray-900"
                  />
                </View>

                <View className="flex-1 ml-1">
                  <Text className="text-xs font-bold text-gray-600 mb-1.5">Compensation (Fixed ₹)</Text>
                  <TextInput
                    value={requestCompensation}
                    onChangeText={setRequestCompensation}
                    keyboardType="numeric"
                    placeholder="Auto-set by role"
                    className="bg-gray-50 border border-gray-300 rounded-xl px-3 py-3 text-sm text-gray-900 font-semibold"
                  />
                </View>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                onPress={handlePublishRequest}
                className="bg-blue-600 py-4 rounded-xl items-center shadow-md mb-4"
              >
                <Text className="text-white font-bold text-base">Publish to Worker Pool</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
