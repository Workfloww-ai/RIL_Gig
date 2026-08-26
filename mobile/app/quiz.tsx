import React, { useState, useEffect } from 'react';
import { View, Text, SafeAreaView, Platform, StatusBar, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
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

  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchModule = async () => {
      try {
        const response = await apiClient.get(`/content/modules`);
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
        module_id: id,
        score
      });
      
      if (res.data.passed) {
        Alert.alert('Congratulations! 🎉', `You passed with ${score}%.`, [
          { text: 'Go to Dashboard', onPress: () => router.push({ pathname: '/library', params: { justCompleted: 'true' } }) }
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
      <SafeAreaView className="flex-1 bg-cream items-center justify-center pt-8">
        <ActivityIndicator size="large" color="#0B5B31" />
      </SafeAreaView>
    );
  }

  if (questions.length === 0) return null; // handled in useEffect

  const question = questions[currentQIndex];

  return (
    <SafeAreaView className="flex-1 bg-sand pt-8">
      {/* Header */}
      <View className="bg-cream px-6 py-5 border-b border-sage/10 shadow-sm flex-row items-center justify-between">
        <Text className="text-sage font-bold" onPress={() => router.back()}>Cancel</Text>
        <Text className="text-lg font-bold text-slate">Module Quiz</Text>
        <View className="w-10" />
      </View>

      {/* Progress */}
      <View className="px-6 py-6">
        <Text className="text-moss font-bold mb-2">Question {currentQIndex + 1} of {questions.length}</Text>
        <View className="h-2 bg-sage/20 rounded-full overflow-hidden">
          <View 
            className="h-full bg-moss/80" 
            style={{ width: `${((currentQIndex + 1) / questions.length) * 100}%` }} 
          />
        </View>
      </View>

      {/* Question Card */}
      <View className="bg-cream mx-6 p-6 rounded-3xl shadow-sm border border-sage/10 mb-6">
        <Text className="text-xl font-bold text-slate mb-8 leading-tight">
          {question.q}
        </Text>

        {question.options.map((option, idx) => {
          const isSelected = selectedAnswers[currentQIndex] === option;
          return (
            <TouchableOpacity
              key={idx}
              onPress={() => handleOptionSelect(option)}
              className={`p-4 rounded-xl mb-4 border ${isSelected ? 'border-moss/50 bg-blue-50' : 'border-sage/20 bg-cream'}`}
            >
              <Text className={`font-medium ${isSelected ? 'text-moss font-bold' : 'text-slate'}`}>
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
            className={`px-6 py-4 rounded-xl ${currentQIndex === 0 ? 'bg-sage/10' : 'bg-sage/20'}`}
          >
            <Text className={`font-bold ${currentQIndex === 0 ? 'text-sage' : 'text-slate'}`}>Previous</Text>
          </TouchableOpacity>

          {currentQIndex < questions.length - 1 ? (
            <TouchableOpacity 
              disabled={!selectedAnswers[currentQIndex]}
              onPress={() => setCurrentQIndex(prev => prev + 1)}
              className={`px-8 py-4 rounded-xl ${!selectedAnswers[currentQIndex] ? 'bg-primary-300' : 'bg-moss'}`}
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
