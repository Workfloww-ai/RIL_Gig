import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, SafeAreaView, Image, ActivityIndicator, Alert } from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import * as ImagePicker from 'expo-image-picker';
import { apiClient } from '../api/client';

interface IDBadgeProps {
  visible: boolean;
  onClose: () => void;
  user: {
    first_name: string;
    last_name: string;
    employee_id?: string;
    dob?: string;
    date_of_joining?: string;
    ratings?: number;
    address?: string;
    city?: string;
    state?: string;
    created_at?: string;
    profile_pic_url?: string;
    mobile_number?: string;
  };
}

export default function IDBadge({ visible, onClose, user }: IDBadgeProps) {
  const [photoUri, setPhotoUri] = useState<string | null>(user.profile_pic_url || null);
  const [uploading, setUploading] = useState(false);

  const fullName = `${user.first_name} ${user.last_name}`;
  const initial = user.first_name?.charAt(0).toUpperCase() || 'S';
  
  // Format Date of Joining
  const doj = user.created_at ? new Date(user.created_at).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  }) : (user.date_of_joining || '01 Jan 2024');

  // Format Full Address
  const fullAddress = [user.address, user.city, user.state].filter(Boolean).join(', ') || 'Reliance Corporate Park, Navi Mumbai';

  const qrData = JSON.stringify({
    id: user.employee_id || 'SAHYOGI-1234',
    name: fullName,
    role: 'SahYogi',
    status: 'ACTIVE'
  });

  const pickImage = async () => {
    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Sorry, we need camera roll permissions to make this work!');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      setPhotoUri(uri); // Optimistic UI update
      setUploading(true);

      try {
        const filename = uri.split('/').pop() || 'photo.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';
        
        const formData = new FormData();
        // @ts-ignore
        formData.append('file', { uri, name: filename, type });

        const res = await apiClient.post('/auth/me/profile-pic', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        if (res.data?.profile_pic_url) {
          setPhotoUri(res.data.profile_pic_url);
        }
      } catch (err) {
        console.error('Upload failed', err);
        Alert.alert('Upload Failed', 'Could not save the new profile picture.');
        // Revert on failure
        setPhotoUri(user.profile_pic_url || null);
      } finally {
        setUploading(false);
      }
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/60 justify-center items-center px-4">
        <View className="bg-white w-full max-w-[340px] rounded-3xl overflow-hidden shadow-xl">
          
          {/* Header */}
          <View className="bg-moss py-5 items-center relative">
            <Text className="text-white font-bold tracking-widest uppercase text-sm mt-1">Employee ID</Text>
            
            {/* Close button */}
            <TouchableOpacity 
              onPress={onClose}
              className="absolute top-4 right-4 bg-black/20 w-8 h-8 rounded-full items-center justify-center"
            >
              <Feather name="x" size={18} color="white" />
            </TouchableOpacity>
          </View>

          {/* Red Accent Strip */}
          <View className="h-2 w-full bg-accent" />

          {/* Body */}
          <View className="px-6 py-6 items-center">
            
            {/* Avatar Section */}
            <TouchableOpacity 
              onPress={pickImage}
              className="mt-[-45px] mb-3 relative shadow-sm"
              activeOpacity={0.8}
            >
              <View className="w-24 h-24 rounded-full bg-white border-4 border-white items-center justify-center overflow-hidden elevation-md">
                {photoUri ? (
                  <View className="w-full h-full bg-gray-200" style={{
                    // Since we can't reliably import Image without causing layout jumps in nativewind sometimes, 
                    // we'll just use a standard Image component
                  }}>
                    <React.Fragment>
                      {/* @ts-ignore */}
                      <Image source={{ uri: photoUri }} style={{ width: '100%', height: '100%' }} />
                      {uploading && (
                        <View className="absolute inset-0 bg-black/30 items-center justify-center rounded-full" style={{ width: '100%', height: '100%' }}>
                          <ActivityIndicator size="small" color="#FFF" />
                        </View>
                      )}
                    </React.Fragment>
                  </View>
                ) : (
                  <View className="w-full h-full bg-sand items-center justify-center">
                    <Text className="text-moss text-4xl font-bold">{initial}</Text>
                  </View>
                )}
              </View>
              
              {/* Edit Badge */}
              <View className="absolute bottom-0 right-0 bg-accent w-7 h-7 rounded-full items-center justify-center border-2 border-white">
                <MaterialIcons name="edit" size={14} color="white" />
              </View>
            </TouchableOpacity>

            <Text className="text-2xl font-bold text-slate text-center">{fullName}</Text>
            <Text className="text-sage text-base mb-6">SahYogi</Text>

            {/* Details Grid */}
            <View className="w-full bg-sand rounded-xl p-4 mb-6">
              <View className="flex-row justify-between mb-3 border-b border-sage/10 pb-2">
                <Text className="text-sage text-xs">Date of Joining</Text>
                <Text className="text-slate font-bold text-xs">{doj}</Text>
              </View>
              
              <View className="flex-row justify-between mb-3 border-b border-sage/10 pb-2">
                <Text className="text-sage text-xs">Date of Birth</Text>
                <Text className="text-slate font-bold text-xs">{user.dob || '---'}</Text>
              </View>

              <View className="flex-row justify-between mb-3 border-b border-sage/10 pb-2">
                <Text className="text-sage text-xs">Rating</Text>
                <Text className="text-slate font-bold text-xs">
                  {user.ratings ? `⭐ ${user.ratings}.0` : 'No Ratings'}
                </Text>
              </View>
              
              <View className="flex-row justify-between border-b border-sage/10 pb-2 mb-3">
                <Text className="text-sage text-xs">Status</Text>
                <View className="bg-moss/10 px-2 py-0.5 rounded-sm">
                  <Text className="text-moss font-bold text-[10px] uppercase">Active</Text>
                </View>
              </View>
              
              <View className="flex-row justify-between">
                <Text className="text-sage text-xs mr-4">Address</Text>
                <Text className="text-slate font-bold text-xs flex-1 text-right" numberOfLines={2}>
                  {fullAddress}
                </Text>
              </View>
            </View>

            {/* QR Code */}
            <View className="items-center mb-2">
              <Text className="text-[10px] text-sage font-bold uppercase tracking-widest mb-3">Scan to Verify</Text>
              <View className="p-3 bg-white border border-sage/20 rounded-xl shadow-sm">
                <QRCode
                  value={qrData}
                  size={100}
                  color="#10472B"
                  backgroundColor="white"
                />
              </View>
            </View>

          </View>
          
          <View className="bg-sand py-3 items-center border-t border-sage/10">
            <Text className="text-[10px] text-sage">Powered by SahYogi Digital</Text>
          </View>

        </View>
      </View>
    </Modal>
  );
}
