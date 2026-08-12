import React, { useState } from 'react';
import { View, Text, SafeAreaView, StatusBar, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Button } from '../src/components/Button';
import { Input } from '../src/components/Input';
import { apiClient } from '../src/api/client';
import { useAuthStore } from '../src/store/authStore';

export default function OTPScreen() {
  const router = useRouter();
  const { mobile, userDetails, documentsMetadata } = useLocalSearchParams() as { mobile: string, userDetails?: string, documentsMetadata?: string };
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

      let response;

      if (userDetails && documentsMetadata) {
        // Atomic Signup Flow
        const formData = new FormData();
        formData.append('mobile_number', mobile as string);
        formData.append('otp', otp);
        formData.append('user_details', userDetails);

        // Parse metadata to extract URI and then rebuild the clean metadata
        const metadataList = JSON.parse(documentsMetadata);
        const cleanMetadata = metadataList.map((m: any) => ({
          filename: m.filename,
          doc_name: m.doc_name,
          doc_number: m.doc_number
        }));
        formData.append('metadata', JSON.stringify(cleanMetadata));

        // Append files using a for...of loop so we can await the blob fetch
        for (const doc of metadataList) {
          const fileResp = await fetch(doc.uri);
          const blob = await fileResp.blob();

          // In React Native, some environments support the File class, others support passing a blob directly with a filename string
          formData.append('files', blob, doc.filename);
        }

        // React Native Axios has known bugs with FormData file uploads, so we use native fetch
        const fetchResponse = await fetch(`${apiClient.defaults.baseURL}/auth/verify-and-signup`, {
          method: 'POST',
          body: formData,
          headers: {
            'Accept': 'application/json',
          },
        });

        const data = await fetchResponse.json();

        if (!fetchResponse.ok) {
          throw { response: { data: data } };
        }

        response = { data };
      } else {
        // Standard Login Flow
        response = await apiClient.post('/auth/verify-otp', {
          mobile_number: mobile,
          otp: otp
        });
      }

      const { token, status } = response.data;
      if (status === 'login_success') {
        setToken(token);
        // Go straight to library screen
        router.replace('/library');
      }
    } catch (err: any) {
      console.error("OTP Verification Error:", err.message);

      if (err.response) {
        console.error(
          "Backend Error Data:",
          JSON.stringify(err.response.data, null, 2)
        );

        const detail = err.response.data?.detail;

        if (typeof detail === "string") {
          setError(detail);
        } else if (Array.isArray(detail)) {
          // FastAPI 422 Validation Error
          setError(detail[0]?.msg || "Validation Error");
        } else {
          setError("Server returned an error");
        }
      } else {
        setError("Network error. Cannot reach server.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white pt-8">
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

        <View className="mt-5">
          <Button title="Verify & Login" onPress={handleVerify} loading={loading} />
        </View>
        <View style={{ marginTop: 8 }}>
        <Button
          title="Resend Code"
          variant="ghost"
          onPress={() => apiClient.post('/auth/send-otp', { mobile_number: mobile })}
          disabled={loading}
          style={{ color: '#2563EB' }}
          
        />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
