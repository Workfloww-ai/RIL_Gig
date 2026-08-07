import React, { useState, useEffect } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { apiClient } from '../src/api/client';
import useAuthStore from '../src/store/useAuthStore'; // Or however you get the user_id

interface Question {
  q: string;
  options: string[];
  answer: string;
}

export default function QuizScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  // TODO: Replace with real user_id from auth state
  // const user_id = useAuthStore(state => state.user?.id) || 'dummy-user-id';
  const user_id = 'test-user-id'; // Using a test ID for now to ensure MVP works

  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchModule = async () => {
      try {
        const response = await apiClient.get(`/content/modules?user_id=${user_id}`);
        const module = response.data.find((m: any) => m.id === id);
        
        if (module && module.quiz_questions && module.quiz_questions.length > 0) {
          setQuestions(module.quiz_questions);
          // Initialize empty answers
          setSelectedAnswers(new Array(module.quiz_questions.length).fill(null));
        } else {
          // If no questions, auto pass for now
          Alert.alert('No Quiz', 'There are no quiz questions for this module. Marking as passed!');
          submitScore(100);
        }
      } catch (err) {
        console.error('Failed to load quiz:', err);
        Alert.alert('Error', 'Could not load quiz data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchModule();
  }, [id]);

  const submitScore = async (score: number) => {
    setSubmitting(true);
    try {
      const res = await apiClient.post('/content/submit-quiz', {
        user_id,
        module_id: id,
        score
      });
      
      if (res.data.passed) {
        Alert.alert('Congratulations! 🎉', `You passed with ${score}%. The next module is now unlocked!`, [
          { text: 'Go to Dashboard', onPress: () => router.push('/library') }
        ]);
      } else {
        Alert.alert('Keep Trying!', `You scored ${score}%. You need at least 80% to pass.`, [
          { text: 'Retake Quiz', onPress: () => {
            setCurrentQIndex(0);
            setSelectedAnswers(new Array(questions.length).fill(null));
          }}
        ]);
      }
    } catch (err) {
      console.error('Failed to submit score:', err);
      Alert.alert('Error', 'Failed to save your progress.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinish = () => {
    // Check if all answered
    if (selectedAnswers.includes(null as any)) {
      Alert.alert('Incomplete', 'Please answer all questions before submitting.');
      return;
    }
    
    // Calculate score
    let correct = 0;
    selectedAnswers.forEach((ans, idx) => {
      if (ans === questions[idx].answer) {
        correct++;
      }
    });
    
    const scorePercentage = Math.round((correct / questions.length) * 100);
    submitScore(scorePercentage);
  };

  const handleOptionSelect = (option: string) => {
    const newAnswers = [...selectedAnswers];
    newAnswers[currentQIndex] = option;
    setSelectedAnswers(newAnswers);
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#2563EB" />
      </SafeAreaView>
    );
  }

  if (questions.length === 0) return null; // handled in useEffect

  const question = questions[currentQIndex];

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-6 py-5 border-b border-gray-100 shadow-sm flex-row items-center justify-between">
        <Text className="text-gray-400 font-bold" onPress={() => router.back()}>Cancel</Text>
        <Text className="text-lg font-bold text-gray-900">Module Quiz</Text>
        <View className="w-10" />
      </View>

      {/* Progress */}
      <View className="px-6 py-6">
        <Text className="text-primary-600 font-bold mb-2">Question {currentQIndex + 1} of {questions.length}</Text>
        <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <View 
            className="h-full bg-primary-500" 
            style={{ width: `${((currentQIndex + 1) / questions.length) * 100}%` }} 
          />
        </View>
      </View>

      {/* Question Card */}
      <View className="bg-white mx-6 p-6 rounded-3xl shadow-sm border border-gray-100 mb-6">
        <Text className="text-xl font-bold text-gray-900 mb-8 leading-tight">
          {question.q}
        </Text>

        {question.options.map((option, idx) => {
          const isSelected = selectedAnswers[currentQIndex] === option;
          return (
            <TouchableOpacity
              key={idx}
              onPress={() => handleOptionSelect(option)}
              className={`p-4 rounded-xl mb-4 border ${isSelected ? 'border-primary-500 bg-blue-50' : 'border-gray-200 bg-white'}`}
            >
              <Text className={`font-medium ${isSelected ? 'text-primary-700 font-bold' : 'text-gray-700'}`}>
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Footer Navigation */}
      <View className="flex-1 justify-end px-6 mb-10">
        <View className="flex-row justify-between">
          <TouchableOpacity 
            disabled={currentQIndex === 0}
            onPress={() => setCurrentQIndex(prev => prev - 1)}
            className={`px-6 py-4 rounded-xl ${currentQIndex === 0 ? 'bg-gray-100' : 'bg-gray-200'}`}
          >
            <Text className={`font-bold ${currentQIndex === 0 ? 'text-gray-400' : 'text-gray-700'}`}>Previous</Text>
          </TouchableOpacity>

          {currentQIndex < questions.length - 1 ? (
            <TouchableOpacity 
              disabled={!selectedAnswers[currentQIndex]}
              onPress={() => setCurrentQIndex(prev => prev + 1)}
              className={`px-8 py-4 rounded-xl ${!selectedAnswers[currentQIndex] ? 'bg-primary-300' : 'bg-primary-600'}`}
            >
              <Text className="text-white font-bold">Next</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              disabled={submitting || !selectedAnswers[currentQIndex]}
              onPress={handleFinish}
              className={`px-8 py-4 rounded-xl ${(!selectedAnswers[currentQIndex] || submitting) ? 'bg-green-300' : 'bg-green-500'}`}
            >
              <Text className="text-white font-bold">{submitting ? 'Evaluating...' : 'Submit Quiz'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
