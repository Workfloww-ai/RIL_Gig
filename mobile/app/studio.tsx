import React, { useState, useEffect } from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { apiClient } from '../src/api/client';

export default function StudioScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<'video' | 'audio'>('video');
  const [module, setModule] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const source = activeTab === 'video' ? module?.video_url : module?.podcast_url;

  const player = useVideoPlayer(source || '', (player) => {
    player.loop = false;
  });

  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    if (!player) return;
    // Actively poll the player time so the React component re-renders
    const interval = setInterval(() => {
      setCurrentTime(player.currentTime);
    }, 500);
    return () => clearInterval(interval);
  }, [player]);

  // Calculate completion percentage
  const progressPercent = player && player.duration ? (currentTime / player.duration) * 100 : 0;
  const isCompleted = progressPercent >= 95; // unlock quiz at 95% to be safe

  useEffect(() => {
    // In a real app, we would fetch the specific module by ID
    // For now we fetch all and filter since we don't have a GET /module/:id endpoint yet
    const fetchModule = async () => {
      try {
        const response = await apiClient.get('/content/modules?user_id=test-user-id');
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
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#2563EB" />
      </SafeAreaView>
    );
  }

  // Helper to format s to mm:ss
  const formatTime = (inputSeconds: number) => {
    if (!inputSeconds || isNaN(inputSeconds)) return "00:00";
    const totalSeconds = Math.floor(inputSeconds);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="bg-white px-4 py-4 flex-row items-center border-b border-gray-100 shadow-sm z-10">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Text className="text-gray-500 font-bold">← Back</Text>
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-primary-600 text-[10px] font-bold tracking-widest uppercase text-center mb-0.5">
            MODULE • {module.category_name}
          </Text>
          <Text className="font-bold text-gray-900 text-center" numberOfLines={1}>
            {module.title}
          </Text>
        </View>
        <View className="w-12" />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="flex-row mx-4 mt-4 bg-gray-100 rounded-full p-1">
          <TouchableOpacity 
            className={`flex-1 py-2.5 rounded-full items-center ${activeTab === 'video' ? 'bg-white shadow-sm' : ''}`}
            onPress={() => setActiveTab('video')}
          >
            <Text className={`font-semibold ${activeTab === 'video' ? 'text-primary-600' : 'text-gray-500'}`}>
              📹 Video Lesson
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            className={`flex-1 py-2.5 rounded-full items-center ${activeTab === 'audio' ? 'bg-white shadow-sm' : ''}`}
            onPress={() => setActiveTab('audio')}
          >
            <Text className={`font-semibold ${activeTab === 'audio' ? 'text-primary-600' : 'text-gray-500'}`}>
              🎙 Podcast (Audio)
            </Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row justify-between px-6 mt-4 mb-2">
          <Text className="text-gray-500 text-xs font-semibold">Playback Speed: 1.0x (Fixed)</Text>
          <Text className="text-gray-400 text-xs font-medium">🔒 Forward Seeking Disabled</Text>
        </View>

        <View className="bg-white mx-4 rounded-3xl overflow-hidden shadow-sm border border-gray-100 p-1 mb-6">
          <View className="bg-black w-full aspect-video rounded-2xl overflow-hidden justify-center items-center relative">
            {!source ? (
              <View className="items-center justify-center p-4">
                <Text className="text-gray-400 font-medium text-center">
                  {activeTab === 'video' ? 'No video' : 'No podcast'} available for this module.
                </Text>
              </View>
            ) : (
              <>
                <VideoView
                  player={player}
                  className="w-full h-full"
                  contentFit="contain"
                  nativeControls={false}
                />
                {!player?.playing ? (
                  <View className="absolute inset-0 bg-black/30 items-center justify-center">
                    <TouchableOpacity onPress={togglePlayPause} className="bg-white/90 w-16 h-16 rounded-full items-center justify-center shadow-lg pl-1">
                      <Text className="text-primary-600 text-2xl font-bold">▶</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </>
            )}
          </View>

          <View className="p-5 opacity-100" style={{ opacity: source ? 1 : 0.5 }} pointerEvents={source ? 'auto' : 'none'}>
            <View className="h-2 bg-gray-100 rounded-full mb-2 overflow-hidden flex-row">
              <View className="h-full bg-primary-500" style={{ width: `${progressPercent}%` }} />
            </View>
            
            <View className="flex-row justify-between items-center mb-5">
              <Text className="text-gray-500 text-xs font-medium tracking-widest">
                {formatTime(currentTime)} / {formatTime(player?.duration || 0)}
              </Text>
              <View className="bg-blue-50 px-2 py-1 rounded border border-blue-100">
                <Text className="text-primary-600 text-[10px] font-bold">🔒 Scrub Locked</Text>
              </View>
            </View>

            <View className="flex-row items-center justify-between">
              <View className="flex-row gap-3">
                <TouchableOpacity 
                  onPress={togglePlayPause} 
                  className="bg-primary-600 px-6 py-3 rounded-xl flex-row items-center shadow-sm shadow-primary-500/30"
                >
                  <Text className="text-white font-bold">{player?.playing ? 'Pause' : 'Play'}</Text>
                </TouchableOpacity>
                
                <TouchableOpacity onPress={rewind10s} className="bg-gray-100 px-4 py-3 rounded-xl border border-gray-200">
                  <Text className="text-gray-600 font-bold">↺ -10s</Text>
                </TouchableOpacity>
              </View>

              {isCompleted ? (
                <TouchableOpacity 
                  onPress={() => router.push({ pathname: '/quiz', params: { id: module.id } })}
                  className="bg-green-500 px-5 py-3 rounded-xl shadow-sm shadow-green-500/30"
                >
                  <Text className="text-white font-bold">Take Quiz</Text>
                </TouchableOpacity>
              ) : (
                <View className="bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-100 items-center">
                  <Text className="text-gray-400 text-xs font-medium">Complete 100% to</Text>
                  <Text className="text-gray-400 text-sm font-bold">Unlock Quiz</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <View className="bg-white mx-4 rounded-3xl p-6 shadow-sm border border-gray-100 mb-10">
          <Text className="text-lg font-bold text-gray-900 mb-2">✨ Module Summary</Text>
          <Text className="text-gray-600 leading-relaxed mb-6">
            {module.overview_text}
          </Text>

          <View className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
            <Text className="font-bold text-gray-800 mb-3 text-sm">Key Module Topics:</Text>
            <View className="flex-row flex-wrap gap-2">
              {module.key_module_topics?.map((topic: string, i: number) => (
                <View key={i} className="bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm">
                  <Text className="text-gray-600 text-xs font-medium">• {topic}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
