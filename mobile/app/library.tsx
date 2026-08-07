import React, { useEffect, useState } from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { apiClient } from '../src/api/client';
import { Button } from '../src/components/Button';

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
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchModules = async () => {
      try {
        const response = await apiClient.get('/content/modules?user_id=test-user-id');
        setModules(response.data);
      } catch (err: any) {
        console.error('Failed to fetch modules:', err);
        setError('Failed to load content modules.');
      } finally {
        setLoading(false);
      }
    };

    fetchModules();
  }, []);

  const handleStartLesson = (moduleId: string) => {
    router.push({ pathname: '/studio', params: { id: moduleId } });
  };

  const completedCount = modules.filter(m => m.status === 'quiz_passed').length;
  const totalCount = modules.length;
  const completionPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        
        {/* Header Area */}
        <View className="bg-primary-600 pt-12 pb-4 px-6 rounded-b-3xl">
          <View className="flex-row justify-between items-center mb-6">
            <View className="flex-row items-center">
              <View className="bg-white h-10 w-10 rounded-full items-center justify-center mr-3">
                <Text className="text-primary-600 font-bold text-xl">L</Text>
              </View>
              <View>
                <Text className="text-white font-bold text-xl leading-tight">LucidFlexi</Text>
                <Text className="text-primary-100 text-xs">Training Content Library</Text>
              </View>
            </View>
            <View className="bg-primary-500/50 px-4 py-2 rounded-full border border-primary-400">
              <Text className="text-white font-medium text-sm">Demo Pass</Text>
            </View>
          </View>

          {/* Tab Navigation Mockup */}
          <View className="flex-row items-center mb-2">
            <TouchableOpacity className="border-b-2 border-white pb-2 mr-6">
              <Text className="text-white font-bold">Modules {completedCount}/{totalCount}</Text>
            </TouchableOpacity>
            <TouchableOpacity className="pb-2 mr-6 opacity-60">
              <Text className="text-white font-medium">Certificate 🔒</Text>
            </TouchableOpacity>
            <TouchableOpacity className="pb-2 opacity-60">
              <Text className="text-white font-medium">Jobs 🔒</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View className="px-5 pt-6 pb-20">
          
          {/* Dashboard Progress Card */}
          <View className="bg-primary-600 rounded-3xl p-6 mb-8 shadow-sm">
            <View className="flex-row justify-between items-center mb-6">
              <View className="flex-row items-center">
                <View className="h-12 w-12 rounded-full bg-primary-500 items-center justify-center border border-primary-400 mr-3">
                  <Text className="text-white text-lg font-bold">A</Text>
                </View>
                <View>
                  <Text className="text-primary-200 text-xs font-semibold tracking-wider">CANDIDATE DASHBOARD</Text>
                  <Text className="text-white text-xl font-bold">Alex Morgan</Text>
                </View>
              </View>
              <View className="bg-primary-500/40 px-3 py-1.5 rounded-lg border border-primary-400/50">
                <Text className="text-white text-xs font-medium">🔒 Jobs Locked</Text>
              </View>
            </View>
            
            <View className="mb-2 flex-row justify-between">
              <Text className="text-white font-semibold">📖 Module Completion</Text>
              <Text className="text-white font-bold">{completedCount} of {totalCount} ({completionPercent}%)</Text>
            </View>
            <View className="h-2 bg-primary-800 rounded-full mb-4 overflow-hidden flex-row">
              <View className="h-full bg-blue-400 rounded-full" style={{ width: `${completionPercent}%` }} />
            </View>
            <Text className="text-primary-100 text-sm">
              Complete all video modules without forward seeking and pass each short quiz to get certified.
            </Text>
          </View>

          <View className="mb-6">
            <Text className="text-2xl font-bold text-gray-900">Training Content Library</Text>
            <Text className="text-gray-500 mt-1">Sequenced modules with locked forward scrub</Text>
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
                    <View className="absolute bottom-2 right-2 bg-black/70 px-2 py-0.5 rounded-md">
                       <Text className="text-white text-xs font-medium">{module.duration_text || '2m'}</Text>
                    </View>
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
      </ScrollView>
    </SafeAreaView>
  );
}
