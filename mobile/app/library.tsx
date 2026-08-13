import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, SafeAreaView, Platform, StatusBar, ScrollView, TouchableOpacity, ActivityIndicator, Image, Modal, BackHandler, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { apiClient } from '../src/api/client';
import { Button } from '../src/components/Button';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
}

export default function LibraryScreen() {
  const router = useRouter();
  const { justCompleted } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  
  const [modules, setModules] = useState<Module[]>([]);
  const [userProfile, setUserProfile] = useState<{first_name: string, last_name: string} | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [activeTab, setActiveTab] = useState<'modules' | 'certificate' | 'jobs'>('modules');
  const [showCongrats, setShowCongrats] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  
  const [jobsTab, setJobsTab] = useState<'available' | 'accepted'>('available');
  const [availableJobs, setAvailableJobs] = useState<any[]>([]);
  const [acceptedJobs, setAcceptedJobs] = useState<any[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [acceptingJobId, setAcceptingJobId] = useState<string | null>(null);



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

  return (
    <SafeAreaView className="flex-1 bg-gray-50 pt-8">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        
        {/* Header Area */}
        <View className="bg-primary-600 pt-8 pb-4 px-6 rounded-b-3xl">
          <View className="flex-row justify-between items-center mb-6">
            <View className="flex-row items-center">
              <TouchableOpacity 
                onPress={() => router.push('/profile')}
                className="bg-white h-10 w-10 rounded-full items-center justify-center mr-3 shadow-sm"
              >
                <Text className="text-primary-600 font-bold text-xl">{userProfile?.first_name?.charAt(0).toUpperCase() || 'L'}</Text>
              </TouchableOpacity>
              <View>
                <Text className="text-white font-bold text-xl leading-tight">SAHYOGI</Text>
                <Text className="text-primary-100 text-xs">Training Content Library</Text>
              </View>
            </View>
          </View>


        </View>

        <View className="px-5 pt-6 pb-20">
          {activeTab === 'modules' && (
            <View>
              {/* Dashboard Progress Card */}
          <View className="bg-primary-600 rounded-3xl p-6 mb-8 shadow-sm">
            <View className="flex-row justify-between items-center mb-6">
              <View className="flex-row items-center">
                <View className="h-12 w-12 rounded-full bg-primary-500 items-center justify-center border border-primary-400 mr-3">
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
            <Text className="text-primary-100 text-sm">
              Complete all video modules and pass each short quiz to get certified.
            </Text>
          </View>

          <View className="mb-6">
            <Text className="text-2xl font-bold text-gray-900">Training Content Library</Text>
            <Text className="text-gray-500 mt-1">Empower your growth with our curated training library. </Text>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#2563EB" className="mt-10" />
          ) : error ? (
            <Text className="text-red-500 text-center mt-10">{error}</Text>
          ) : (
            modules.map((module) => (
              <View key={module.id} className="bg-white rounded-3xl p-5 mb-5 shadow-sm border border-gray-100">
                <View className="flex-row mb-4">
                  {/* Thumbnail / Icon */}
                  <View className="w-24 h-24 bg-gray-100 rounded-2xl mr-4 overflow-hidden relative">
                    {/* Placeholder for video thumbnail */}
                    <View className="absolute inset-0 bg-gray-300 opacity-50" />
                    <View className="absolute inset-0 items-center justify-center">
                      <View className={`w-10 h-10 rounded-full items-center justify-center ${module.status === 'locked' ? 'bg-gray-800/60' : module.status === 'quiz_passed' ? 'bg-green-500' : 'bg-primary-500'}`}>
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
                      <View className="bg-blue-50 self-start px-2 py-1 rounded-full mb-2">
                        <Text className="text-primary-600 text-[10px] font-bold tracking-wider">{module.category_name}</Text>
                      </View>
                      <Text className="font-bold text-gray-900 text-base leading-tight mb-1" numberOfLines={2}>
                        {module.title}
                      </Text>
                      <Text className="text-gray-500 text-xs" numberOfLines={2}>
                        {module.overview_text}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Actions */}
                <View className="flex-row items-center justify-between mt-2 pt-4 border-t border-gray-50">
                  <View className="flex-row items-center">
                    <Text className="text-gray-400 mr-2">⏱</Text>
                    <Text className="text-gray-500 text-xs font-medium">{module.duration_text}</Text>
                  </View>
                  
                  {module.status === 'locked' ? (
                    <View className="bg-gray-100 px-5 py-2.5 rounded-full flex-row items-center">
                      <Text className="text-gray-400 mr-2">🔒</Text>
                      <Text className="text-gray-400 font-bold">Locked</Text>
                    </View>
                  ) : module.status === 'quiz_passed' ? (
                    <TouchableOpacity 
                      onPress={() => handleStartLesson(module.id)}
                      className="bg-green-50 px-5 py-2.5 rounded-full flex-row items-center border border-green-200"
                    >
                      <Text className="text-green-600 font-bold mr-2">✓ Passed</Text>
                      <Text className="text-green-500 text-xs font-medium bg-green-100 px-2 py-0.5 rounded-md">{module.highest_quiz_score}%</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity 
                      onPress={() => handleStartLesson(module.id)}
                      className="bg-primary-600 px-5 py-2.5 rounded-full flex-row items-center shadow-sm shadow-primary-500/50"
                    >
                      <Text className="text-white mr-2">▶</Text>
                      <Text className="text-white font-bold">Start Lesson</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Topics Pills */}
                {module.key_module_topics && module.key_module_topics.length > 0 && (
                  <View className="flex-row items-center mt-5">
                    <Text className="text-gray-400 text-xs font-medium mr-3">Topics:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {module.key_module_topics.map((topic, idx) => (
                        <View key={idx} className="border border-gray-200 rounded-full px-3 py-1 mr-2 bg-white shadow-sm">
                          <Text className="text-gray-600 text-xs">{topic}</Text>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            ))
          )}
          </View>
          )}

          {activeTab === 'certificate' && (
             <View className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 items-center justify-center min-h-[400px]">
               {/* Certificate Template */}
               <View className="w-full aspect-[1.4] bg-white border-8 border-primary-900 rounded-xl p-4 items-center justify-between relative shadow-lg overflow-hidden">
                  <View className="absolute top-0 left-0 right-0 h-32 bg-primary-50 opacity-50" />
                  <View className="items-center mt-4">
                    <Text className="text-3xl font-serif font-bold text-primary-900 mb-1">CERTIFICATE</Text>
                    <Text className="text-[10px] text-primary-600 tracking-widest uppercase font-bold">of completion</Text>
                  </View>
                  
                  <View className="items-center my-6 z-10 w-full px-2">
                    <Text className="text-gray-500 italic text-xs mb-3">This is proudly presented to</Text>
                    <Text className="text-2xl font-bold text-gray-900 border-b border-gray-300 pb-1 w-full text-center" numberOfLines={1} adjustsFontSizeToFit>
                      {userProfile ? `${userProfile.first_name} ${userProfile.last_name}`.toUpperCase() : 'Student Name'}
                    </Text>
                    <Text className="text-gray-500 italic mt-3 text-center text-xs">For successfully completing all required training modules in thE Sahyogi program.</Text>
                  </View>

                  <View className="flex-row justify-between w-full px-2 mb-2 items-end z-10">
                     <View className="items-center w-24">
                       <Text className="text-gray-800 font-bold border-b border-gray-300 pb-1 mb-1 w-full text-center text-xs">
                         {new Date().toLocaleDateString()}
                       </Text>
                       <Text className="text-gray-400 text-[8px] uppercase">Date</Text>
                     </View>
                     <View className="w-14 h-14 rounded-full bg-primary-600 items-center justify-center transform rotate-12 shadow-sm border-2 border-white">
                       <Text className="text-white text-[8px] font-bold text-center leading-tight">Sahyogi{'\n'}Certified</Text>
                     </View>
                  </View>
               </View>

               <TouchableOpacity className="mt-8 bg-gray-100 px-6 py-3 rounded-full flex-row items-center border border-gray-200">
                 <Text className="font-bold text-gray-700">↓ Download PDF</Text>
               </TouchableOpacity>
             </View>
          )}

          {activeTab === 'jobs' && (
            <View className="mt-4">
              <View className="mb-6 flex-row justify-between items-center">
                <View>
                  <Text className="text-2xl font-bold text-gray-900">Your Shifts</Text>
                  <Text className="text-gray-500 mt-1">Accept and manage your jobs.</Text>
                </View>
                <TouchableOpacity onPress={fetchJobs} className="bg-gray-100 p-2.5 rounded-full shadow-sm">
                  <Feather name="refresh-cw" size={16} color="#4B5563" />
                </TouchableOpacity>
              </View>

              <View className="flex-row bg-gray-200 rounded-full p-1 mb-6">
                <Pressable
                  style={{ flex: 1, paddingVertical: 10, borderRadius: 9999, alignItems: 'center', backgroundColor: jobsTab === 'available' ? '#ffffff' : 'transparent', shadowOpacity: jobsTab === 'available' ? 0.05 : 0 }}
                  onPress={() => setJobsTab('available')}
                >
                  <Text style={{ fontWeight: 'bold', color: jobsTab === 'available' ? '#2563EB' : '#6B7280' }}>Available</Text>
                </Pressable>
                <Pressable
                  style={{ flex: 1, paddingVertical: 10, borderRadius: 9999, alignItems: 'center', backgroundColor: jobsTab === 'accepted' ? '#ffffff' : 'transparent', shadowOpacity: jobsTab === 'accepted' ? 0.05 : 0 }}
                  onPress={() => setJobsTab('accepted')}
                >
                  <Text style={{ fontWeight: 'bold', color: jobsTab === 'accepted' ? '#2563EB' : '#6B7280' }}>Accepted</Text>
                </Pressable>
              </View>

              {jobsLoading ? (
                <ActivityIndicator size="large" color="#2563EB" className="mt-10" />
              ) : jobsTab === 'available' ? (
                availableJobs.length === 0 ? (
                 <View className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 items-center justify-center py-20 mt-4">
                   {/* <Text className="text-6xl mb-6">🔍</Text> */}
                   <Text className="text-xl font-bold text-gray-900 mb-3 text-center">No Jobs Available</Text>
                   <Text className="text-gray-500 text-center leading-relaxed">
                     Wait for jobs to get hosted. We will notify you when matching opportunities are available in your area.
                   </Text>
                 </View>
                ) : (
                  availableJobs.map((job) => (
                    <View key={job.request_id} className="bg-white rounded-3xl p-5 mb-5 shadow-sm border border-gray-100">
                      <View className="flex-row justify-between items-start mb-4">
                        <View className="flex-1 pr-4">
                          <View className="bg-blue-50 self-start px-3 py-1.5 rounded-full mb-3 flex-row items-center border border-blue-100">
                            <Feather name="briefcase" size={12} color="#2563EB" style={{ marginRight: 6 }} />
                            <Text className="text-primary-700 text-[10px] font-bold tracking-wider uppercase">{job.job_name}</Text>
                          </View>
                          <Text className="font-bold text-gray-900 text-lg leading-tight mb-1.5">{job.store_name}</Text>
                          <View className="flex-row items-start">
                            <Feather name="map-pin" size={12} color="#6B7280" style={{ marginTop: 2, marginRight: 4 }} />
                            <Text className="text-gray-500 text-xs flex-1 leading-relaxed">{job.address}{job.city ? `, ${job.city}` : ''}</Text>
                          </View>
                        </View>
                        <View className="bg-green-50 px-3 py-2.5 rounded-2xl items-center border border-green-100 min-w-[75px] shadow-sm">
                          <Text className="text-green-700 font-bold text-xl">₹{job.base_compensation}</Text>
                          <Text className="text-green-600 text-[9px] font-bold uppercase tracking-wider mt-0.5">per hour</Text>
                        </View>
                      </View>

                      <View className="flex-row bg-gray-50 rounded-2xl p-3.5 mb-5 border border-gray-100 justify-around shadow-sm">
                        <View className="items-center">
                          <Text className="text-gray-400 text-[9px] uppercase font-bold tracking-widest mb-1.5">Date</Text>
                          <View className="flex-row items-center">
                            <Feather name="calendar" size={12} color="#4B5563" style={{ marginRight: 5 }} />
                            <Text className="text-gray-700 font-semibold text-xs">{job.shift_date}</Text>
                          </View>
                        </View>
                        <View className="w-[1px] bg-gray-200 h-full" />
                        <View className="items-center">
                          <Text className="text-gray-400 text-[9px] uppercase font-bold tracking-widest mb-1.5">Time</Text>
                          <View className="flex-row items-center">
                            <Feather name="clock" size={12} color="#4B5563" style={{ marginRight: 5 }} />
                            <Text className="text-gray-700 font-semibold text-xs">{job.start_time.substring(0, 5)}</Text>
                          </View>
                        </View>
                        <View className="w-[1px] bg-gray-200 h-full" />
                        <View className="items-center">
                          <Text className="text-gray-400 text-[9px] uppercase font-bold tracking-widest mb-1.5">Duration</Text>
                          <Text className="text-gray-700 font-semibold text-xs">{job.hours_duration} hrs</Text>
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
                   {/* <Text className="text-6xl mb-6">📅</Text> */}
                   <Text className="text-xl font-bold text-gray-900 mb-3 text-center">No Accepted Jobs</Text>
                   <Text className="text-gray-500 text-center leading-relaxed">
                     You haven't accepted any jobs yet. Check the Available tab for opportunities.
                   </Text>
                 </View>
                ) : (
                  acceptedJobs.map((job) => (
                    <View key={job.request_id} className="bg-white rounded-3xl p-5 mb-5 shadow-sm border border-gray-100">
                      <View className="flex-row justify-between items-start mb-4">
                        <View className="flex-1 pr-4">
                          <View className="bg-blue-50 self-start px-3 py-1.5 rounded-full mb-3 flex-row items-center border border-blue-100">
                            <Feather name="briefcase" size={12} color="#2563EB" style={{ marginRight: 6 }} />
                            <Text className="text-primary-700 text-[10px] font-bold tracking-wider uppercase">{job.job_name}</Text>
                          </View>
                          <Text className="font-bold text-gray-900 text-lg leading-tight mb-1.5">{job.store_name}</Text>
                          <View className="flex-row items-start">
                            <Feather name="map-pin" size={12} color="#6B7280" style={{ marginTop: 2, marginRight: 4 }} />
                            <Text className="text-gray-500 text-xs flex-1 leading-relaxed">{job.address}{job.city ? `, ${job.city}` : ''}</Text>
                          </View>
                        </View>
                        <View className="bg-primary-50 px-3 py-2.5 rounded-2xl items-center border border-primary-100 min-w-[75px] shadow-sm">
                          <Text className="text-primary-700 font-bold text-xl">₹{job.base_compensation * job.hours_duration}</Text>
                          <Text className="text-primary-600 text-[9px] font-bold uppercase tracking-wider mt-0.5">per hour</Text>
                        </View>
                      </View>

                      <View className="flex-row bg-gray-50 rounded-2xl p-3.5 mb-2 border border-gray-100 justify-around shadow-sm">
                        <View className="items-center">
                          <Text className="text-gray-400 text-[9px] uppercase font-bold tracking-widest mb-1.5">Date</Text>
                          <View className="flex-row items-center">
                            <Feather name="calendar" size={12} color="#4B5563" style={{ marginRight: 5 }} />
                            <Text className="text-gray-700 font-semibold text-xs">{job.shift_date}</Text>
                          </View>
                        </View>
                        <View className="w-[1px] bg-gray-200 h-full" />
                        <View className="items-center">
                          <Text className="text-gray-400 text-[9px] uppercase font-bold tracking-widest mb-1.5">Time</Text>
                          <View className="flex-row items-center">
                            <Feather name="clock" size={12} color="#4B5563" style={{ marginRight: 5 }} />
                            <Text className="text-gray-700 font-semibold text-xs">{job.start_time.substring(0, 5)}</Text>
                          </View>
                        </View>
                        <View className="w-[1px] bg-gray-200 h-full" />
                        <View className="items-center">
                          <Text className="text-gray-400 text-[9px] uppercase font-bold tracking-widest mb-1.5">Status</Text>
                          <View className="flex-row items-center">
                            <Feather name="check-circle" size={12} color="#10B981" style={{ marginRight: 5 }} />
                            <Text className="text-green-600 font-bold text-xs uppercase">{job.assignment_status}</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  ))
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
        className="flex-row justify-around items-center bg-white border-t border-gray-100 pt-3 px-2"
        style={{ paddingBottom: Math.max(insets.bottom, 16) }}
      >
        <TouchableOpacity 
          onPress={() => setActiveTab('modules')}
          className="items-center flex-1"
        >
          <Feather name="book-open" size={22} color={activeTab === 'modules' ? '#111827' : '#9CA3AF'} style={{ marginBottom: 4 }} />
          <Text className={`text-[10px] font-medium tracking-wide ${activeTab === 'modules' ? 'text-gray-900' : 'text-gray-400'}`}>Modules</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={() => isAllCompleted ? setActiveTab('certificate') : showToast('Complete all training modules to unlock Certificate')}
          className="items-center flex-1"
        >
          <Feather name="award" size={22} color={activeTab === 'certificate' ? '#111827' : '#9CA3AF'} style={{ marginBottom: 4, opacity: isAllCompleted ? 1 : 0.5 }} />
          <View className="flex-row items-center">
            <Text className={`text-[10px] font-medium tracking-wide ${activeTab === 'certificate' ? 'text-gray-900' : 'text-gray-400'}`}>Certificate</Text>
            {!isAllCompleted && <Feather name="lock" size={10} color="#9CA3AF" style={{ marginLeft: 2 }} />}
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={() => isAllCompleted ? setActiveTab('jobs') : showToast('Complete all training modules to unlock Jobs')}
          className="items-center flex-1"
        >
          <Feather name="briefcase" size={22} color={activeTab === 'jobs' ? '#111827' : '#9CA3AF'} style={{ marginBottom: 4, opacity: isAllCompleted ? 1 : 0.5 }} />
          <View className="flex-row items-center">
            <Text className={`text-[10px] font-medium tracking-wide ${activeTab === 'jobs' ? 'text-gray-900' : 'text-gray-400'}`}>Jobs</Text>
            {!isAllCompleted && <Feather name="lock" size={10} color="#9CA3AF" style={{ marginLeft: 2 }} />}
          </View>
        </TouchableOpacity>
      </View>

      {/* Congrats Popup */}
      <Modal visible={showCongrats} animationType="slide" transparent={true}>
        <View className="flex-1 bg-black/60 justify-center items-center p-6">
          <View className="bg-white w-full rounded-3xl p-8 items-center shadow-xl">
            <Text className="text-6xl mb-6">🎓</Text>
            <Text className="text-2xl font-bold text-gray-900 mb-2 text-center">Congratulations!</Text>
            <Text className="text-gray-600 text-center mb-8">
              You have successfully completed all the training modules. You are now certified and eligible for jobs!
            </Text>
            <TouchableOpacity 
              onPress={() => {
                setShowCongrats(false);
                setActiveTab('certificate');
              }}
              className="bg-primary-600 w-full py-4 rounded-xl items-center shadow-md shadow-primary-600/30"
            >
              <Text className="text-white font-bold text-lg">View Certificate</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
