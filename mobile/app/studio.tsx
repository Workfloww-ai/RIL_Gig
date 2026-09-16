import React, { useState, useEffect, useRef } from 'react';
import { View, Text, SafeAreaView, Platform, StatusBar, ScrollView, TouchableOpacity, ActivityIndicator, Modal, Pressable, Image, Animated } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { apiClient } from '../src/api/client';
import { Feather } from '@expo/vector-icons';

const formatTime = (inputSeconds: number) => {
  if (!inputSeconds || isNaN(inputSeconds)) return "00:00";
  const totalSeconds = Math.floor(inputSeconds);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const PlayerProgress = ({ player, module, language, router }: any) => {
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    if (!player) return;
    const interval = setInterval(() => {
      setCurrentTime(player.currentTime);
    }, 500);
    return () => clearInterval(interval);
  }, [player]);

  const progressPercent = player && player.duration ? (currentTime / player.duration) * 100 : 0;
  const isCompleted = progressPercent >= 95;

  return (
    <View className="p-5 opacity-100" style={{ opacity: player ? 1 : 0.5 }} pointerEvents={player ? 'auto' : 'none'}>
      <View className="flex-row items-center justify-end">
        {isCompleted ? (
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/quiz', params: { id: module.id, lang: language } })}
            className="bg-green-500 px-5 py-3 rounded-xl shadow-sm shadow-green-500/30"
          >
            <Text className="text-white font-bold">Take Quiz</Text>
          </TouchableOpacity>
        ) : (
          <View className="bg-sand px-4 py-2.5 rounded-xl border border-sage/10 items-center">
            <Text className="text-sage text-xs font-medium">Complete 100% to Unlock Quiz</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const AudioWaveform = ({ player }: { player: any }) => {
  const bars = Array.from({ length: 21 });
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!player) return;
    const interval = setInterval(() => {
      setIsPlaying(player.playing);
    }, 250);
    return () => clearInterval(interval);
  }, [player]);

  return (
    <View className="flex-row items-center justify-center h-20 gap-1.5 opacity-50 w-full px-4 overflow-hidden mt-1">
      {bars.map((_, index) => {
        const anim = useRef(new Animated.Value(0.1)).current;

        useEffect(() => {
          let isMounted = true;
          const startAnim = () => {
            if (!isMounted) return;
            Animated.sequence([
              Animated.timing(anim, {
                toValue: Math.random() * 0.8 + 0.2, 
                duration: Math.random() * 300 + 200,
                useNativeDriver: true,
              }),
              Animated.timing(anim, {
                toValue: 0.1,
                duration: Math.random() * 300 + 200,
                useNativeDriver: true,
              }),
            ]).start(({ finished }) => {
              if (finished && isMounted) startAnim();
            });
          };

          if (isPlaying) {
            startAnim();
          } else {
            anim.stopAnimation();
            Animated.spring(anim, {
              toValue: 0.1,
              useNativeDriver: true,
            }).start();
          }

          return () => {
            isMounted = false;
            anim.stopAnimation();
          };
        }, [isPlaying]);

        return (
          <Animated.View
            key={index}
            style={{
              height: 60,
              width: 5,
              backgroundColor: '#A7F3D0', // soft emerald
              borderRadius: 3,
              transform: [{ scaleY: anim }]
            }}
          />
        );
      })}
    </View>
  );
};

export default function StudioScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'video' | 'audio'>('video');
  const [language, setLanguage] = useState<'english' | 'hinglish' | 'bengali'>('english');
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [module, setModule] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const currentVideoUrl = language === 'english' ? module?.video_url : module?.[`video_url_${language}`] || module?.video_url;
  const currentPodcastUrl = language === 'english' ? module?.podcast_url : module?.[`podcast_url_${language}`] || module?.podcast_url;
  const currentTitle = language === 'english' ? module?.title : module?.[`title_${language}`] || module?.title;
  const currentOverviewText = language === 'english' ? module?.overview_text : module?.[`overview_text_${language}`] || module?.overview_text;
  const currentKeyModuleTopics = language === 'english' ? module?.key_module_topics : module?.[`key_module_topics_${language}`] || module?.key_module_topics;

  const videoPlayer = useVideoPlayer(currentVideoUrl || null, (p) => {
    p.loop = false;
  });

  const audioPlayer = useVideoPlayer(currentPodcastUrl || null, (p) => {
    p.loop = false;
  });

  const player = activeTab === 'video' ? videoPlayer : audioPlayer;

  const maxTimeRef = useRef<{ video: number, audio: number }>({ video: 0, audio: 0 });

  useEffect(() => {
    if (!player) return;
    const interval = setInterval(() => {
      const currentMax = maxTimeRef.current[activeTab];
      
      // If user skipped forward by more than 2 seconds from their furthest watched point
      if (player.currentTime > currentMax + 2.0) {
        player.currentTime = currentMax;
      } else {
        // Update the max time seen
        maxTimeRef.current[activeTab] = Math.max(currentMax, player.currentTime);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [player, activeTab]);

  useEffect(() => {
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, []);

  // Calculate completion percentage moved to PlayerProgress

  useEffect(() => {
    // In a real app, we would fetch the specific module by ID
    // For now we fetch all and filter since we don't have a GET /module/:id endpoint yet
    const fetchModule = async () => {
      try {
        const response = await apiClient.get('/content/modules');
        const found = response.data.find((m: any) => m.id === id);
        setModule(found || response.data[0]); // fallback to first if not found
      } catch (error) {
        console.error("Failed to load module details:", error);
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchModule();
  }, [id]);

  const handleTabChange = (tab: 'video' | 'audio') => {
    videoPlayer?.pause();
    audioPlayer?.pause();
    setActiveTab(tab);
  };


  if (loading || !module) {
    return (
      <SafeAreaView className="flex-1 bg-cream items-center justify-center pt-8">
        <ActivityIndicator size="large" color="#0B5B31" />
      </SafeAreaView>
    );
  }

  // Helper to format s to mm:ss moved to PlayerProgress

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F8F9', paddingTop: 8 }}>
      {/* ==================== FIXED HEADER ==================== */}
      <View className="px-5 pt-8 pb-4 bg-white flex-row items-center relative mb-4">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Feather name="arrow-left" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        
        <View className="flex-1">
          <Text className="text-[10px] font-bold text-gray-500 tracking-widest uppercase mb-1">
            MODULE • {module.category_name}
          </Text>
          <Text className="text-lg font-extrabold text-gray-900 tracking-tight" numberOfLines={1}>
            {currentTitle}
          </Text>
        </View>
        


        <Image
          source={require('../assets/images/newlogo.png')}
          className="w-12 h-12 ml-3"
          resizeMode="contain"
        />
        
        {/* Decorative Brand Line - Absolute Bottom */}
        <View className="absolute bottom-0 left-0 right-0 h-1.5 flex-row">
          <View className="flex-1 bg-moss" />
          <View className="w-0 h-0 border-t-[6px] border-t-[#10472B] border-r-[6px] border-r-transparent -ml-[1px]" />
          <View className="w-1 bg-transparent" />
          <View className="w-0 h-0 border-b-[6px] border-b-[#D32F2F] border-l-[6px] border-l-transparent -mr-[1px]" />
          <View className="flex-1 bg-clay" />
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="flex-row mx-4 mt-4 bg-sage/10 rounded-full p-1">
          <TouchableOpacity
            className={`flex-1 py-2.5 rounded-full items-center ${activeTab === 'video' ? 'bg-cream' : ''}`}
            onPress={() => handleTabChange('video')}
          >
            <Text className={`font-semibold ${activeTab === 'video' ? 'text-primary-600' : 'text-muted'}`}>
              Video Lesson
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 py-2.5 rounded-full items-center ${activeTab === 'audio' ? 'bg-cream' : ''}`}
            onPress={() => handleTabChange('audio')}
          >
            <Text className={`font-semibold ${activeTab === 'audio' ? 'text-primary-600' : 'text-muted'}`}>
              Podcast (Audio)
            </Text>
          </TouchableOpacity>
        </View>

        <View className="bg-cream mx-4 rounded-3xl overflow-hidden shadow-sm border border-sage/10 p-1 mb-6">
          <View className="bg-black w-full aspect-video rounded-2xl overflow-hidden justify-center items-center relative">
            {(!currentVideoUrl && activeTab === 'video') || (!currentPodcastUrl && activeTab === 'audio') ? (
              <View className="items-center justify-center p-4">
                <Text className="text-sage font-medium text-center">
                  {activeTab === 'video' ? 'No video' : 'No podcast'} available for this language.
                </Text>
              </View>
            ) : (
              <View className="w-full h-full relative">
                {/* Video Player */}
                {activeTab === 'video' && (
                  <View className="absolute inset-0">
                    <VideoView
                      player={videoPlayer}
                      style={{ width: '100%', height: '100%' }}
                      contentFit="contain"
                      nativeControls={true}
                      allowsFullscreen={true}
                      allowsPictureInPicture={true}
                      buttonOptions={{ showSeekForward: false, showSeekBackward: false, showSettings: false }}
                    />
                  </View>
                )}

                {/* Audio Player */}
                {activeTab === 'audio' && (
                  <View className="absolute inset-0">
                    <VideoView
                      player={audioPlayer}
                      style={{ width: '100%', height: '100%' }}
                      contentFit="contain"
                      nativeControls={true}
                      allowsFullscreen={true}
                      allowsPictureInPicture={true}
                      buttonOptions={{ showSeekForward: false, showSeekBackward: false, showSettings: false }}
                    />
                    {/* Podcast Graphic Overlay */}
                    <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
                      <AudioWaveform player={audioPlayer} />
                    </View>
                    {/* <View className="absolute inset-x-0 top-4 items-center" pointerEvents="none">
                      <View className="w-16 h-16 bg-white/10 rounded-full items-center justify-center border border-white/20 shadow-md">
                        <Text className="text-3xl">🎧</Text>
                      </View>
                    </View> */}
                  </View>
                )}

                {/* Floating Language Button */}
                <TouchableOpacity 
                  onPress={() => setShowLangDropdown(true)} 
                  className="absolute top-3 right-3 z-50 flex-row items-center bg-black/60 px-3 py-1.5 rounded-full border border-white/20 shadow-lg"
                >
                  <Feather name="globe" size={14} color="white" />
                  <Text className="text-white text-xs font-semibold ml-1.5 capitalize">{language}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <PlayerProgress player={player} module={module} language={language} router={router} />
        </View>

        <View className="mx-4 mb-10 shadow-sm rounded-3xl">
          <View className="bg-white rounded-3xl overflow-hidden border border-gray-100 relative">
            <View className="p-6">
              <Text className="text-lg font-bold text-charcoal mb-2">Module Summary</Text>
              <Text className="text-muted leading-relaxed mb-6">
                {currentOverviewText}
              </Text>

              <View className="bg-sand p-4 rounded-2xl border border-sage/10 mb-2">
                <Text className="font-bold text-slate mb-3 text-sm">Key Module Topics:</Text>
                <View className="flex-row flex-wrap gap-2">
                  {module.key_module_topics?.map((topic: string, i: number) => (
                    <View key={i} className="bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm">
                      <Text className="text-muted text-xs font-medium">• {topic}</Text>
                    </View>
                  ))}

                </View>
              </View>
            </View>
            
            {/* Decorative Brand Line - Card Bottom */}
            <View className="absolute bottom-0 left-0 right-0 h-1.5 flex-row">
              <View className="flex-1 bg-moss" />
              <View className="w-0 h-0 border-t-[6px] border-t-[#10472B] border-r-[6px] border-r-transparent -ml-[1px]" />
              <View className="w-1 bg-transparent" />
              <View className="w-0 h-0 border-b-[6px] border-b-[#D32F2F] border-l-[6px] border-l-transparent -mr-[1px]" />
              <View className="flex-1 bg-clay" />
            </View>
          </View>
        </View>
      </ScrollView>


      {/* Language Selection Modal */}
      <Modal visible={showLangDropdown} transparent animationType="fade">
        <Pressable className="flex-1 bg-black/50 justify-center items-center" onPress={() => setShowLangDropdown(false)}>
          <View className="bg-white w-4/5 max-w-sm rounded-3xl p-6 shadow-xl">
            <Text className="text-lg font-bold text-charcoal mb-4 text-center">Select Language</Text>
            
            {(['english', 'hinglish', 'bengali'] as const).map((lang) => (
              <TouchableOpacity
                key={lang}
                onPress={() => { setLanguage(lang); setShowLangDropdown(false); }}
                className={`py-4 px-6 rounded-2xl mb-2 flex-row justify-between items-center ${language === lang ? 'bg-moss/10 border border-moss/30' : 'bg-gray-50 border border-gray-100'}`}
              >
                <Text className={`font-semibold text-base capitalize ${language === lang ? 'text-moss' : 'text-charcoal'}`}>
                  {lang}
                </Text>
                {language === lang && <Feather name="check" size={20} color="#0B5B31" />}
              </TouchableOpacity>
            ))}
            
            <TouchableOpacity onPress={() => setShowLangDropdown(false)} className="mt-2 py-3">
              <Text className="text-muted text-center font-semibold">Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
