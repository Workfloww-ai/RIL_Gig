import React, { useState } from 'react';
import { View, Text, SafeAreaView, ScrollView, Alert } from 'react-native';
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

  const requiredDocs = [
    { key: 'Aadhar Card', name: 'Aadhar Card', placeholder: 'Aadhar Number' },
    { key: 'PAN Card', name: 'PAN Card', placeholder: 'PAN Number' },
    { key: 'Certification/Marksheet', name: 'Certification/Marksheet', placeholder: 'Certificate Number (Optional)' },
    { key: 'Live Photo', name: 'Live Photo', placeholder: 'N/A' }
  ];

  const getDoc = (name: string) => documents.find(d => d.doc_name === name);

  const pickImage = async (docName: string) => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

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
    }
  };

  const updateDocNumber = (docName: string, number: string) => {
    setDocNumbers(prev => ({ ...prev, [docName]: number }));
  };

  const submitDocuments = async () => {
    if (documents.length < 4) {
      Alert.alert('Missing Documents', 'Please upload all 4 required documents to proceed.');
      return;
    }

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
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1 px-8 pt-8">
        <Text className="text-4xl font-bold text-gray-900 mb-3 tracking-tight">Documents</Text>
        <Text className="text-gray-500 mb-8 text-lg font-medium">Upload your KYC documents.</Text>

        {requiredDocs.map((reqDoc, index) => {
          const doc = getDoc(reqDoc.name);
          return (
            <View key={index} className="bg-gray-50 p-5 rounded-2xl border border-gray-100 mb-6">
              <Text className="font-bold text-gray-800 text-lg mb-2">{reqDoc.name}</Text>
              
              {reqDoc.name !== 'Live Photo' && (
                <Input 
                  label={`${reqDoc.name} Number`} 
                  placeholder={reqDoc.placeholder} 
                  value={docNumbers[reqDoc.name] || ''} 
                  onChangeText={(val) => updateDocNumber(reqDoc.name, val)} 
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
            </View>
          );
        })}

        <View className="mt-4 mb-12">
          <Button title="Submit & Request OTP" onPress={submitDocuments} loading={loading} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
