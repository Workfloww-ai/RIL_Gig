import React, { useState, useEffect, useRef } from 'react';
import { View, Text, SafeAreaView, Platform, StatusBar, ScrollView, TouchableOpacity, ActivityIndicator, Modal, Pressable } from 'react-native';
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

const PlayerProgress = ({ player, module, isFullscreen = false, router }: any) => {
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

  if (isFullscreen) {
    return (
      <View className="absolute bottom-8 left-12 right-12 z-20 pointer-events-none">
        <View className="h-1.5 bg-cream/20 rounded-full mb-3 overflow-hidden flex-row">
          <View className="h-full bg-moss/80" style={{ width: `${progressPercent}%` }} />
        </View>
        <Text className="text-white/90 text-sm font-bold tracking-widest text-center shadow-sm">
          {formatTime(currentTime)} / {formatTime(player?.duration || 0)}
        </Text>
      </View>
    );
  }

  return (
    <View className="p-5 opacity-100" style={{ opacity: player ? 1 : 0.5 }} pointerEvents={player ? 'auto' : 'none'}>
      <View className="h-2 bg-sage/10 rounded-full mb-2 overflow-hidden flex-row">
        <View className="h-full bg-moss/80" style={{ width: `${progressPercent}%` }} />
      </View>
      
      <View className="flex-row justify-between items-center mb-5">
        <Text className="text-muted text-xs font-medium tracking-widest">
          {formatTime(currentTime)} / {formatTime(player?.duration || 0)}
        </Text>
      </View>

      <View className="flex-row items-center justify-end">
        {isCompleted ? (
          <TouchableOpacity 
            onPress={() => router.push({ pathname: '/quiz', params: { id: module.id } })}
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

export default function StudioScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<'video' | 'audio'>('video');
  const [module, setModule] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const videoRef = useRef<any>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetControlsTimeout = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      // We check playing state inside the timeout, but because player is a ref-like object, 
      // we can't reliably read its current state in this closure without it being stale. 
      // Instead, we just hide it. We will handle the paused state in the useEffect.
      setShowControls(false);
    }, 3000);
  };

  const videoPlayer = useVideoPlayer(module?.video_url || null, (p) => {
    p.loop = false;
  });

  const audioPlayer = useVideoPlayer(module?.podcast_url || null, (p) => {
    p.loop = false;
  });

  const player = activeTab === 'video' ? videoPlayer : audioPlayer;

  useEffect(() => {
    if (!player) return;
    
    // Auto-hide controls logic
    if (player.playing) {
      resetControlsTimeout();
    } else {
      setShowControls(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    }

    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [player, player?.playing]);

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

  const toggleFullscreen = async () => {
    if (isFullscreen) {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      setIsFullscreen(false);
    } else {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      setIsFullscreen(true);
    }
  };

  const togglePlayPause = () => {
    if (player.playing) {
      player.pause();
    } else {
      player.play();
    }
  };

  const rewind10s = () => {
    if (player) {
      const newPosition = Math.max(0, player.currentTime - 10);
      player.currentTime = newPosition;
    }
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
    <SafeAreaView className="flex-1 bg-sand pt-8">
      <View className="bg-cream px-4 py-4 flex-row items-center border-b border-sage/10 shadow-sm z-10">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center bg-sage/10 rounded-full mr-3">
          <Feather name="arrow-left" size={20} color="#666666" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-moss text-[10px] font-bold tracking-widest uppercase text-center mb-0.5">
            MODULE • {module.category_name}
          </Text>
          <Text className="font-bold text-charcoal text-center" numberOfLines={1}>
            {module.title}
          </Text>
        </View>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="flex-row mx-4 mt-4 bg-sage/10 rounded-full p-1">
          <TouchableOpacity 
            className={`flex-1 py-2.5 rounded-full items-center ${activeTab === 'video' ? 'bg-cream' : ''}`}
            onPress={() => handleTabChange('video')}
          >
            <Text className={`font-semibold ${activeTab === 'video' ? 'text-primary-600' : 'text-muted'}`}>
              📹 Video Lesson
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            className={`flex-1 py-2.5 rounded-full items-center ${activeTab === 'audio' ? 'bg-cream' : ''}`}
            onPress={() => handleTabChange('audio')}
          >
            <Text className={`font-semibold ${activeTab === 'audio' ? 'text-primary-600' : 'text-muted'}`}>
              🎙 Podcast (Audio)
            </Text>
          </TouchableOpacity>
        </View>

        <View className="bg-cream mx-4 rounded-3xl overflow-hidden shadow-sm border border-sage/10 p-1 mb-6">
          <View className="bg-black w-full aspect-video rounded-2xl overflow-hidden justify-center items-center relative">
            {(!module?.video_url && activeTab === 'video') || (!module?.podcast_url && activeTab === 'audio') ? (
              <View className="items-center justify-center p-4">
                <Text className="text-sage font-medium text-center">
                  {activeTab === 'video' ? 'No video' : 'No podcast'} available for this module.
                </Text>
              </View>
            ) : (
              <View className="w-full h-full relative">
                {/* Video Player */}
                {activeTab === 'video' && !isFullscreen && (
                  <View className="absolute inset-0">
                    <VideoView
                      ref={videoRef}
                      player={videoPlayer}
                      style={{ width: '100%', height: '100%' }}
                      contentFit="contain"
                      nativeControls={false}
                    />
                  </View>
                )}
                
                {/* Audio Player */}
                {activeTab === 'audio' && !isFullscreen && (
                  <View className="absolute inset-0">
                    <VideoView
                      player={audioPlayer}
                      style={{ width: '100%', height: '100%' }}
                      contentFit="contain"
                      nativeControls={false}
                    />
                    {/* Podcast Graphic Overlay */}
                    <View className="absolute inset-0 bg-gradient-to-br from-primary-900 to-primary-700 items-center justify-center" pointerEvents="none">
                      <View className="w-28 h-28 bg-cream/10 rounded-full items-center justify-center border border-white/20 mb-3 shadow-xl">
                        <Text className="text-6xl">🎙️</Text>
                      </View>
                      <Text className="text-white/90 font-bold tracking-widest text-xs">PODCAST EPISODE</Text>
                    </View>
                  </View>
                )}

                {/* Invisible Overlay to Capture Taps when controls are hidden */}
                {!showControls && (
                  <Pressable className="absolute inset-0 z-10" onPress={resetControlsTimeout} />
                )}

                {/* Overlay Controls */}
                {showControls && (
                  <>
                    <Pressable className="absolute inset-0 z-20" onPress={resetControlsTimeout} />
                    
                    <View className="absolute inset-0 flex-row items-center justify-center gap-6 z-30" pointerEvents="box-none">
                      <TouchableOpacity onPress={rewind10s} className="w-12 h-12 rounded-full bg-black/40 items-center justify-center border border-white/20 backdrop-blur-sm">
                        <Feather name="rotate-ccw" size={20} color="white" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={togglePlayPause}
                        className="w-16 h-16 rounded-full bg-moss/90 items-center justify-center border border-white/30 shadow-xl"
                      >
                        {player?.playing ? (
                          <Feather name="pause" size={28} color="white" />
                        ) : (
                          <Feather name="play" size={28} color="white" style={{ marginLeft: 4 }} />
                        )}
                      </TouchableOpacity>

                      <View className="w-12 h-12" />
                    </View>

                    <View className="absolute bottom-3 right-3 z-30" pointerEvents="box-none">
                      <TouchableOpacity onPress={toggleFullscreen} className="w-10 h-10 rounded-full bg-black/40 items-center justify-center border border-white/20 backdrop-blur-sm">
                        <Feather name="maximize" size={16} color="white" />
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            )}
          </View>

          <PlayerProgress player={player} module={module} router={router} />
        </View>

        <View className="bg-white mx-4 rounded-3xl p-6 shadow-sm border border-gray-100 mb-10">
          <Text className="text-lg font-bold text-charcoal mb-2">✨ Module Summary</Text>
          <Text className="text-muted leading-relaxed mb-6">
            {module.overview_text}
          </Text>

          <View className="bg-sand p-4 rounded-2xl border border-sage/10">
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
      </ScrollView>

      {/* Custom Fullscreen Modal */}
      <Modal visible={isFullscreen} animationType="fade" supportedOrientations={['landscape', 'portrait']}>
        <View className="flex-1 bg-black justify-center items-center relative">
          <VideoView
            player={player}
            style={{ width: '100%', height: '100%' }}
            contentFit="contain"
            nativeControls={false}
          />
          
          {/* Invisible Overlay for Fullscreen */}
          {!showControls && (
            <Pressable className="absolute inset-0 z-10" onPress={resetControlsTimeout} />
          )}

          {/* Fullscreen Overlay Controls */}
          {showControls && (
            <>
              <Pressable className="absolute inset-0 z-20" onPress={resetControlsTimeout} />
              
              <View className="absolute inset-0 flex-row items-center justify-center gap-10 z-30" pointerEvents="box-none">
                <TouchableOpacity onPress={rewind10s} className="w-16 h-16 rounded-full bg-black/50 items-center justify-center border border-white/20 backdrop-blur-md">
                  <Feather name="rotate-ccw" size={28} color="white" />
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={togglePlayPause} 
                  className="w-24 h-24 rounded-full bg-moss/90 items-center justify-center border border-white/30 shadow-2xl backdrop-blur-md"
                >
                  {player?.playing ? (
                    <Feather name="pause" size={42} color="white" />
                  ) : (
                    <Feather name="play" size={42} color="white" style={{ marginLeft: 6 }} />
                  )}
                </TouchableOpacity>

                <View className="w-16 h-16" />
              </View>

              <View className="absolute bottom-10 right-10 z-30" pointerEvents="box-none">
                <TouchableOpacity onPress={toggleFullscreen} className="w-14 h-14 rounded-full bg-black/50 items-center justify-center border border-white/20 backdrop-blur-md">
                  <Feather name="minimize" size={24} color="white" />
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Fullscreen Progress Bar */}
          <PlayerProgress player={player} module={module} router={router} isFullscreen={true} />
        </View>
      </Modal>
    </SafeAreaView>
  );
}
