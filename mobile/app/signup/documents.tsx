import React, { useState } from 'react';
import { View, Text, Platform, StatusBar, ScrollView, Alert, Modal, TouchableOpacity, Linking, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { apiClient } from '../../src/api/client';

interface DocumentEntry {
  doc_name: string;
  doc_number: string;
  uri: string;
  filename: string;
  type: string;
}

export default function DocumentsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user_id, mobile, userDetails } = useLocalSearchParams() as { user_id?: string, mobile: string, userDetails?: string };
  const [documents, setDocuments] = useState<DocumentEntry[]>([]);
  const [docNumbers, setDocNumbers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [topError, setTopError] = useState<string>('');

  // Aadhaar OTP Verification States
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [aadhaarOtp, setAadhaarOtp] = useState('');
  const [aadhaarRefId, setAadhaarRefId] = useState('');
  const [isAadhaarVerified, setIsAadhaarVerified] = useState(false);
  const [showAadhaarOtpInput, setShowAadhaarOtpInput] = useState(false);
  const [aadhaarLoading, setAadhaarLoading] = useState(false);

  // PAN Verification States
  const [panNumber, setPanNumber] = useState('');
  const [isPanVerified, setIsPanVerified] = useState(false);
  const [panRegisteredName, setPanRegisteredName] = useState('');
  const [panLoading, setPanLoading] = useState(false);

  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentAadhar, setConsentAadhar] = useState(false);
  const [consentPan, setConsentPan] = useState(false);
  const [consentPrivacy, setConsentPrivacy] = useState(false);

  const allConsented = consentAadhar && consentPan && consentPrivacy;

  const requiredDocs = [
    { 
      key: 'Certification/Marksheet', 
      name: 'Certification/Marksheet', 
      desc: '10th / 12th / Skill certificate (Image or PDF)',
      icon: 'school-outline' as const 
    },
    { 
      key: 'Live Photo', 
      name: 'Live Photo', 
      desc: 'Take a clear, well-lit selfie using camera',
      icon: 'camera-outline' as const 
    }
  ];

  const getDoc = (name: string) => documents.find(d => d.doc_name === name);

  // Progress Calculation
  const totalSteps = 4;
  let completedSteps = 0;
  if (isAadhaarVerified) completedSteps++;
  if (isPanVerified) completedSteps++;
  if (getDoc('Certification/Marksheet')) completedSteps++;
  if (getDoc('Live Photo')) completedSteps++;

  const handleSendAadhaarOtp = async () => {
    const clean = aadhaarNumber.replace(/\s+/g, '');
    if (!clean || clean.length !== 12) {
      setErrors(prev => ({ ...prev, aadhaar: 'Please enter a valid 12-digit Aadhaar number.' }));
      return;
    }
    setAadhaarLoading(true);
    setErrors(prev => ({ ...prev, aadhaar: '' }));
    try {
      const response = await apiClient.post('/auth/kyc/aadhaar/send-otp', { 
        aadhaar_number: clean,
        mobile_number: mobile || ''
      });
      setAadhaarRefId(response.data.ref_id);
      setShowAadhaarOtpInput(true);
      Alert.alert('OTP Sent', 'An OTP has been sent to your Aadhaar-registered mobile number.');
    } catch (error: any) {
      console.error(error);
      setErrors(prev => ({ ...prev, aadhaar: error.response?.data?.detail || 'Failed to send OTP.' }));
    } finally {
      setAadhaarLoading(false);
    }
  };

  const handleVerifyAadhaarOtp = async () => {
    if (!aadhaarOtp || aadhaarOtp.length < 4) {
      setErrors(prev => ({ ...prev, aadhaar_otp: 'Please enter a valid OTP.' }));
      return;
    }
    setAadhaarLoading(true);
    setErrors(prev => ({ ...prev, aadhaar_otp: '' }));
    try {
      const response = await apiClient.post('/auth/kyc/aadhaar/verify-otp', { 
        otp: aadhaarOtp.trim(),
        ref_id: aadhaarRefId
      });
      setIsAadhaarVerified(true);
      setShowAadhaarOtpInput(false);
      Alert.alert('Verified', 'Aadhaar verified successfully!');
    } catch (error: any) {
      console.error(error);
      setErrors(prev => ({ ...prev, aadhaar_otp: error.response?.data?.detail || 'Failed to verify OTP.' }));
    } finally {
      setAadhaarLoading(false);
    }
  };

  const handleVerifyPan = async () => {
    const cleanPan = panNumber.trim().toUpperCase();
    if (!cleanPan || cleanPan.length !== 10) {
      setErrors(prev => ({ ...prev, pan: 'Please enter a valid 10-character PAN number.' }));
      return;
    }
    setPanLoading(true);
    setErrors(prev => ({ ...prev, pan: '' }));
    try {
      let parsedName = '';
      try {
        if (userDetails) {
          const parsed = JSON.parse(userDetails);
          parsedName = parsed.full_name || '';
        }
      } catch {}

      const response = await apiClient.post('/auth/kyc/pan/verify', { 
        pan: cleanPan,
        name: parsedName || undefined
      });
      setIsPanVerified(true);
      const regName = response.data.registered_name || response.data.name_registered || '';
      setPanRegisteredName(regName);
      Alert.alert('Verified', response.data.message || 'PAN Card verified successfully!');
    } catch (error: any) {
      console.error(error);
      setErrors(prev => ({ ...prev, pan: error.response?.data?.detail || 'Failed to verify PAN.' }));
    } finally {
      setPanLoading(false);
    }
  };

  const pickImage = async (docName: string) => {
    let result;

    if (docName === 'Live Photo') {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert("Camera Permission Required", "We need access to your camera to take a live photo.");
        return;
      }

      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
    }

    if (!result.canceled) {
      const asset = result.assets[0];
      const filename = asset.fileName || asset.uri.split('/').pop() || 'document.jpg';
      
      setDocuments(prev => {
        const filtered = prev.filter(d => d.doc_name !== docName);
        return [...filtered, {
          doc_name: docName,
          doc_number: '',
          uri: asset.uri,
          filename: filename,
          type: asset.mimeType || 'image/jpeg'
        }];
      });
      
      if (errors[docName]) {
        setErrors(prev => ({ ...prev, [docName]: '' }));
      }
    }
  };

  const handleInitialSubmit = () => {
    setErrors({});
    setTopError('');
    let hasError = false;
    const newErrors: Record<string, string> = {};

    if (!isAadhaarVerified) {
      newErrors['aadhaar'] = 'Aadhaar verification is required';
      hasError = true;
    }

    if (!isPanVerified) {
      newErrors['pan'] = 'PAN verification is required';
      hasError = true;
    }

    requiredDocs.forEach(reqDoc => {
      const doc = getDoc(reqDoc.name);
      if (!doc) {
        newErrors[reqDoc.name] = `${reqDoc.name} is required`;
        hasError = true;
      }
    });

    if (hasError) {
      setErrors(newErrors);
      setTopError('Please complete all 4 KYC verification steps to continue.');
      return;
    }

    setShowConsentModal(true);
  };

  const submitDocuments = async () => {
    setShowConsentModal(false);
    setLoading(true);
    try {
      const documentsMetadata = documents.map(d => ({
        filename: d.filename,
        doc_name: d.doc_name,
        doc_number: docNumbers[d.doc_name] || '',
        uri: d.uri,
        type: d.type
      }));
      
      documentsMetadata.push({
        filename: 'aadhaar_verified_via_otp',
        doc_name: 'Aadhar Card',
        doc_number: aadhaarNumber.replace(/\s+/g, ''),
        uri: '',
        type: 'verification'
      });

      documentsMetadata.push({
        filename: 'pan_verified_via_api',
        doc_name: 'PAN Card',
        doc_number: panNumber.trim().toUpperCase(),
        uri: '',
        type: 'verification'
      });

      await apiClient.post('/auth/send-otp', { mobile_number: mobile });
      
      router.push({ 
        pathname: '/otp', 
        params: { 
          mobile,
          userDetails,
          documentsMetadata: JSON.stringify(documentsMetadata)
        } 
      });

    } catch (error: any) {
      console.error("Submit Error:", error);
      Alert.alert('Failed', error.response?.data?.detail || 'Something went wrong while requesting OTP. Please check again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Decorative Brand Accent Top Line */}
      <View style={{ height: 4, flexDirection: 'row', width: '100%' }}>
        <View style={{ flex: 1, backgroundColor: '#10472B' }} />
        <View style={{ width: 60, backgroundColor: '#D32F2F' }} />
      </View>

      <ScrollView 
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 60 + insets.bottom }} 
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <View style={{ marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontSize: 28, fontWeight: '800', color: '#1A1A1A', letterSpacing: -0.5 }}>
                Identity & KYC
              </Text>
              <Text style={{ fontSize: 14, color: '#666666', marginTop: 4 }}>
                Instant paperless verification to activate your account
              </Text>
            </View>
            {/* <View style={{ 
              backgroundColor: '#F2F6F4', 
              paddingHorizontal: 12, 
              paddingVertical: 6, 
              borderRadius: 20,
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: '#C3D3CA'
            }}> */}
              {/* <MaterialCommunityIcons name="shield-check" size={16} color="#10472B" />
              <Text style={{ color: '#10472B', fontWeight: '700', fontSize: 12, marginLeft: 4 }}>
                Secure
              </Text>
            </View> */}
          </View>

          {/* Progress Pill Bar */}
          {/* <View style={{ 
            marginTop: 16, 
            backgroundColor: '#F7F8F9', 
            borderRadius: 14, 
            padding: 12, 
            borderWidth: 1, 
            borderColor: '#EEEEEE' 
          }}> */}
            {/* <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#1A1A1A' }}>
                Verification Progress
              </Text>
              <Text style={{ fontSize: 13, fontWeight: '800', color: completedSteps === totalSteps ? '#10472B' : '#666666' }}>
                {completedSteps} of {totalSteps} Complete
              </Text>
            </View> */}
            {/* <View style={{ height: 6, backgroundColor: '#E0E0E0', borderRadius: 3, overflow: 'hidden' }}>
              <View style={{ 
                height: '100%', 
                width: `${(completedSteps / totalSteps) * 100}%`, 
                backgroundColor: completedSteps === totalSteps ? '#10472B' : '#10472B',
                borderRadius: 3 
              }} />
            </View> */}
          </View>
        {/* </View> */}

        {topError ? (
          <View style={{ 
            backgroundColor: '#FFEBEE', 
            borderColor: '#FFCDD2', 
            borderWidth: 1, 
            padding: 12, 
            borderRadius: 12, 
            marginBottom: 16,
            flexDirection: 'row',
            alignItems: 'center'
          }}>
            <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#D32F2F" style={{ marginRight: 8 }} />
            <Text style={{ color: '#D32F2F', fontWeight: '600', fontSize: 13, flex: 1 }}>{topError}</Text>
          </View>
        ) : null}

        {/* 1. Aadhaar Card Card */}
        <View style={{ 
          backgroundColor: '#FFFFFF', 
          borderRadius: 18, 
          padding: 18, 
          marginBottom: 16,
          borderWidth: 1.5,
          borderColor: isAadhaarVerified ? '#A7D7B5' : (errors.aadhaar ? '#FFCDD2' : '#EAEAEA'),
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.04,
          shadowRadius: 6,
          elevation: 2
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={{ 
                width: 40, 
                height: 40, 
                borderRadius: 12, 
                backgroundColor: isAadhaarVerified ? '#E8F5E9' : '#F2F6F4',
                alignItems: 'center', 
                justifyContent: 'center',
                marginRight: 12 
              }}>
                <MaterialCommunityIcons 
                  name="card-account-details-outline" 
                  size={22} 
                  color={isAadhaarVerified ? '#10472B' : '#10472B'} 
                />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A1A1A' }}>
                    Aadhaar Verification
                  </Text>
                  <Text style={{ color: '#D32F2F', marginLeft: 2, fontWeight: '700' }}>*</Text>
                </View>
                <Text style={{ fontSize: 12, color: '#777777', marginTop: 1 }}>
                  Instant OTP via UIDAI
                </Text>
              </View>
            </View>

            {isAadhaarVerified ? (
              <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                backgroundColor: '#E8F5E9', 
                paddingHorizontal: 10, 
                paddingVertical: 5, 
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#C8E6C9'
              }}>
                <MaterialCommunityIcons name="check-circle" size={15} color="#10472B" style={{ marginRight: 4 }} />
                <Text style={{ color: '#10472B', fontWeight: '800', fontSize: 11 }}>Verified</Text>
              </View>
            ) : (
              <View style={{ 
                backgroundColor: '#FFF8E1', 
                paddingHorizontal: 8, 
                paddingVertical: 4, 
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#FFE082'
              }}>
                <Text style={{ color: '#F57F17', fontWeight: '700', fontSize: 11 }}>Pending</Text>
              </View>
            )}
          </View>

          {!isAadhaarVerified ? (
            <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F0F0F0' }}>
              <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                backgroundColor: '#F8F9FA', 
                borderRadius: 12, 
                borderWidth: 1, 
                borderColor: errors.aadhaar ? '#D32F2F' : '#E0E0E0',
                paddingHorizontal: 14,
                marginBottom: errors.aadhaar ? 4 : 10
              }}>
                <MaterialCommunityIcons name="numeric" size={20} color="#888888" style={{ marginRight: 8 }} />
                <InputPrimitive
                  placeholder="12-digit Aadhaar Number"
                  value={aadhaarNumber}
                  onChangeText={(val: string) => {
                    const cleaned = val.replace(/\D/g, '').slice(0, 12);
                    setAadhaarNumber(cleaned);
                  }}
                  keyboardType="numeric"
                  maxLength={12}
                  editable={!showAadhaarOtpInput}
                  style={{ flex: 1, height: 48, fontSize: 15, fontWeight: '600', color: '#1A1A1A' }}
                />
              </View>
              {errors.aadhaar ? (
                <Text style={{ color: '#D32F2F', fontSize: 12, marginBottom: 10, marginLeft: 4 }}>
                  {errors.aadhaar}
                </Text>
              ) : null}

              {showAadhaarOtpInput ? (
                <View style={{ marginTop: 4 }}>
                  <View style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    backgroundColor: '#F8F9FA', 
                    borderRadius: 12, 
                    borderWidth: 1, 
                    borderColor: errors.aadhaar_otp ? '#D32F2F' : '#E0E0E0',
                    paddingHorizontal: 14,
                    marginBottom: errors.aadhaar_otp ? 4 : 10
                  }}>
                    <MaterialCommunityIcons name="lock-outline" size={20} color="#888888" style={{ marginRight: 8 }} />
                    <InputPrimitive
                      placeholder="Enter 6-digit OTP"
                      value={aadhaarOtp}
                      onChangeText={setAadhaarOtp}
                      keyboardType="numeric"
                      maxLength={6}
                      style={{ flex: 1, height: 48, fontSize: 15, fontWeight: '600', color: '#1A1A1A' }}
                    />
                  </View>
                  {errors.aadhaar_otp ? (
                    <Text style={{ color: '#D32F2F', fontSize: 12, marginBottom: 10, marginLeft: 4 }}>
                      {errors.aadhaar_otp}
                    </Text>
                  ) : null}

                  <TouchableOpacity
                    onPress={handleVerifyAadhaarOtp}
                    disabled={aadhaarLoading}
                    style={{ 
                      backgroundColor: '#10472B', 
                      height: 46, 
                      borderRadius: 12, 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      flexDirection: 'row'
                    }}
                  >
                    {aadhaarLoading ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="check-decagram" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>Verify OTP</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={handleSendAadhaarOtp}
                  disabled={aadhaarLoading}
                  style={{ 
                    backgroundColor: '#10472B', 
                    height: 46, 
                    borderRadius: 12, 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    flexDirection: 'row'
                  }}
                >
                  {aadhaarLoading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="send-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>Get OTP</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F0F0F0', flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="shield-check" size={18} color="#10472B" style={{ marginRight: 6 }} />
              <Text style={{ fontSize: 13, color: '#555555' }}>
                Aadhaar: <Text style={{ fontWeight: '700', color: '#1A1A1A' }}>XXXX-XXXX-{aadhaarNumber.slice(-4)}</Text>
              </Text>
            </View>
          )}
        </View>

        {/* 2. PAN Card Card */}
        <View style={{ 
          backgroundColor: '#FFFFFF', 
          borderRadius: 18, 
          padding: 18, 
          marginBottom: 16,
          borderWidth: 1.5,
          borderColor: isPanVerified ? '#A7D7B5' : (errors.pan ? '#FFCDD2' : '#EAEAEA'),
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.04,
          shadowRadius: 6,
          elevation: 2
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={{ 
                width: 40, 
                height: 40, 
                borderRadius: 12, 
                backgroundColor: isPanVerified ? '#E8F5E9' : '#F2F6F4',
                alignItems: 'center', 
                justifyContent: 'center',
                marginRight: 12 
              }}>
                <MaterialCommunityIcons 
                  name="credit-card-outline" 
                  size={22} 
                  color={isPanVerified ? '#10472B' : '#10472B'} 
                />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A1A1A' }}>
                    PAN Card Verification
                  </Text>
                  <Text style={{ color: '#D32F2F', marginLeft: 2, fontWeight: '700' }}>*</Text>
                </View>
                <Text style={{ fontSize: 12, color: '#777777', marginTop: 1 }}>
                  Real-time Income Tax Dept sync
                </Text>
              </View>
            </View>

            {isPanVerified ? (
              <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                backgroundColor: '#E8F5E9', 
                paddingHorizontal: 10, 
                paddingVertical: 5, 
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#C8E6C9'
              }}>
                <MaterialCommunityIcons name="check-circle" size={15} color="#10472B" style={{ marginRight: 4 }} />
                <Text style={{ color: '#10472B', fontWeight: '800', fontSize: 11 }}>Verified</Text>
              </View>
            ) : (
              <View style={{ 
                backgroundColor: '#FFF8E1', 
                paddingHorizontal: 8, 
                paddingVertical: 4, 
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#FFE082'
              }}>
                <Text style={{ color: '#F57F17', fontWeight: '700', fontSize: 11 }}>Pending</Text>
              </View>
            )}
          </View>

          {!isPanVerified ? (
            <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F0F0F0' }}>
              <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                backgroundColor: '#F8F9FA', 
                borderRadius: 12, 
                borderWidth: 1, 
                borderColor: errors.pan ? '#D32F2F' : '#E0E0E0',
                paddingHorizontal: 14,
                marginBottom: errors.pan ? 4 : 10
              }}>
                <MaterialCommunityIcons name="form-textbox" size={20} color="#888888" style={{ marginRight: 8 }} />
                <InputPrimitive
                  placeholder="10-character PAN"
                  value={panNumber}
                  onChangeText={(val) => setPanNumber(val.toUpperCase())}
                  autoCapitalize="characters"
                  maxLength={10}
                  style={{ flex: 1, height: 48, fontSize: 15, fontWeight: '600', color: '#1A1A1A' }}
                />
              </View>
              {errors.pan ? (
                <Text style={{ color: '#D32F2F', fontSize: 12, marginBottom: 10, marginLeft: 4 }}>
                  {errors.pan}
                </Text>
              ) : null}

              <TouchableOpacity
                onPress={handleVerifyPan}
                disabled={panLoading}
                style={{ 
                  backgroundColor: '#10472B', 
                  height: 46, 
                  borderRadius: 12, 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  flexDirection: 'row'
                }}
              >
                {panLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="check-decagram" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>Verify PAN</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F0F0F0' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="shield-check" size={18} color="#10472B" style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 13, color: '#555555' }}>
                  PAN: <Text style={{ fontWeight: '700', color: '#1A1A1A' }}>{panNumber.toUpperCase()}</Text>
                </Text>
              </View>
              {panRegisteredName ? (
                <Text style={{ fontSize: 12, color: '#666666', marginTop: 4, marginLeft: 24 }}>
                  Registered Name: <Text style={{ fontWeight: '600', color: '#10472B' }}>{panRegisteredName}</Text>
                </Text>
              ) : null}
            </View>
          )}
        </View>

        {/* 3 & 4. Upload Documents (Certification & Live Photo) */}
        {requiredDocs.map((reqDoc, index) => {
          const doc = getDoc(reqDoc.name);
          const docError = errors[reqDoc.name];
          const isUploaded = !!doc;
          
          return (
            <View key={index} style={{ 
              backgroundColor: '#FFFFFF', 
              borderRadius: 18, 
              padding: 18, 
              marginBottom: 16,
              borderWidth: 1.5,
              borderColor: isUploaded ? '#A7D7B5' : (docError ? '#FFCDD2' : '#EAEAEA'),
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.04,
              shadowRadius: 6,
              elevation: 2
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <View style={{ 
                    width: 40, 
                    height: 40, 
                    borderRadius: 12, 
                    backgroundColor: isUploaded ? '#E8F5E9' : '#F2F6F4',
                    alignItems: 'center', 
                    justifyContent: 'center',
                    marginRight: 12 
                  }}>
                    <MaterialCommunityIcons 
                      name={reqDoc.icon} 
                      size={22} 
                      color={isUploaded ? '#10472B' : '#10472B'} 
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A1A1A' }}>
                        {reqDoc.name}
                      </Text>
                      <Text style={{ color: '#D32F2F', marginLeft: 2, fontWeight: '700' }}>*</Text>
                    </View>
                    <Text style={{ fontSize: 12, color: '#777777', marginTop: 1 }}>
                      {reqDoc.desc}
                    </Text>
                  </View>
                </View>

                {isUploaded ? (
                  <View style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    backgroundColor: '#E8F5E9', 
                    paddingHorizontal: 10, 
                    paddingVertical: 5, 
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: '#C8E6C9'
                  }}>
                    <MaterialCommunityIcons name="check-circle" size={15} color="#10472B" style={{ marginRight: 4 }} />
                    <Text style={{ color: '#10472B', fontWeight: '800', fontSize: 11 }}>Uploaded</Text>
                  </View>
                ) : (
                  <View style={{ 
                    backgroundColor: '#FFF8E1', 
                    paddingHorizontal: 8, 
                    paddingVertical: 4, 
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#FFE082'
                  }}>
                    <Text style={{ color: '#F57F17', fontWeight: '700', fontSize: 11 }}>Required</Text>
                  </View>
                )}
              </View>

              <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F0F0F0' }}>
                {isUploaded && doc.uri ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <Image 
                      source={{ uri: doc.uri }} 
                      style={{ width: 50, height: 50, borderRadius: 10, marginRight: 12, backgroundColor: '#EEE' }} 
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#1A1A1A' }} numberOfLines={1}>
                        {doc.filename}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#10472B', fontWeight: '600', marginTop: 2 }}>
                        Ready for verification
                      </Text>
                    </View>
                  </View>
                ) : null}

                <TouchableOpacity
                  onPress={() => pickImage(reqDoc.name)}
                  style={{ 
                    backgroundColor: isUploaded ? '#FFFFFF' : '#10472B',
                    borderWidth: isUploaded ? 1.5 : 0,
                    borderColor: '#10472B',
                    height: 46, 
                    borderRadius: 12, 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    flexDirection: 'row'
                  }}
                >
                  <MaterialCommunityIcons 
                    name={isUploaded ? "pencil-outline" : (reqDoc.name === 'Live Photo' ? "camera" : "upload")} 
                    size={18} 
                    color={isUploaded ? '#10472B' : '#FFFFFF'} 
                    style={{ marginRight: 6 }} 
                  />
                  <Text style={{ color: isUploaded ? '#10472B' : '#FFFFFF', fontWeight: '700', fontSize: 14 }}>
                    {isUploaded ? `Change ${reqDoc.name}` : (reqDoc.name === 'Live Photo' ? "Take Photo Now" : `Upload ${reqDoc.name}`)}
                  </Text>
                </TouchableOpacity>

                {docError ? (
                  <Text style={{ color: '#D32F2F', fontSize: 12, marginTop: 6, marginLeft: 4 }}>
                    {docError}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}

        {/* Submit Action Button */}
        <View style={{ marginTop: 10, marginBottom: 20 }}>
          <TouchableOpacity
            onPress={handleInitialSubmit}
            disabled={loading}
            style={{ 
              backgroundColor: completedSteps === totalSteps ? '#10472B' : '#0B5B31', 
              height: 56, 
              borderRadius: 16, 
              alignItems: 'center', 
              justifyContent: 'center',
              flexDirection: 'row',
              shadowColor: '#10472B',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 10,
              elevation: 4
            }}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 16, marginRight: 6 }}>
                  Proceed & Request OTP
                </Text>
                <MaterialCommunityIcons name="arrow-right" size={20} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Consent Modal */}
      <Modal visible={showConsentModal} animationType="slide" transparent={true}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' }}>
            <View style={{ backgroundColor: '#F8F9FA', paddingHorizontal: 22, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#EEEEEE', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="shield-check-outline" size={22} color="#10472B" style={{ marginRight: 8 }} />
                <Text style={{ fontSize: 17, fontWeight: '800', color: '#1A1A1A' }}>Terms & Verification Consent</Text>
              </View>
              <TouchableOpacity onPress={() => setShowConsentModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <MaterialCommunityIcons name="close" size={22} color="#888888" />
              </TouchableOpacity>
            </View>
            
            <View style={{ padding: 22 }}>
              <Text style={{ color: '#666666', fontSize: 14, marginBottom: 18, lineHeight: 20 }}>
                Please provide your consent to complete your digital KYC and onboarding:
              </Text>
              
              {/* Aadhaar Consent */}
              <TouchableOpacity 
                activeOpacity={0.8}
                onPress={() => setConsentAadhar(!consentAadhar)} 
                style={{ 
                  flexDirection: 'row', 
                  alignItems: 'flex-start', 
                  marginBottom: 14, 
                  backgroundColor: '#F8F9FA', 
                  padding: 14, 
                  borderRadius: 14, 
                  borderWidth: 1, 
                  borderColor: consentAadhar ? '#A7D7B5' : '#EEEEEE' 
                }}
              >
                <View style={{ 
                  width: 22, 
                  height: 22, 
                  borderRadius: 6, 
                  borderWidth: 1.5, 
                  borderColor: consentAadhar ? '#10472B' : '#BDBDBD',
                  backgroundColor: consentAadhar ? '#10472B' : '#FFFFFF',
                  alignItems: 'center', 
                  justifyContent: 'center',
                  marginRight: 12,
                  marginTop: 2
                }}>
                  {consentAadhar && <MaterialCommunityIcons name="check" size={16} color="#FFFFFF" />}
                </View>
                <Text style={{ flex: 1, color: '#333333', fontSize: 13, lineHeight: 19 }}>
                  I authorize SahYogi to verify my <Text style={{ fontWeight: '700', color: '#1A1A1A' }}>Aadhaar details</Text> via UIDAI for e-KYC compliance.
                </Text>
              </TouchableOpacity>

              {/* PAN Consent */}
              <TouchableOpacity 
                activeOpacity={0.8}
                onPress={() => setConsentPan(!consentPan)} 
                style={{ 
                  flexDirection: 'row', 
                  alignItems: 'flex-start', 
                  marginBottom: 14, 
                  backgroundColor: '#F8F9FA', 
                  padding: 14, 
                  borderRadius: 14, 
                  borderWidth: 1, 
                  borderColor: consentPan ? '#A7D7B5' : '#EEEEEE' 
                }}
              >
                <View style={{ 
                  width: 22, 
                  height: 22, 
                  borderRadius: 6, 
                  borderWidth: 1.5, 
                  borderColor: consentPan ? '#10472B' : '#BDBDBD',
                  backgroundColor: consentPan ? '#10472B' : '#FFFFFF',
                  alignItems: 'center', 
                  justifyContent: 'center',
                  marginRight: 12,
                  marginTop: 2
                }}>
                  {consentPan && <MaterialCommunityIcons name="check" size={16} color="#FFFFFF" />}
                </View>
                <Text style={{ flex: 1, color: '#333333', fontSize: 13, lineHeight: 19 }}>
                  I authorize SahYogi to verify my <Text style={{ fontWeight: '700', color: '#1A1A1A' }}>PAN details</Text> against the Income Tax Department database.
                </Text>
              </TouchableOpacity>

              {/* Privacy Policy */}
              <TouchableOpacity 
                activeOpacity={0.8}
                onPress={() => setConsentPrivacy(!consentPrivacy)} 
                style={{ 
                  flexDirection: 'row', 
                  alignItems: 'flex-start', 
                  marginBottom: 16, 
                  backgroundColor: '#F8F9FA', 
                  padding: 14, 
                  borderRadius: 14, 
                  borderWidth: 1, 
                  borderColor: consentPrivacy ? '#A7D7B5' : '#EEEEEE' 
                }}
              >
                <View style={{ 
                  width: 22, 
                  height: 22, 
                  borderRadius: 6, 
                  borderWidth: 1.5, 
                  borderColor: consentPrivacy ? '#10472B' : '#BDBDBD',
                  backgroundColor: consentPrivacy ? '#10472B' : '#FFFFFF',
                  alignItems: 'center', 
                  justifyContent: 'center',
                  marginRight: 12,
                  marginTop: 2
                }}>
                  {consentPrivacy && <MaterialCommunityIcons name="check" size={16} color="#FFFFFF" />}
                </View>
                <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap' }}>
                  <Text style={{ color: '#333333', fontSize: 13, lineHeight: 19 }}>
                    I agree to the SahYogi{' '}
                  </Text>
                  <TouchableOpacity onPress={(e) => {
                    e.stopPropagation();
                    Linking.openURL('https://www.sahyogi.net.in/privacy.html');
                  }}>
                    <Text style={{ color: '#10472B', fontWeight: '800', fontSize: 13, textDecorationLine: 'underline' }}>
                      Privacy Policy & Terms
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </View>
            
            <View style={{ paddingHorizontal: 22, paddingBottom: 24, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#EEEEEE' }}>
              <TouchableOpacity
                onPress={submitDocuments}
                disabled={!allConsented || loading}
                style={{ 
                  backgroundColor: allConsented ? '#10472B' : '#C8E6C9', 
                  height: 52, 
                  borderRadius: 14, 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  flexDirection: 'row'
                }}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 15 }}>
                    Agree & Continue
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Decorative Brand Accent Bottom Line */}
      <View style={{ height: 4, flexDirection: 'row', width: '100%' }}>
        <View style={{ flex: 1, backgroundColor: '#10472B' }} />
        <View style={{ width: 60, backgroundColor: '#D32F2F' }} />
      </View>
    </SafeAreaView>
  );
}

// Minimalist native text input wrapper for pixel-perfect card integration
function InputPrimitive(props: any) {
  const { TextInput } = require('react-native');
  return <TextInput placeholderTextColor="#9E9E9E" {...props} />;
}

