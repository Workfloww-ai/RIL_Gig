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
  const [currentSelection, setCurrentSelection] = useState<string | null>(null);
  const [isIncorrect, setIsIncorrect] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchModule = async () => {
      try {
        const response = await apiClient.get(`/content/modules`);
        const module = response.data.find((m: any) => m.id === id);
        
        if (module && module.quiz_questions && module.quiz_questions.length > 0) {
          setQuestions(module.quiz_questions);
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
      await apiClient.post('/content/submit-quiz', {
        module_id: id,
        score
      });
      
      Alert.alert('Congratulations! 🎉', 'You have successfully completed this module.', [
        { text: 'Go to Dashboard', onPress: () => router.push({ pathname: '/library', params: { justCompleted: 'true' } }) }
      ]);
    } catch (err) {
      console.error('Failed to submit score:', err);
      Alert.alert('Error', 'Failed to save your progress.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    if (!currentSelection) return;
    
    const isCorrect = currentSelection === questions[currentQIndex].answer;
    
    if (isCorrect) {
      if (currentQIndex < questions.length - 1) {
        setCurrentQIndex(prev => prev + 1);
        setCurrentSelection(null);
        setIsIncorrect(false);
      } else {
        submitScore(100);
      }
    } else {
      setIsIncorrect(true);
    }
  };

  const handleOptionSelect = (option: string) => {
    setCurrentSelection(option);
    setIsIncorrect(false);
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
      <View className="bg-white px-6 py-5 border-b border-gray-100 shadow-sm flex-row items-center justify-between">
        <Text className="text-gray-400 font-bold" onPress={() => router.back()}>Cancel</Text>
        <Text className="text-lg font-bold text-charcoal">Module Quiz</Text>
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
      <View className="bg-white mx-6 p-6 rounded-3xl shadow-sm border border-gray-100 mb-6">
        <Text className="text-xl font-bold text-charcoal mb-8 leading-tight">
          {question.q}
        </Text>

        {question.options.map((option, idx) => {
          const isSelected = currentSelection === option;
          let borderClass = 'border-sage/20 bg-cream';
          let textClass = 'text-slate';

          if (isSelected) {
            if (isIncorrect) {
              borderClass = 'border-red-500 bg-red-50';
              textClass = 'text-red-600 font-bold';
            } else {
              borderClass = 'border-moss/50 bg-blue-50';
              textClass = 'text-moss font-bold';
            }
          }

          return (
            <TouchableOpacity
              key={idx}
              onPress={() => handleOptionSelect(option)}
              className={`p-4 rounded-xl mb-4 border ${borderClass}`}
            >
              <Text className={`font-medium ${textClass}`}>
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}

        {isIncorrect && (
          <View className="bg-red-50 p-4 rounded-xl mt-2 border border-red-200">
            <Text className="text-red-600 font-bold text-center">
              Incorrect answer. Please select another option.
            </Text>
          </View>
        )}
      </View>

      {/* Footer Navigation */}
      <View className="flex-1 justify-end px-6 mb-10">
        <TouchableOpacity 
          disabled={!currentSelection || submitting}
          onPress={handleNext}
          className={`py-4 rounded-xl items-center w-full ${(!currentSelection || submitting) ? 'bg-primary-300' : 'bg-moss'}`}
        >
          <Text className="text-white font-bold text-lg">
            {submitting ? 'Submitting...' : currentQIndex === questions.length - 1 ? 'Finish Module' : 'Check & Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
