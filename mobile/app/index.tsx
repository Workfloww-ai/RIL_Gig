import React, { useState } from 'react';
import { View, Text, StatusBar, Platform, Alert, Image, Modal, TouchableOpacity, Linking, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useRouter } from 'expo-router';
import { Button } from '../src/components/Button';
import { Input } from '../src/components/Input';
import { apiClient } from '../src/api/client';
import { Watermark } from '../src/components/Watermark';

export default function LoginScreen() {
  const router = useRouter();
  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showFinanceModal, setShowFinanceModal] = useState(false);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  React.useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

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
      if (status === 'redirect_finance') {
        setShowFinanceModal(true);
      } else if (status === 'existing_user') {
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
      {/* Decorative Brand Line - Top Edge */}
      <View style={{ height: 6, flexDirection: 'row', zIndex: 50 }}>
        <View style={{ flex: 1, backgroundColor: '#0B5B31' }} />
        <View style={{ width: 0, height: 0, borderTopWidth: 6, borderTopColor: '#0B5B31', borderRightWidth: 6, borderRightColor: 'transparent', marginLeft: -1 }} />
        <View style={{ width: 4, height: 6, backgroundColor: 'transparent' }} />
        <View style={{ width: 0, height: 0, borderBottomWidth: 6, borderBottomColor: '#D32F2F', borderLeftWidth: 6, borderLeftColor: 'transparent', marginRight: -1 }} />
        <View style={{ flex: 1, backgroundColor: '#D32F2F' }} />
      </View>
      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        extraScrollHeight={20}
        className="flex-1 px-8"
      >

        {/* Top Spacer - hidden when keyboard is open to keep logo visible */}
        {!isKeyboardVisible && <View style={{ flex: 0.3, minHeight: 10 }} />}

        <View className="mb-6 items-center">
          <Image
            source={require('../assets/images/newlogo.png')}
            style={{ 
              width: isKeyboardVisible ? 90 : 250, 
              height: isKeyboardVisible ? 90 : 250, 
              resizeMode: 'contain', 
              marginBottom: isKeyboardVisible ? 4 : 16 
            }}
          />
          <Text className="text-5xl font-bold text-[#D32F2F] mb-3 tracking-tight text-center leading-[65px]">Sah<Text className="text-moss/80">Yogi</Text></Text>
          <Text className="text-sage text-lg font-medium text-center">Enter your mobile number to get started.</Text>
        </View>

        <Input
          label="Mobile Number"
          placeholder="e.g. 98765 43210"
          keyboardType="numeric"
          value={mobile}
          onChangeText={setMobile}
          error={error}
          maxLength={10}
        />

        <View className="mt-4">
          <Button title="Continue" onPress={handleContinue} loading={loading} />
        </View>

        {/* Bottom Spacer to push the footer to the bottom */}
        <View className="flex-1 min-h-[40px]" />

        <View className="items-center pb-4">
          <Text className="text-sage text-sm font-medium tracking-widest">POWERED BY WORKFLOWW.AI</Text>
        </View>
      </KeyboardAwareScrollView>

      {/* Decorative Brand Line - Bottom Edge */}
      <View style={{ height: 6, flexDirection: 'row', zIndex: 50 }}>
        <View style={{ flex: 1, backgroundColor: '#0B5B31' }} />
        <View style={{ width: 0, height: 0, borderTopWidth: 6, borderTopColor: '#0B5B31', borderRightWidth: 6, borderRightColor: 'transparent', marginLeft: -1 }} />
        <View style={{ width: 4, height: 6, backgroundColor: 'transparent' }} />
        <View style={{ width: 0, height: 0, borderBottomWidth: 6, borderBottomColor: '#D32F2F', borderLeftWidth: 6, borderLeftColor: 'transparent', marginRight: -1 }} />
        <View style={{ flex: 1, backgroundColor: '#D32F2F' }} />
      </View>

      <Modal visible={showFinanceModal} transparent animationType="fade">
        <View className="flex-1 justify-center items-center bg-black/50 px-6">
          <View className="bg-white rounded-3xl p-6 w-full shadow-xl">
            <Text className="text-xl font-bold text-slate mb-3">Finance Portal</Text>
            <Text className="text-sage text-base mb-6 leading-relaxed">
              Finance users should log in via the web dashboard.
            </Text>
            <View className="flex-row justify-end">
              <TouchableOpacity
                onPress={() => setShowFinanceModal(false)}
                className="px-5 py-2.5 mr-2 rounded-xl"
              >
                <Text className="text-moss font-bold text-base">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setShowFinanceModal(false);
                  Linking.openURL('http://financedashboard.sahyogi.net.in/');
                }}
                className="px-5 py-2.5 rounded-xl"
              >
                <Text className="text-moss font-bold text-base">Open Portal</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
