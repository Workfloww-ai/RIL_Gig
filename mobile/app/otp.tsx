import React, { useState } from 'react';
import { View, Text, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Button } from '../src/components/Button';
import { Input } from '../src/components/Input';
import { apiClient } from '../src/api/client';
import { useAuthStore } from '../src/store/authStore';

export default function OTPScreen() {
  const router = useRouter();
  const { mobile } = useLocalSearchParams();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const setToken = useAuthStore(state => state.setToken);

  const handleVerify = async () => {
    if (otp.length < 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const response = await apiClient.post('/auth/verify-otp', {
        mobile_number: mobile,
        otp: otp
      });

      const { token, status } = response.data;
      if (status === 'login_success') {
        setToken(token);
        // Replace this with navigation to your main app dashboard later
        alert("Login Success! You are now authenticated.");
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid or expired OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-center px-8">
        <View className="mb-12">
          <Text className="text-4xl font-bold text-gray-900 mb-3 tracking-tight">Verify OTP</Text>
          <Text className="text-gray-500 text-lg font-medium leading-relaxed">
            We've sent a verification code to {"\n"}
            <Text className="font-bold text-primary-500">{mobile}</Text>
          </Text>
        </View>
        
        <Input 
          label="6-Digit OTP"
          placeholder="------"
          keyboardType="numeric"
          value={otp}
          onChangeText={setOtp}
          error={error}
          maxLength={6}
          textAlign="center"
          style={{ fontSize: 24, letterSpacing: 10, fontWeight: 'bold' }}
        />
        
        <View className="mt-8">
          <Button title="Verify & Login" onPress={handleVerify} loading={loading} />
        </View>
        
        <Button 
          title="Resend Code" 
          variant="outline" 
          onPress={() => apiClient.post('/auth/send-otp', { mobile_number: mobile })} 
          disabled={loading} 
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
