import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, SafeAreaView, Platform, StatusBar, ScrollView, TouchableOpacity, ActivityIndicator, Image, Modal, BackHandler, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { apiClient } from '../src/api/client';
import { Button } from '../src/components/Button';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

interface Module {
 id: string;
 title: string;
 category_name: string;
 duration_text: string;
 video_url: string;
 podcast_url: string;
 overview_text: string;
 key_module_topics: string[];
 order_index: number;
 status: string;
 highest_quiz_score: number;
 completed_at?: string;
}

export default function LibraryScreen() {
 const router = useRouter();
 const { justCompleted } = useLocalSearchParams();
 const insets = useSafeAreaInsets();

 const [modules, setModules] = useState<Module[]>([]);
 const [userProfile, setUserProfile] = useState<{ first_name: string, last_name: string } | null>(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState('');

 const [activeTab, setActiveTab] = useState<'modules' | 'certificate' | 'jobs'>('modules');
 const [showCongrats, setShowCongrats] = useState(false);
 const [toastMessage, setToastMessage] = useState('');

 const certificateRef = React.useRef<ViewShot>(null);

 const shareCertificate = async () => {
 try {
 if (certificateRef.current && certificateRef.current.capture) {
 const uri = await certificateRef.current.capture();
 const isAvailable = await Sharing.isAvailableAsync();

 if (isAvailable) {
 await Sharing.shareAsync(uri, {
 UTI: 'public.png',
 mimeType: 'image/png',
 dialogTitle: 'Save or Share Certificate'
 });
 } else {
 showToast('Sharing is not available on this device');
 }
 }
 } catch (error) {
 console.error('Failed to capture certificate', error);
 showToast('Failed to prepare certificate image');
 }
 };

 const [jobsTab, setJobsTab] = useState<'available' | 'accepted'>('available');
 const [availableJobs, setAvailableJobs] = useState<any[]>([]);
 const [acceptedJobs, setAcceptedJobs] = useState<any[]>([]);
 const [jobsLoading, setJobsLoading] = useState(false);
 const [acceptingJobId, setAcceptingJobId] = useState<string | null>(null);
 
 const [expandedSections, setExpandedSections] = useState({
   today: true,
   upcoming: false,
   past: false
 });

 const toggleSection = (section: 'today' | 'upcoming' | 'past') => {
   setExpandedSections(prev => ({
     ...prev,
     [section]: !prev[section]
   }));
 };

 const handleAcceptJob = async (request_id: string) => {
 setAcceptingJobId(request_id);
 try {
 await apiClient.post(`/jobs/accept/${request_id}`);
 showToast('Job accepted successfully!');
 fetchJobs();
 } catch (err: any) {
 showToast(err.response?.data?.detail || 'Failed to accept job');
 } finally {
 setAcceptingJobId(null);
 }
 };

 const [cancellingJobId, setCancellingJobId] = useState<string | null>(null);

 const handleCancelJob = async (request_id: string) => {
 setCancellingJobId(request_id);
 try {
 await apiClient.delete(`/jobs/cancel/${request_id}`);
 showToast('Job cancelled successfully!');
 fetchJobs();
 } catch (err: any) {
 showToast(err.response?.data?.detail || 'Failed to cancel job');
 } finally {
 setCancellingJobId(null);
 }
 };

 const [checkingInId, setCheckingInId] = useState<string | null>(null);

 const handleCheckIn = async (request_id: string, step: 't90' | 't60' | 'arrival') => {
 setCheckingInId(`${request_id}-${step}`);
 try {
 await apiClient.post(`/jobs/confirm/${request_id}`, { step });
 showToast(`Checked in for ${step === 'arrival' ? 'Arrival' : step === 't60' ? '60 mins' : '90 mins'}!`);
 if (step === 'arrival') {
 await handleStartOtp(request_id);
 }
 fetchJobs();
 } catch (err: any) {
 showToast(err.response?.data?.detail || 'Failed to check in');
 } finally {
 setCheckingInId(null);
 }
 };

 const [generatingOtpId, setGeneratingOtpId] = useState<string | null>(null);
 const [startOtps, setStartOtps] = useState<Record<string, string>>({});

 const handleStartOtp = async (request_id: string) => {
 setGeneratingOtpId(request_id);
 try {
 const res = await apiClient.post(`/jobs/accept/${request_id}/start-otp`);
 if (res.data && res.data.otp_code) {
 setStartOtps(prev => ({ ...prev, [request_id]: res.data.otp_code }));
 showToast('Start OTP generated successfully! Show this to store manager.');
 }
 } catch (err: any) {
 showToast(err.response?.data?.detail || 'Failed to generate OTP');
 } finally {
 setGeneratingOtpId(null);
 }
 };

 const getStepState = (status: string, shift_date: string, start_time: string, step: 't90' | 't60' | 'arrival') => {
 if (status === 'confirmed' || status === 'arrived') return 'confirmed';

 // shift_date is YYYY-MM-DD
 // start_time is HH:MM:SS
 const shiftDateTime = new Date(`${shift_date}T${start_time}`);
 const now = new Date();

 // Difference in minutes
 const diffMs = shiftDateTime.getTime() - now.getTime();
 const diffMins = Math.floor(diffMs / 60000);

 if (step === 't90') {
 if (diffMins > 100) return 'locked';
 if (diffMins <= 100 && diffMins > 90) return 'active';
 return 'missed';
 }
 if (step === 't60') {
 if (diffMins > 70) return 'locked';
 if (diffMins <= 70 && diffMins > 60) return 'active';
 return 'missed';
 }
 if (step === 'arrival') {
 if (diffMins > 10) return 'locked';
 if (diffMins <= 10 && diffMins >= 0) return 'active'; // Give them 10 mins prior to arrive
 return 'missed';
 }
 return 'locked';
 };

 const isCurrentlyRunning = (shift_date: string, start_time: string, hours_duration: number) => {
 const shiftDateTime = new Date(`${shift_date}T${start_time}`);
 const endDateTime = new Date(shiftDateTime.getTime() + hours_duration * 60 * 60 * 1000);
 const now = new Date();
 return now <= endDateTime;
 };

 const isBeforeStart = (shift_date: string, start_time: string) => {
 const shiftDateTime = new Date(`${shift_date}T${start_time}`);
 const now = new Date();
 return now <= shiftDateTime;
 };

 const canCancelJob = (shift_date: string, start_time: string) => {
 const shiftDateTime = new Date(`${shift_date}T${start_time}`);
 const now = new Date();
 const diffMs = shiftDateTime.getTime() - now.getTime();
 return diffMs > 90 * 60 * 1000;
 };

 const showToast = (msg: string) => {
 setToastMessage(msg);
 setTimeout(() => {
 setToastMessage('');
 }, 2500);
 };

 useFocusEffect(
 useCallback(() => {
 const onBackPress = () => {
 BackHandler.exitApp();
 return true;
 };

 const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

 return () => subscription.remove();
 }, [])
 );

 useEffect(() => {
 const fetchData = async () => {
 try {
 const [modulesRes, profileRes] = await Promise.all([
 apiClient.get('/content/modules'),
 apiClient.get('/auth/me').catch(() => ({ data: null }))
 ]);
 setModules(modulesRes.data);
 if (profileRes?.data) setUserProfile(profileRes.data);
 } catch (err: any) {
 console.error('Failed to fetch modules:', err);
 setError('Failed to load content modules.');
 } finally {
 setLoading(false);
 }
 };

 fetchData();
 }, []);

 const handleStartLesson = (moduleId: string) => {
 router.push({ pathname: '/studio', params: { id: moduleId } });
 };

 const completedCount = modules.filter(m => m.status === 'quiz_passed').length;
 const totalCount = modules.length;
 const completionPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
 const isAllCompleted = totalCount > 0 && completedCount === totalCount;

 const fetchJobs = async () => {
 setJobsLoading(true);
 try {
 if (jobsTab === 'available') {
 const res = await apiClient.get('/jobs/available');
 setAvailableJobs(res.data.jobs || []);
 } else {
 const res = await apiClient.get('/jobs/accepted');
 setAcceptedJobs(res.data.jobs || []);
 }
 } catch (err) {
 console.error("Failed to fetch jobs:", err);
 } finally {
 setJobsLoading(false);
 }
 };

 useEffect(() => {
 if (activeTab === 'jobs' && isAllCompleted) {
 fetchJobs();
 }
 }, [activeTab, isAllCompleted, jobsTab]);

 useEffect(() => {
 if (justCompleted === 'true' && isAllCompleted) {
 setShowCongrats(true);
 }
 }, [justCompleted, isAllCompleted]);

  const todayStr = new Date().toISOString().split('T')[0];
  const todayAcceptedJobs = acceptedJobs.filter(job => job.shift_date === todayStr);
  const upcomingAcceptedJobs = acceptedJobs.filter(job => job.shift_date > todayStr);
  const pastAcceptedJobs = acceptedJobs.filter(job => job.shift_date < todayStr);

 const renderAcceptedJobCard = (job: any) => {
 return (
 <View key={job.request_id} className="bg-cream rounded-3xl p-5 mb-5 shadow-sm border border-sage/10">
 <View className="flex-row justify-between items-start mb-4">
 <View className="flex-1 pr-4">
 <View className="bg-moss/10 self-start px-3 py-1.5 rounded-full mb-3 flex-row items-center border border-moss/20">
 <Feather name="briefcase" size={12} color="#0B5B31" style={{ marginRight: 6 }} />
 <Text className="text-moss text-[10px] font-bold tracking-wider uppercase">{job.job_name}</Text>
 </View>
 <Text className="font-bold text-charcoal text-lg leading-tight mb-1.5">{job.store_name}</Text>
 <View className="flex-row items-start">
 <Feather name="map-pin" size={12} color="#6B7280" style={{ marginTop: 2, marginRight: 4 }} />
 <Text className="text-muted text-xs flex-1 leading-relaxed">{job.address}{job.city ? `, ${job.city}` : ''}</Text>
 </View>
 </View>
 <View className="bg-clay px-3 py-2.5 rounded-2xl items-center min-w-[75px] shadow-sm">
 <Text className="text-white font-bold text-xl">₹{job.base_compensation * job.hours_duration}</Text>
 <Text className="text-white text-[9px] font-bold uppercase tracking-wider mt-0.5">{job.hours_duration} {job.hours_duration == 1 ? "Hour" : "Hours"}</Text>
 </View>
 </View>

 <View className="flex-row bg-sand rounded-2xl p-3.5 mb-2 border border-sage/10 justify-around shadow-sm">
 <View className="items-center">
 <Text className="text-sage text-[9px] uppercase font-bold tracking-widest mb-1.5">Date</Text>
 <View className="flex-row items-center">
 <Feather name="calendar" size={12} color="#666666" style={{ marginRight: 5 }} />
 <Text className="text-slate font-semibold text-xs">{job.shift_date}</Text>
 </View>
 </View>
 <View className="w-[1px] bg-sage/20 h-full" />
 <View className="items-center">
 <Text className="text-sage text-[9px] uppercase font-bold tracking-widest mb-1.5">Time</Text>
 <View className="flex-row items-center">
 <Feather name="clock" size={12} color="#666666" style={{ marginRight: 5 }} />
 <Text className="text-slate font-semibold text-xs">{job.start_time.substring(0, 5)}</Text>
 </View>
 </View>
 <View className="w-[1px] bg-sage/20 h-full" />
 <View className="items-center">
 <Text className="text-sage text-[9px] uppercase font-bold tracking-widest mb-1.5">Status</Text>
 <View className="flex-row items-center">
 {(() => {
   let statusText = job.assignment_status.toUpperCase();
   let iconName = "check-circle";
   let textColor = "text-moss";
   let iconColor = "#10B981";

   if (job.assignment_status === 'accepted' && !isBeforeStart(job.shift_date, job.start_time)) {
     statusText = "NO SHOW";
     iconName = "x-circle";
     textColor = "text-clay";
     iconColor = "#D32F2F";
   } else if (job.assignment_status === 'started') {
     iconName = "play-circle";
     textColor = "text-blue-600";
     iconColor = "#0B5B31";
   } else if (job.assignment_status === 'cancelled') {
     iconName = "x-circle";
     textColor = "text-muted";
     iconColor = "#6B7280";
   }

   return (
     <>
       <Feather name={iconName as any} size={12} color={iconColor} style={{ marginRight: 5 }} />
       <Text className={`${textColor} font-bold text-xs uppercase`}>{statusText}</Text>
     </>
   );
 })()}
 </View>
 </View>
 </View>

 {job.assignment_status === 'accepted' && job.arrival_status !== 'arrived' && (() => {
 const t90State = getStepState(job.t90_status, job.shift_date, job.start_time, 't90');
 const t60State = getStepState(job.t60_status, job.shift_date, job.start_time, 't60');
 const arrivalState = getStepState(job.arrival_status, job.shift_date, job.start_time, 'arrival');
 return (
 <View className="mb-3 border border-sage/10 rounded-2xl bg-cream p-3">
 <Text className="text-sage text-[10px] font-bold uppercase tracking-wider mb-2">Check-in Process</Text>
 <View className="flex-row justify-between items-start">

 {/* T-90 */}
 <View className="items-center w-[30%]">
 <View className={`w-7 h-7 rounded-full items-center justify-center mb-1 ${t90State === 'confirmed' ? 'bg-moss/10' : t90State === 'missed' ? 'bg-clay/10' : 'bg-sage/10'}`}>
 <Feather name={t90State === 'confirmed' ? 'check' : t90State === 'missed' ? 'x' : 'clock'} size={14} color={t90State === 'confirmed' ? '#10B981' : t90State === 'missed' ? '#D32F2F' : '#9CA3AF'} />
 </View>
 <Text className="text-[9px] font-bold text-slate text-center">{t90State === 'missed' ? 'Missed' : '90m Before'}</Text>
 {t90State === 'active' && (
 <TouchableOpacity
 onPress={() => handleCheckIn(job.request_id, 't90')}
 disabled={checkingInId !== null}
 className="bg-moss px-2 py-1.5 rounded mt-1.5 w-full items-center"
 >
 {checkingInId === `${job.request_id}-t90` ? (
 <ActivityIndicator size="small" color="#FFFFFF" />
 ) : (
 <Text className="text-[8px] text-white font-bold uppercase">Confirm</Text>
 )}
 </TouchableOpacity>
 )}
 </View>

 <View className={`h-[2px] flex-1 mt-3 mx-1 ${t90State === 'confirmed' ? 'bg-moss/50' : 'bg-sage/20'}`} />

 {/* T-60 */}
 <View className="items-center w-[30%]">
 <View className={`w-7 h-7 rounded-full items-center justify-center mb-1 ${t60State === 'confirmed' ? 'bg-moss/10' : t60State === 'missed' ? 'bg-clay/10' : 'bg-sage/10'}`}>
 <Feather name={t60State === 'confirmed' ? 'check' : t60State === 'missed' ? 'x' : 'navigation'} size={14} color={t60State === 'confirmed' ? '#10B981' : t60State === 'missed' ? '#D32F2F' : '#9CA3AF'} />
 </View>
 <Text className="text-[9px] font-bold text-slate text-center">{t60State === 'missed' ? 'Missed' : '60m Before'}</Text>
 {t90State !== 'locked' && t60State === 'active' && (
 <TouchableOpacity
 onPress={() => handleCheckIn(job.request_id, 't60')}
 disabled={checkingInId !== null}
 className="bg-moss px-2 py-1.5 rounded mt-1.5 w-full items-center"
 >
 {checkingInId === `${job.request_id}-t60` ? (
 <ActivityIndicator size="small" color="#FFFFFF" />
 ) : (
 <Text className="text-[8px] text-white font-bold uppercase">En Route</Text>
 )}
 </TouchableOpacity>
 )}
 </View>

 <View className={`h-[2px] flex-1 mt-3 mx-1 ${t60State === 'confirmed' ? 'bg-moss/50' : 'bg-sage/20'}`} />

 {/* Arrival */}
 <View className="items-center w-[30%]">
 <View className={`w-7 h-7 rounded-full items-center justify-center mb-1 ${arrivalState === 'confirmed' ? 'bg-moss/10' : arrivalState === 'missed' ? 'bg-clay/10' : 'bg-sage/10'}`}>
 <Feather name={arrivalState === 'confirmed' ? 'check' : arrivalState === 'missed' ? 'x' : 'map-pin'} size={14} color={arrivalState === 'confirmed' ? '#10B981' : arrivalState === 'missed' ? '#D32F2F' : '#9CA3AF'} />
 </View>
 <Text className="text-[9px] font-bold text-slate text-center">{arrivalState === 'missed' ? 'Missed' : 'On Arrival'}</Text>
 {t60State !== 'locked' && arrivalState === 'active' && (
 <TouchableOpacity
 onPress={() => handleCheckIn(job.request_id, 'arrival')}
 disabled={checkingInId !== null}
 className="bg-moss px-2 py-1.5 rounded mt-1.5 w-full items-center"
 >
 {checkingInId === `${job.request_id}-arrival` ? (
 <ActivityIndicator size="small" color="#FFFFFF" />
 ) : (
 <Text className="text-[8px] text-white font-bold uppercase">Arrived</Text>
 )}
 </TouchableOpacity>
 )}
 </View>

 </View>
 </View>
 );
 })()}

        {job.arrival_status === 'arrived' && job.assignment_status === 'accepted' && isBeforeStart(job.shift_date, job.start_time) && (
          <View className="mt-3 bg-moss/5 border border-moss/20 p-3 rounded-xl items-center">
            {startOtps[job.request_id] ? (
              <View className="items-center">
                <Text className="text-muted text-xs mb-1">Your Start OTP</Text>
                <Text className="text-2xl font-black text-green-700 tracking-widest">{startOtps[job.request_id]}</Text>
                <Text className="text-muted text-[10px] mt-1 text-center">Show this code to the store manager to start your shift.</Text>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => handleStartOtp(job.request_id)}
                disabled={generatingOtpId === job.request_id}
                className="bg-moss w-full py-3 rounded-lg items-center flex-row justify-center"
              >
                {generatingOtpId === job.request_id ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Feather name="key" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text className="text-white font-bold">Start Job (Get OTP)</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {job.arrival_status === 'arrived' && job.assignment_status === 'started' && (
          <View className="mt-3 bg-moss/5 border border-moss/20 p-4 rounded-xl items-center shadow-sm">
            <View className="bg-moss/10 p-2 rounded-full mb-2">
              <Feather name="check-circle" size={28} color="#15803D" />
            </View>
            <Text className="text-xl font-black text-moss">Verified</Text>
            {/* <Text className="text-moss text-[11px] mt-1 text-center font-medium">Your shift has officially begun. Great job!</Text> */}
          </View>
        )}

        {job.assignment_status === 'completed' && job.rating_score && (
          <View className="mt-3 bg-green-50 border border-green-200 p-4 rounded-xl items-center shadow-sm">
            <Text className="text-muted text-[10px] uppercase font-bold tracking-wider mb-2">Manager Rating</Text>
            <View className="flex-row mb-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <Feather 
                  key={star} 
                  name="star" 
                  size={20} 
                  color={star <= job.rating_score ? "#EAB308" : "#D1D5DB"} 
                  style={{ marginRight: 4 }} 
                  fill={star <= job.rating_score ? "#EAB308" : "transparent"}
                />
              ))}
            </View>
            <Text className="text-xl font-black text-moss mb-2">{job.rating_score}.0 / 5.0</Text>
            
            {job.rating_tags && job.rating_tags.length > 0 && (
              <View className="flex-row flex-wrap justify-center mt-1">
                {job.rating_tags.map((tag: string, idx: number) => (
                  <View key={idx} className="bg-cream border border-moss/20 px-2 py-1 rounded-md m-1">
                    <Text className="text-moss text-[10px] font-bold">{tag}</Text>
                  </View>
                ))}
              </View>
            )}
            
            {job.rating_feedback ? (
              <Text className="text-muted text-xs text-center mt-3 italic">"{job.rating_feedback}"</Text>
            ) : null}
          </View>
        )}

 {job.assignment_status === 'accepted' && canCancelJob(job.shift_date, job.start_time) && (
 <TouchableOpacity
 onPress={() => handleCancelJob(job.request_id)}
 disabled={cancellingJobId !== null && cancellingJobId !== job.request_id}
 className="mt-2 bg-clay/10 border border-red-200 py-3 rounded-xl items-center flex-row justify-center"
 >
 {cancellingJobId === job.request_id ? (
 <ActivityIndicator size="small" color="#D32F2F" />
 ) : (
 <>
 <Feather name="x-circle" size={16} color="#D32F2F" style={{ marginRight: 6 }} />
 <Text className="text-clay font-bold">Cancel Job</Text>
 </>
 )}
 </TouchableOpacity>
 )}
 </View>
 );
 };

 return (
 <SafeAreaView style={{ flex: 1 }} className="flex-1 bg-sand">
 <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }} className="flex-1" showsVerticalScrollIndicator={false} bounces={false}>

 {/* Header Area */}
 <View style={{ backgroundColor: '#10472B', borderBottomLeftRadius: 28, borderBottomRightRadius: 28, paddingTop: 40, paddingBottom: 16, paddingHorizontal: 24 }}>
 <View className="flex-row justify-between items-center mb-6">
 <View className="flex-row items-center">
 <TouchableOpacity
 onPress={() => router.push('/profile')}
 className="bg-cream h-10 w-10 rounded-full items-center justify-center mr-3 shadow-sm"
 >
 <Text className="text-moss font-bold text-xl">{userProfile?.first_name?.charAt(0).toUpperCase() || 'L'}</Text>
 </TouchableOpacity>
 <View>
 <Text className="text-white font-bold text-xl leading-tight">Hi, {userProfile?.first_name?.charAt(0).toUpperCase() + userProfile?.first_name?.slice(1).toLowerCase() || 'User'}</Text>
 <Text className="text-sand text-xs">Sahyogi</Text>
 </View>
 </View>
 </View>


 </View>

 <View className="px-5 pt-6 pb-20">
 {activeTab === 'modules' && (
 <View>
 {/* Dashboard Progress Card */}
 <View className="bg-moss rounded-3xl p-6 mb-8 shadow-sm">
 <View className="flex-row justify-between items-center mb-6">
 <View className="flex-row items-center">
 <View className="h-12 w-12 rounded-full bg-moss/80 items-center justify-center border border-primary-400 mr-3">
 <Text className="text-white text-lg font-bold">{userProfile?.first_name?.charAt(0).toUpperCase() || 'U'}</Text>
 </View>
 <View>
 <Text className="text-primary-200 text-xs font-semibold tracking-wider">CANDIDATE DASHBOARD</Text>
 <Text className="text-white text-xl font-bold">{userProfile ? `${userProfile.first_name} ${userProfile.last_name}`.toUpperCase() : 'Loading...'}</Text>
 </View>
 </View>

 </View>

 <View className="mb-2 flex-row justify-between">
 <Text className="text-white font-semibold"> Module Completion</Text>
 <Text className="text-white font-bold">{completedCount} of {totalCount} ({completionPercent}%)</Text>
 </View>
 <View className="h-2 bg-primary-800 rounded-full mb-4 overflow-hidden flex-row">
 <View className="h-full bg-blue-400 rounded-full" style={{ width: `${completionPercent}%` }} />
 </View>
 <Text className="text-sand text-sm">
 Complete all video modules and pass each short quiz to get certified.
 </Text>
 </View>

 <View className="mb-6">
 <Text className="text-2xl font-bold text-charcoal">Training Content Library</Text>
 <Text className="text-muted mt-1">Empower your growth with our curated training library. </Text>
 </View>

 {loading ? (
 <ActivityIndicator size="large" color="#0B5B31" className="mt-10" />
 ) : error ? (
 <Text className="text-clay/80 text-center mt-10">{error}</Text>
 ) : (
 modules.map((module) => (
 <TouchableOpacity 
 key={module.id} 
 className="bg-cream rounded-3xl p-5 mb-5 shadow-sm border border-sage/10"
 onPress={() => {
 if (module.status !== 'locked') {
 handleStartLesson(module.id);
 }
 }}
 activeOpacity={module.status === 'locked' ? 1 : 0.7}
 >
 <View className="flex-row mb-4">
 {/* Thumbnail / Icon */}
 <View className="w-24 h-24 bg-sage/10 rounded-2xl mr-4 overflow-hidden relative">
 {/* Placeholder for video thumbnail */}
 <View className="absolute inset-0 bg-sage/30 opacity-50" />
 <View className="absolute inset-0 items-center justify-center">
 <View className={`w-10 h-10 rounded-full items-center justify-center ${module.status === 'locked' ? 'bg-gray-800/60' : module.status === 'quiz_passed' ? 'bg-moss/50' : 'bg-moss/80'}`}>
 <Text className="text-white text-lg">{module.status === 'locked' ? '🔒' : module.status === 'quiz_passed' ? '✓' : '▶'}</Text>
 </View>
 </View>
 {/* <View className="absolute bottom-2 right-2 bg-black/70 px-2 py-0.5 rounded-md">
 <Text className="text-white text-xs font-medium">{module.duration_text || '2m'}</Text>
 </View> */}
 </View>

 {/* Details */}
 <View className="flex-1 justify-between py-1">
 <View>
 <View className="bg-moss/10 self-start px-2 py-1 rounded-full mb-2">
 <Text className="text-moss text-[10px] font-bold tracking-wider">{module.category_name}</Text>
 </View>
 <Text className="font-bold text-charcoal text-base leading-tight mb-1" numberOfLines={2}>
 {module.title}
 </Text>
 <Text className="text-muted text-xs" numberOfLines={2}>
 {module.overview_text}
 </Text>
 </View>
 </View>
 </View>

 {/* Actions */}
 <View className="flex-row items-center justify-between mt-2 pt-4 border-t border-gray-50">
 <View className="flex-row items-center">
 <Text className="text-gray-400 mr-2">⏱</Text>
 <Text className="text-muted text-xs font-medium">{module.duration_text}</Text>
 </View>

 {module.status === 'locked' ? (
 <View className="bg-sage/10 px-5 py-2.5 rounded-full flex-row items-center">
 <Text className="text-sage mr-2">🔒</Text>
 <Text className="text-sage font-bold">Locked</Text>
 </View>
 ) : module.status === 'quiz_passed' ? (
 <View
 className="bg-moss/5 px-5 py-2.5 rounded-full flex-row items-center border border-moss/20"
 >
 <Text className="text-moss font-bold mr-2">✓ Passed</Text>
 <Text className="text-moss/80 text-xs font-medium bg-moss/10 px-2 py-0.5 rounded-md">{module.highest_quiz_score}%</Text>
 </View>
 ) : (
 <View
 className="bg-moss px-5 py-2.5 rounded-full flex-row items-center shadow-sm shadow-primary-500/50"
 >
 <Text className="text-white mr-2">▶</Text>
 <Text className="text-white font-bold">Start Lesson</Text>
 </View>
 )}
 </View>

 {/* Topics Pills */}
 {module.key_module_topics && module.key_module_topics.length > 0 && (
 <View className="flex-row items-center mt-5">
 <Text className="text-sage text-xs font-medium mr-3">Topics:</Text>
 <ScrollView horizontal showsHorizontalScrollIndicator={false}>
 {module.key_module_topics.map((topic, idx) => (
 <View key={idx} className="border border-gray-200 rounded-full px-3 py-1 mr-2 bg-white shadow-sm">
 <Text className="text-muted text-xs">{topic}</Text>
 </View>
 ))}
 </ScrollView>
 </View>
 )}
 </TouchableOpacity>
 ))
 )}
 </View>
 )}

 {activeTab === 'certificate' && (
 <View className="bg-cream rounded-3xl p-6 shadow-sm border border-sage/10 items-center justify-center min-h-[400px]">
 {/* Certificate Template */}
 <ViewShot ref={certificateRef} options={{ format: 'png', quality: 1.0 }} style={{ width: '100%', backgroundColor: 'white', borderRadius: 12 }}>
 <View className="w-full aspect-[1.4] bg-cream border-8 border-moss rounded-xl p-3 items-center justify-center relative shadow-lg overflow-hidden">
 {/* Branding Logo - Top Left */}
 <View className="absolute top-3 left-3 z-20">
 <Image
 source={require('../assets/images/icon_sahyogi.png')}
 style={{ width: 55, height: 25, resizeMode: 'contain' }}
 />
 </View>

 {/* Main Content Centered */}
 <View className="items-center z-10 w-full mt-2">
 <Text className="text-2xl font-serif font-bold text-moss mb-0.5">CERTIFICATE</Text>
 <Text className="text-[9px] text-moss tracking-widest uppercase font-bold mb-3">of completion</Text>
 <Text className="text-sage italic text-[10px] mb-1">This is proudly presented to</Text>
 <View className="px-4 w-full border-b border-sage/20 pb-1 mb-2">
 <Text className="text-xl font-bold text-slate w-full text-center" numberOfLines={1} adjustsFontSizeToFit>
 {userProfile ? `${userProfile.first_name} ${userProfile.last_name}`.toUpperCase() : 'STUDENT NAME'}
 </Text>
 </View>
 <Text className="text-sage italic text-center text-[9px] px-6 leading-tight">
 For successfully completing all required training modules in the Sahyogi program.
 </Text>
 </View>

 {/* Date - Bottom Left */}
 <View className="absolute bottom-3 left-4 items-center w-20 z-10">
 <Text className="text-slate font-bold border-b border-sage/30 pb-0.5 w-full text-center text-[10px]">
 {(() => {
 const formatDate = (date: Date) => {
 const d = String(date.getDate()).padStart(2, '0');
 const m = String(date.getMonth() + 1).padStart(2, '0');
 const y = date.getFullYear();
 return `${d}/${m}/${y}`;
 };
 const completedModules = modules.filter(m => m.status === 'quiz_passed' && m.completed_at);
 if (completedModules.length > 0) {
 const maxDate = new Date(Math.max(...completedModules.map(m => new Date(m.completed_at as string).getTime())));
 return formatDate(maxDate);
 }
 return formatDate(new Date());
 })()}
 </Text>
 <Text className="text-sage text-[7px] uppercase font-bold tracking-wider mt-0.5">Date</Text>
 </View>

 {/* Seal - Bottom Right */}
 <View className="absolute bottom-2 right-2 w-12 h-12 rounded-full bg-clay items-center justify-center transform rotate-12 shadow-sm border-2 border-[#FFFFFF] z-10">
 <Text className="text-white text-[7px] font-bold text-center leading-tight">Sahyogi{'\n'}Certified</Text>
 </View>
 </View>
 </ViewShot>

 <View className="mt-8 items-center justify-center w-full">
 <TouchableOpacity onPress={shareCertificate} className="bg-clay px-8 py-3.5 rounded-full flex-row items-center shadow-md">
 <Feather name="share" size={18} color="white" style={{ marginRight: 8 }} />
 <Text className="font-bold text-white tracking-wide text-sm">Share Certificate</Text>
 </TouchableOpacity>
 </View>
 </View>
 )}

 {activeTab === 'jobs' && (
 <View className="mt-4">
 <View className="mb-6 flex-row justify-between items-center">
 <View>
 <Text className="text-2xl font-bold text-charcoal">Your Shifts</Text>
 <Text className="text-muted mt-1">Accept and manage your jobs.</Text>
 </View>
 <TouchableOpacity onPress={fetchJobs} className="bg-sage/10 p-2.5 rounded-full shadow-sm">
 <Feather name="refresh-cw" size={16} color="#666666" />
 </TouchableOpacity>
 </View>

 <View className="flex-row bg-sage/20 rounded-full p-1 mb-6">
 <Pressable
 style={{ flex: 1, paddingVertical: 10, borderRadius: 9999, alignItems: 'center', backgroundColor: jobsTab === 'available' ? '#ffffff' : 'transparent', shadowOpacity: jobsTab === 'available' ? 0.05 : 0 }}
 onPress={() => setJobsTab('available')}
 >
 <Text style={{ fontWeight: 'bold', color: jobsTab === 'available' ? '#0B5B31' : '#6B7280' }}>Available</Text>
 </Pressable>
 <Pressable
 style={{ flex: 1, paddingVertical: 10, borderRadius: 9999, alignItems: 'center', backgroundColor: jobsTab === 'accepted' ? '#ffffff' : 'transparent', shadowOpacity: jobsTab === 'accepted' ? 0.05 : 0 }}
 onPress={() => setJobsTab('accepted')}
 >
 <Text style={{ fontWeight: 'bold', color: jobsTab === 'accepted' ? '#0B5B31' : '#6B7280' }}>Accepted</Text>
 </Pressable>
 </View>

 {jobsLoading ? (
 <ActivityIndicator size="large" color="#0B5B31" className="mt-10" />
 ) : jobsTab === 'available' ? (
 availableJobs.length === 0 ? (
 <View className="bg-cream rounded-3xl p-8 shadow-sm border border-sage/10 items-center justify-center py-20 mt-4">
 {/* <Text className="text-6xl mb-6">🔍</Text> */}
 <Text className="text-xl font-bold text-charcoal mb-3 text-center">No Jobs Available</Text>
 <Text className="text-muted text-center leading-relaxed">
 Wait for jobs to get hosted. We will notify you when matching opportunities are available in your area.
 </Text>
 </View>
 ) : (
 availableJobs.map((job) => (
 <View key={job.request_id} className="bg-cream rounded-3xl p-5 mb-5 shadow-sm border border-sage/10">
 <View className="flex-row justify-between items-start mb-4">
 <View className="flex-1 pr-4">
 <View className="bg-moss/10 self-start px-3 py-1.5 rounded-full mb-3 flex-row items-center border border-moss/20">
 <Feather name="briefcase" size={12} color="#0B5B31" style={{ marginRight: 6 }} />
 <Text className="text-moss text-[10px] font-bold tracking-wider uppercase">{job.job_name}</Text>
 </View>
 <Text className="font-bold text-charcoal text-lg leading-tight mb-1.5">{job.store_name}</Text>
 <View className="flex-row items-start">
 <Feather name="map-pin" size={12} color="#6B7280" style={{ marginTop: 2, marginRight: 4 }} />
 <Text className="text-muted text-xs flex-1 leading-relaxed">{job.address}{job.city ? `, ${job.city}` : ''}</Text>
 </View>
 </View>
 <View className="bg-clay px-3 py-2.5 rounded-2xl items-center min-w-[75px] shadow-sm">
 <Text className="text-white font-bold text-xl">₹{job.base_compensation * job.hours_duration}</Text>
 <Text className="text-white text-[9px] font-bold uppercase tracking-wider mt-0.5">{job.hours_duration} {job.hours_duration == 1 ? "Hour" : "Hours"}</Text>
 </View>
 </View>

 <View className="flex-row bg-sand rounded-2xl p-3.5 mb-5 border border-sage/10 justify-around shadow-sm">
 <View className="items-center">
 <Text className="text-sage text-[9px] uppercase font-bold tracking-widest mb-1.5">Date</Text>
 <View className="flex-row items-center">
 <Feather name="calendar" size={12} color="#666666" style={{ marginRight: 5 }} />
 <Text className="text-slate font-semibold text-xs">{job.shift_date}</Text>
 </View>
 </View>
 <View className="w-[1px] bg-sage/20 h-full" />
 <View className="items-center">
 <Text className="text-sage text-[9px] uppercase font-bold tracking-widest mb-1.5">Time</Text>
 <View className="flex-row items-center">
 <Feather name="clock" size={12} color="#666666" style={{ marginRight: 5 }} />
 <Text className="text-slate font-semibold text-xs">{job.start_time.substring(0, 5)}</Text>
 </View>
 </View>
 <View className="w-[1px] bg-sage/20 h-full" />
 <View className="items-center">
 <Text className="text-sage text-[9px] uppercase font-bold tracking-widest mb-1.5">Duration</Text>
 <Text className="text-slate font-semibold text-xs">{job.hours_duration} hrs</Text>
 </View>
 </View>

 <Button
 title="Accept Job"
 onPress={() => handleAcceptJob(job.request_id)}
 loading={acceptingJobId === job.request_id}
 disabled={acceptingJobId !== null && acceptingJobId !== job.request_id}
 />
 </View>
 ))
 )
 ) : (
 acceptedJobs.length === 0 ? (
 <View className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 items-center justify-center py-20 mt-4">
 <Text className="text-xl font-bold text-charcoal mb-3 text-center">No Accepted Jobs</Text>
 <Text className="text-muted text-center leading-relaxed">
 You haven't accepted any jobs yet. Check the Available tab for opportunities.
 </Text>
 </View>
 ) : (
 <>
   {/* Today Accordion */}
   <TouchableOpacity 
     onPress={() => toggleSection('today')}
     className="flex-row justify-between items-center bg-cream p-4 rounded-xl shadow-sm border border-sage/10 mb-3"
   >
     <View className="flex-row items-center">
       <Text className="text-base font-bold text-charcoal">Jobs Today</Text>
       <View className="bg-primary-100 px-2 py-0.5 rounded-full ml-3">
         <Text className="text-primary-700 text-xs font-bold">{todayAcceptedJobs.length}</Text>
       </View>
     </View>
     <Feather name={expandedSections.today ? 'chevron-up' : 'chevron-down'} size={20} color="#666666" />
   </TouchableOpacity>

   {expandedSections.today && (
     <View className="mb-4">
       {todayAcceptedJobs.length === 0 ? (
         <View className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 items-center justify-center">
           <Text className="text-muted text-sm">No job scheduled for today</Text>
         </View>
       ) : (
         todayAcceptedJobs.map(renderAcceptedJobCard)
       )}
     </View>
   )}

   {/* Upcoming Accordion */}
   <TouchableOpacity 
     onPress={() => toggleSection('upcoming')}
     className="flex-row justify-between items-center bg-cream p-4 rounded-xl shadow-sm border border-sage/10 mb-3"
   >
     <View className="flex-row items-center">
       <Text className="text-base font-bold text-charcoal">Upcoming Jobs</Text>
       <View className="bg-primary-100 px-2 py-0.5 rounded-full ml-3">
         <Text className="text-primary-700 text-xs font-bold">{upcomingAcceptedJobs.length}</Text>
       </View>
     </View>
     <Feather name={expandedSections.upcoming ? 'chevron-up' : 'chevron-down'} size={20} color="#666666" />
   </TouchableOpacity>

   {expandedSections.upcoming && (
     <View className="mb-4">
       {upcomingAcceptedJobs.length === 0 ? (
         <View className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 items-center justify-center">
           <Text className="text-muted text-sm">No upcoming jobs</Text>
         </View>
       ) : (
         upcomingAcceptedJobs.map(renderAcceptedJobCard)
       )}
     </View>
   )}

   {/* Past Accordion */}
   <TouchableOpacity 
     onPress={() => toggleSection('past')}
     className="flex-row justify-between items-center bg-cream p-4 rounded-xl shadow-sm border border-sage/10 mb-3"
   >
     <View className="flex-row items-center">
       <Text className="text-base font-bold text-charcoal">Past Jobs</Text>
       <View className="bg-primary-100 px-2 py-0.5 rounded-full ml-3">
         <Text className="text-primary-700 text-xs font-bold">{pastAcceptedJobs.length}</Text>
       </View>
     </View>
     <Feather name={expandedSections.past ? 'chevron-up' : 'chevron-down'} size={20} color="#666666" />
   </TouchableOpacity>

   {expandedSections.past && (
     <View className="mb-4">
       {pastAcceptedJobs.length === 0 ? (
         <View className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 items-center justify-center">
           <Text className="text-muted text-sm">No past jobs</Text>
         </View>
       ) : (
         pastAcceptedJobs.map(renderAcceptedJobCard)
       )}
     </View>
   )}
 </>
 )
 )}
 </View>
 )}
 </View>
 </ScrollView>

 {/* Toast Popup */}
 {toastMessage ? (
 <View className="absolute bottom-24 self-center bg-gray-900/90 px-5 py-3 rounded-full z-50 shadow-md">
 <Text className="text-white text-xs font-medium text-center">{toastMessage}</Text>
 </View>
 ) : null}

 {/* Bottom Navigation */}
 <View
 className="flex-row justify-around items-center bg-cream border-t border-sage/10 pt-3 px-2"
 style={{ paddingBottom: Math.max(insets.bottom, 16) }}
 >
 <TouchableOpacity
 onPress={() => setActiveTab('modules')}
 className="items-center flex-1"
 >
 <Feather name="book-open" size={22} color={activeTab === 'modules' ? '#111827' : '#9CA3AF'} style={{ marginBottom: 4 }} />
 <Text className={`text-[10px] font-medium tracking-wide ${activeTab === 'modules' ? 'text-charcoal' : 'text-gray-400'}`}>Modules</Text>
 </TouchableOpacity>

 <TouchableOpacity
 onPress={() => isAllCompleted ? setActiveTab('certificate') : showToast('Complete all training modules to unlock Certificate')}
 className="items-center flex-1"
 >
 <Feather name="award" size={22} color={activeTab === 'certificate' ? '#111827' : '#9CA3AF'} style={{ marginBottom: 4, opacity: isAllCompleted ? 1 : 0.5 }} />
 <View className="flex-row items-center">
 <Text className={`text-[10px] font-medium tracking-wide ${activeTab === 'certificate' ? 'text-charcoal' : 'text-gray-400'}`}>Certificate</Text>
 {!isAllCompleted && <Feather name="lock" size={10} color="#9CA3AF" style={{ marginLeft: 2 }} />}
 </View>
 </TouchableOpacity>

 <TouchableOpacity
 onPress={() => isAllCompleted ? setActiveTab('jobs') : showToast('Complete all training modules to unlock Jobs')}
 className="items-center flex-1"
 >
 <Feather name="briefcase" size={22} color={activeTab === 'jobs' ? '#111827' : '#9CA3AF'} style={{ marginBottom: 4, opacity: isAllCompleted ? 1 : 0.5 }} />
 <View className="flex-row items-center">
 <Text className={`text-[10px] font-medium tracking-wide ${activeTab === 'jobs' ? 'text-charcoal' : 'text-gray-400'}`}>Jobs</Text>
 {!isAllCompleted && <Feather name="lock" size={10} color="#9CA3AF" style={{ marginLeft: 2 }} />}
 </View>
 </TouchableOpacity>
 </View>

 {/* Congrats Popup */}
 <Modal visible={showCongrats} animationType="slide" transparent={true}>
 <View className="flex-1 bg-black/60 justify-center items-center p-6">
 <View className="bg-cream w-full rounded-3xl p-8 items-center shadow-xl">
 <Text className="text-6xl mb-6">🎓</Text>
 <Text className="text-2xl font-bold text-charcoal mb-2 text-center">Congratulations!</Text>
 <Text className="text-muted text-center mb-8">
 You have successfully completed all the training modules. You are now certified and eligible for jobs!
 </Text>
 <TouchableOpacity
 onPress={() => {
 setShowCongrats(false);
 setActiveTab('certificate');
 }}
 className="bg-moss w-full py-4 rounded-xl items-center shadow-md shadow-primary-600/30"
 >
 <Text className="text-white font-bold text-lg">View Certificate</Text>
 </TouchableOpacity>
 </View>
 </View>
 </Modal>
 </SafeAreaView>
 );
}
