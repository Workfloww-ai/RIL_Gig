import React, { useState } from 'react';
import { View, Text, SafeAreaView, StatusBar, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Button } from '../src/components/Button';
import { Input } from '../src/components/Input';
import { apiClient } from '../src/api/client';
import { useAuthStore } from '../src/store/authStore';
import { Watermark } from '../src/components/Watermark';

export default function OTPScreen() {
  const router = useRouter();
  const { mobile, userDetails, documentsMetadata } = useLocalSearchParams() as { mobile: string, userDetails?: string, documentsMetadata?: string };
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const setToken = useAuthStore(state => state.setToken);

  const formatMobileNumber = (num: string | string[]) => {
    if (!num) return '';
    const numStr = Array.isArray(num) ? num[0] : num.toString();
    const cleaned = numStr.replace(/\D/g, '');
    if (cleaned.startsWith('91') && cleaned.length >= 12) {
      return `+91 ${cleaned.slice(2, 7)} ${cleaned.slice(7, 12)}`;
    }
    return numStr;
  };

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

      const { token, status, role } = response.data;
      if (status === 'login_success') {
        setToken(token);

        if (role === 'superadmin') {
          router.replace('/superadmin');
        } else if (role === 'store_manager' || role === 'supervisor') {
          router.replace('/store_manager');
        } else {
          router.replace('/library');
        }
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
    <SafeAreaView className="flex-1 bg-cream pt-8">
      {/* Decorative Brand Line - Top Edge */}
      <View style={{ height: 6, flexDirection: 'row', zIndex: 50 }}>
        <View style={{ flex: 1, backgroundColor: '#0B5B31' }} />
        <View style={{ width: 16, height: 6, backgroundColor: '#0B5B31', zIndex: 2 }}>
          <View style={{ position: 'absolute', left: 4, width: 40, height: 6, backgroundColor: '#D32F2F', transform: [{ skewX: '45deg' }] }} />
          <View style={{ position: 'absolute', left: 4, width: 4, height: 6, backgroundColor: '#FFFFFF', transform: [{ skewX: '45deg' }] }} />
        </View>
        <View style={{ flex: 1, backgroundColor: '#D32F2F', zIndex: 1 }} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20} className="flex-1 px-8">
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 20 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          <View className="mb-12 items-center">
            <Text className="text-4xl font-bold text-slate mb-3 tracking-tight">Verify OTP</Text>
            <Text className="text-sage text-lg font-medium leading-relaxed text-center">
              We've sent a verification code to {"\n"}
              <Text className="font-bold text-moss/80">{formatMobileNumber(mobile)}</Text>
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
            <Button title="Login" onPress={handleVerify} loading={loading} />
          </View>
          <View style={{ marginTop: 8 }}>
            <Button
              title="Resend Code"
              variant="ghost"
              onPress={() => apiClient.post('/auth/send-otp', { mobile_number: mobile })}
              disabled={loading}
              style={{ color: '#0B5B31' }}
            />
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Decorative Brand Line - Bottom Edge */}
      <View style={{ height: 6, flexDirection: 'row', zIndex: 50 }}>
        <View style={{ flex: 1, backgroundColor: '#0B5B31' }} />
        <View style={{ width: 16, height: 6, backgroundColor: '#0B5B31', zIndex: 2 }}>
          <View style={{ position: 'absolute', left: 4, width: 40, height: 6, backgroundColor: '#D32F2F', transform: [{ skewX: '45deg' }] }} />
          <View style={{ position: 'absolute', left: 4, width: 4, height: 6, backgroundColor: '#FFFFFF', transform: [{ skewX: '45deg' }] }} />
        </View>
        <View style={{ flex: 1, backgroundColor: '#D32F2F', zIndex: 1 }} />
      </View>
    </SafeAreaView>
  );
}
