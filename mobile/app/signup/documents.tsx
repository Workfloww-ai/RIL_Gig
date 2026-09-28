import React, { useState } from 'react';
import { View, Text, Platform, StatusBar, ScrollView, Alert, Modal, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { apiClient } from '../../src/api/client';

interface DocumentEntry {
  doc_name: string;
  doc_number: string;
  uri: string;
  filename: string;
  type: string;
}

export default function DocumentsScreen() {
  const router = useRouter();
  const { user_id, mobile, userDetails } = useLocalSearchParams() as { user_id?: string, mobile: string, userDetails?: string };
  const [documents, setDocuments] = useState<DocumentEntry[]>([]);
  const [docNumbers, setDocNumbers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [topError, setTopError] = useState<string>('');

  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentAadhar, setConsentAadhar] = useState(false);
  const [consentPan, setConsentPan] = useState(false);
  const [consentPrivacy, setConsentPrivacy] = useState(false);

  const allConsented = consentAadhar && consentPan && consentPrivacy;

  const requiredDocs = [
    { key: 'Aadhar Card', name: 'Aadhar Card', placeholder: 'Aadhar Number' },
    { key: 'PAN Card', name: 'PAN Card', placeholder: 'PAN Number' },
    { key: 'Certification/Marksheet', name: 'Certification/Marksheet', placeholder: 'Certificate Number (Optional)' },
    { key: 'Live Photo', name: 'Live Photo', placeholder: 'N/A' }
  ];

  const getDoc = (name: string) => documents.find(d => d.doc_name === name);

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
          doc_number: '', // will be updated via text input
          uri: asset.uri,
          filename: filename,
          type: asset.mimeType || 'image/jpeg'
        }];
      });
      
      // Clear error for this doc when uploaded
      if (errors[docName]) {
        setErrors(prev => ({ ...prev, [docName]: '' }));
      }
    }
  };

  const updateDocNumber = (docName: string, number: string) => {
    setDocNumbers(prev => ({ ...prev, [docName]: number }));
    // Clear error for this doc number when user types
    if (errors[`${docName}_number`]) {
      setErrors(prev => ({ ...prev, [`${docName}_number`]: '' }));
    }
  };

  const handleInitialSubmit = () => {
    setErrors({});
    setTopError('');
    let hasError = false;
    const newErrors: Record<string, string> = {};

    // Validate documents and numbers
    requiredDocs.forEach(reqDoc => {
      const doc = getDoc(reqDoc.name);
      if (!doc) {
        newErrors[reqDoc.name] = `${reqDoc.name} is required`;
        hasError = true;
      }
      
      if (reqDoc.name !== 'Live Photo') {
        const num = docNumbers[reqDoc.name] || '';
        if (!num && reqDoc.name !== 'Certification/Marksheet') {
          newErrors[`${reqDoc.name}_number`] = `${reqDoc.name} number is required`;
          hasError = true;
        } else if (reqDoc.name === 'PAN Card' && num.length !== 10) {
          newErrors[`${reqDoc.name}_number`] = 'PAN Card number must be exactly 10 characters';
          hasError = true;
        }
      }
    });

    if (hasError) {
      setErrors(newErrors);
      setTopError('Please fill all mandatory fields correctly before proceeding.');
      return;
    }

    setShowConsentModal(true);
  };

  const submitDocuments = async () => {
    setShowConsentModal(false);
    setLoading(true);
    try {
      // 1. Prepare metadata
      const documentsMetadata = documents.map(d => ({
        filename: d.filename,
        doc_name: d.doc_name,
        doc_number: docNumbers[d.doc_name] || '',
        uri: d.uri,
        type: d.type
      }));

      // 2. Request OTP
      await apiClient.post('/auth/send-otp', { mobile_number: mobile });
      
      // 3. Navigate to OTP Screen and pass all signup data
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
    <SafeAreaView className="flex-1 bg-cream pt-8">
      {/* Decorative Brand Line - Top Edge */}
      <View style={{ height: 6, flexDirection: 'row', zIndex: 50 }}>
        <View style={{ flex: 1, backgroundColor: '#0B5B31' }} />
          <View style={{ width: 0, height: 0, borderTopWidth: 6, borderTopColor: '#0B5B31', borderRightWidth: 6, borderRightColor: 'transparent', marginLeft: -1 }} />
          <View style={{ width: 4, height: 6, backgroundColor: 'transparent' }} />
          <View style={{ width: 0, height: 0, borderBottomWidth: 6, borderBottomColor: '#D32F2F', borderLeftWidth: 6, borderLeftColor: 'transparent', marginRight: -1 }} />
          <View style={{ flex: 1, backgroundColor: '#D32F2F' }} />
      </View>
      <ScrollView className="flex-1 px-8 pt-8" contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <Text className="text-4xl font-bold text-slate mb-3 tracking-tight">Documents</Text>
        <Text className="text-sage mb-8 text-lg font-medium">Upload your KYC documents.</Text>

        {topError ? (
          <View className="bg-clay/10 border border-red-200 p-4 rounded-xl mb-6">
            <Text className="text-clay font-medium">{topError}</Text>
          </View>
        ) : null}

        {requiredDocs.map((reqDoc, index) => {
          const doc = getDoc(reqDoc.name);
          const docError = errors[reqDoc.name];
          const numError = errors[`${reqDoc.name}_number`];
          
          return (
            <View key={index} className={`bg-sand p-5 rounded-2xl border ${docError ? 'border-clay/50' : 'border-sage/10'} mb-6`}>
              <Text className="font-bold text-slate text-lg mb-2">
                {reqDoc.name} <Text className="text-clay/80">*</Text>
              </Text>
              
              {reqDoc.name !== 'Live Photo' && (
                <Input 
                  label={undefined} 
                  placeholder={reqDoc.placeholder} 
                  value={docNumbers[reqDoc.name] || ''} 
                  onChangeText={(val) => updateDocNumber(reqDoc.name, val)} 
                  error={numError}
                />
              )}
              
              <View className="flex-row items-center justify-between mt-2">
                <View className="flex-1 mr-4">
                  <Button 
                    title={doc ? "Change Photo" : `Upload ${reqDoc.name}`} 
                    onPress={() => pickImage(reqDoc.name)} 
                    variant={doc ? "outline" : "primary"} 
                  />
                </View>
                {doc && (
                  <View className="bg-green-100 px-3 py-2 rounded-lg border border-green-200">
                    <Text className="text-green-800 font-bold text-xs">Uploaded</Text>
                  </View>
                )}
              </View>
              {docError && <Text className="text-clay/80 text-sm mt-2">{docError}</Text>}
            </View>
          );
        })}

        <View className="mt-4 mb-12">
          <Button title="Submit & Request OTP" onPress={handleInitialSubmit} loading={loading} />
        </View>
      </ScrollView>

      {/* Consent Modal */}
      <Modal visible={showConsentModal} animationType="slide" transparent={true}>
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-cream w-full rounded-t-3xl overflow-hidden shadow-xl" onStartShouldSetResponder={() => true}>
            <View className="bg-sand px-6 py-5 border-b border-sage/10 flex-row justify-between items-center">
              <Text className="text-lg font-bold text-slate">Terms & Permissions</Text>
              <TouchableOpacity onPress={() => setShowConsentModal(false)}>
                <Text className="text-sage font-bold">Close</Text>
              </TouchableOpacity>
            </View>
            
            <View className="p-6 pb-2">
              <Text className="text-sage mb-6 text-base">To proceed with your application, we need your consent to collect and process the following information:</Text>
              
              <View className="mb-2">
                <TouchableOpacity onPress={() => setConsentAadhar(!consentAadhar)} className="flex-row items-center mb-5 bg-sand p-4 rounded-xl border border-sage/10">
                  <View className={`w-6 h-6 rounded border mr-4 items-center justify-center ${consentAadhar ? 'bg-primary-500 border-primary-500' : 'border-sage/50 bg-white'}`}>
                    {consentAadhar && <Text className="text-white text-xs font-bold">✓</Text>}
                  </View>
                  <View className="flex-1 flex-row flex-wrap items-center">
                    <Text className="text-slate text-base">By checking this box, I authorize SahYogi to use my Aadhaar number and details for identity verification and e-KYC purposes in accordance with UIDAI guidelines. </Text>
                    
                  </View>
                </TouchableOpacity>
              </View>
              <View className="mb-2">
                <TouchableOpacity onPress={() => setConsentPan(!consentPan)} className="flex-row items-center mb-5 bg-sand p-4 rounded-xl border border-sage/10">
                  <View className={`w-6 h-6 rounded border mr-4 items-center justify-center ${consentPan ? 'bg-primary-500 border-primary-500' : 'border-sage/50 bg-white'}`}>
                    {consentPan && <Text className="text-white text-xs font-bold">✓</Text>}
                  </View>
                  <View className="flex-1 flex-row flex-wrap items-center">
                    <Text className="text-slate text-base">By checking this box, I authorize SahYogi to fetch and verify my PAN details with the Income Tax Department database for onboarding and compliance purposes. </Text>
                    
                  </View>
                </TouchableOpacity>
              </View>
              <View className="mb-2">
                <TouchableOpacity onPress={() => setConsentPrivacy(!consentPrivacy)} className="flex-row items-center mb-5 bg-sand p-4 rounded-xl border border-sage/10">
                  <View className={`w-6 h-6 rounded border mr-4 items-center justify-center ${consentPrivacy ? 'bg-primary-500 border-primary-500' : 'border-sage/50 bg-white'}`}>
                    {consentPrivacy && <Text className="text-white text-xs font-bold">✓</Text>}
                  </View>
                  <View className="flex-1 flex-row flex-wrap items-center">
                    <Text className="text-slate text-base">I read and agree to </Text>
                    <TouchableOpacity onPress={(e) => {
                      e.stopPropagation();
                      Linking.openURL('https://www.sahyogi.net.in/privacy.html');
                    }}>
                      <Text className="text-[#0B5B31] text-base font-bold underline">privacy policy</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
            
            <View className="bg-sand px-6 py-5 border-t border-sage/10">
              <Button 
                title="Agree & Continue" 
                onPress={submitDocuments} 
                loading={loading}
                disabled={!allConsented}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Decorative Brand Line - Bottom Edge */}
      <View style={{ height: 6, flexDirection: 'row', zIndex: 50 }}>
        <View style={{ flex: 1, backgroundColor: '#0B5B31' }} />
          <View style={{ width: 0, height: 0, borderTopWidth: 6, borderTopColor: '#0B5B31', borderRightWidth: 6, borderRightColor: 'transparent', marginLeft: -1 }} />
          <View style={{ width: 4, height: 6, backgroundColor: 'transparent' }} />
          <View style={{ width: 0, height: 0, borderBottomWidth: 6, borderBottomColor: '#D32F2F', borderLeftWidth: 6, borderLeftColor: 'transparent', marginRight: -1 }} />
          <View style={{ flex: 1, backgroundColor: '#D32F2F' }} />
      </View>
    </SafeAreaView>
  );
}
