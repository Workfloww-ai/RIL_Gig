import React, { useState } from 'react';
import { View, Text, SafeAreaView, StatusBar, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '../src/components/Button';
import { Input } from '../src/components/Input';
import { apiClient } from '../src/api/client';

export default function LoginScreen() {
  const router = useRouter();
  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleContinue = async () => {
    if (mobile.length < 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }
    setError('');
    setLoading(true);

    try {
      console.log(`Sending request to backend for mobile: 91${mobile}`);
      const response = await apiClient.post('/auth/check-mobile', {
        mobile_number: `+91${mobile}`, // Stripping the + sign as backend requested
      });
      console.log('Backend response:', response.data);

      const { status } = response.data;
      if (status === 'existing_user') {
        // Send OTP directly for existing user before redirecting
        console.log('User exists, sending OTP...');
        await apiClient.post('/auth/send-otp', {
          mobile_number: `91${mobile}`
        });
        router.push({ pathname: '/otp', params: { mobile: `91${mobile}` } });
      } else {
        router.push({ pathname: '/signup/details', params: { mobile: `91${mobile}` } });
      }
    } catch (err: any) {
      console.error('API Error:', err.message, err.response?.data);
      setError(err.response?.data?.detail || 'An error occurred. Make sure your local server is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-cream pt-8">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-center px-8">
        <View className="mb-12">
          <Text className="text-5xl font-bold text-slate mb-3 tracking-tight">SAH<Text className="text-moss/80">YOGI</Text></Text>
          <Text className="text-sage text-lg font-medium">Enter your mobile number to get started.</Text>
          
        </View>
        
        <Input 
          label="Mobile Number"
          placeholder="e.g. 9876543210"
          keyboardType="numeric"
          value={mobile}
          onChangeText={setMobile}
          error={error}
          maxLength={10}
        />
        
        <View className="mt-4">
          <Button title="Continue" onPress={handleContinue} loading={loading} />
        </View>
        
        <View className="absolute bottom-8 left-0 right-0 items-center">
          <Text className="text-sage text-sm font-medium tracking-widest">POWERED BY LUCID</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
