import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, Platform, Image, BackHandler, Modal, FlatList, ActivityIndicator } from 'react-native';
import { Slot, useRouter, usePathname, useFocusEffect } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiClient } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';

export default function SuperadminLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const role = useAuthStore(state => state.role);
  const selectedOrganizationId = useAuthStore(state => state.selectedOrganizationId);
  const setSelectedOrganizationId = useAuthStore(state => state.setSelectedOrganizationId);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        BackHandler.exitApp();
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

      return () => subscription.remove();
    }, [])
  );

  const [userProfile, setUserProfile] = useState<{ first_name: string; last_name: string; tenant_name?: string } | null>(null);
  const [orgs, setOrgs] = useState<{organization_id: string, name: string}[]>([]);
  const [orgModalVisible, setOrgModalVisible] = useState(false);
  const [loadingOrgs, setLoadingOrgs] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profileRes = await apiClient.get('/auth/me');
        if (profileRes?.data) setUserProfile(profileRes.data);
      } catch (err) {
        console.error('Failed to fetch profile in superadmin layout', err);
      }
    };
    fetchProfile();
  }, []);

  useEffect(() => {
    if (role === 'superadmin') {
      const fetchOrgs = async () => {
        try {
          setLoadingOrgs(true);
          const res = await apiClient.get('/superadmin/organizations');
          if (res?.data?.organizations) {
            setOrgs(res.data.organizations);
          }
        } catch(e) {
          console.error('Failed to fetch organizations', e);
        } finally {
          setLoadingOrgs(false);
        }
      }
      fetchOrgs();
    }
  }, [role]);

  if (pathname === '/superadmin/profile') {
    return (
      <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
        <Slot />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* Top Header */}
      <View style={{ backgroundColor: '#FFFFFF', paddingTop: Math.max(16, insets.top), paddingBottom: 24, paddingHorizontal: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.05, shadowRadius: 16, elevation: 8, zIndex: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => router.push('/superadmin/profile')}
            style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#F9F9F9', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#E5E7EB', marginRight: 16 }}
            activeOpacity={0.8}
          >
            <Text style={{ color: '#0B5B31', fontSize: 20, fontWeight: '800' }}>
              {userProfile?.first_name ? userProfile.first_name.charAt(0).toUpperCase() : 'A'}
            </Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 26, fontWeight: '800', color: '#3C3C3B', letterSpacing: -0.5 }}>
              Hi, {userProfile?.first_name ? userProfile.first_name.charAt(0).toUpperCase() + userProfile.first_name.slice(1) : 'Admin'}
            </Text>
            {role === 'admin' ? (
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit={true}
                minimumFontScale={0.8}
                style={{ fontSize: 12, fontWeight: '600', marginTop: 2 }}
              >
                <Text style={{ color: '#0B5B31' }}>{userProfile?.tenant_name || 'SahYogi'}</Text>{' '}
                <Text style={{ color: '#D32F2F' }}>Approver</Text>
              </Text>
            ) : (
              <TouchableOpacity onPress={() => setOrgModalVisible(true)} style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, alignSelf: 'flex-start' }} activeOpacity={0.7}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#4B5563', marginRight: 4 }}>
                  {orgs.find(o => o.organization_id === selectedOrganizationId)?.name || 'Select Organization'}
                </Text>
                <Feather name="chevron-down" size={16} color="#4B5563" />
              </TouchableOpacity>
            )}
          </View>
          <Image
            source={require('../../assets/images/newlogo.png')}
            style={{ width: 85, height: 85, resizeMode: 'contain', marginLeft: 12 }}
          />
        </View>

        {/* Decorative Brand Line - Absolute Bottom */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 8, flexDirection: 'row' }}>
          <View style={{ flex: 1, backgroundColor: '#0B5B31' }} />
          <View style={{ width: 0, height: 0, borderTopWidth: 8, borderTopColor: '#0B5B31', borderRightWidth: 8, borderRightColor: 'transparent', marginLeft: -1 }} />
          <View style={{ width: 4, height: 8, backgroundColor: 'transparent' }} />
          <View style={{ width: 0, height: 0, borderBottomWidth: 8, borderBottomColor: '#D32F2F', borderLeftWidth: 8, borderLeftColor: 'transparent', marginRight: -1 }} />
          <View style={{ flex: 1, backgroundColor: '#D32F2F' }} />
        </View>
      </View>

      {/* Main Content Slot */}
      <View style={{ flex: 1 }}>
        {role === 'superadmin' && !selectedOrganizationId ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <Feather name="briefcase" size={48} color="#9CA3AF" style={{ marginBottom: 16 }} />
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#374151', textAlign: 'center', marginBottom: 8 }}>No Organization Selected</Text>
            <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24 }}>Please select an organization from the top dropdown to view its data.</Text>
            <TouchableOpacity onPress={() => setOrgModalVisible(true)} style={{ backgroundColor: '#0B5B31', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}>
              <Text style={{ color: 'white', fontWeight: 'bold' }}>Select Organization</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Slot />
        )}
      </View>

      {/* Bottom Navigation */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#F3F4F6',
          flexDirection: 'row',
          justifyContent: 'space-around',
          paddingVertical: 12,
          paddingTop: 16,
          paddingBottom: Platform.OS === 'ios' ? Math.max(24, insets.bottom) : Math.max(12, insets.bottom),
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.08,
          shadowRadius: 6,
          zIndex: 999,
        }}
      >
        {/* Decorative Brand Line - Absolute Top */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 8, flexDirection: 'row' }}>
          <View style={{ flex: 1, backgroundColor: '#0B5B31' }} />
          <View style={{ width: 0, height: 0, borderTopWidth: 8, borderTopColor: '#0B5B31', borderRightWidth: 8, borderRightColor: 'transparent', marginLeft: -1 }} />
          <View style={{ width: 4, height: 8, backgroundColor: 'transparent' }} />
          <View style={{ width: 0, height: 0, borderBottomWidth: 8, borderBottomColor: '#D32F2F', borderLeftWidth: 8, borderLeftColor: 'transparent', marginRight: -1 }} />
          <View style={{ flex: 1, backgroundColor: '#D32F2F' }} />
        </View>

        <TouchableOpacity onPress={() => router.push('/superadmin')} style={{ alignItems: 'center', flex: 1 }} activeOpacity={0.7}>
          <Ionicons name="clipboard-outline" size={22} color={pathname === '/superadmin' ? '#D32F2F' : '#9CA3AF'} />
          <Text style={{ fontSize: 11, marginTop: 4, fontWeight: '600', color: pathname === '/superadmin' ? '#D32F2F' : '#9CA3AF' }}>Requests</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/superadmin/managers')} style={{ alignItems: 'center', flex: 1 }} activeOpacity={0.7}>
          <Feather name="home" size={22} color={pathname === '/superadmin/managers' ? '#D32F2F' : '#9CA3AF'} />
          <Text style={{ fontSize: 11, marginTop: 4, fontWeight: '600', color: pathname === '/superadmin/managers' ? '#D32F2F' : '#9CA3AF' }}>Managers</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/superadmin/stores')} style={{ alignItems: 'center', flex: 1 }} activeOpacity={0.7}>
          <Feather name="box" size={22} color={pathname === '/superadmin/stores' ? '#D32F2F' : '#9CA3AF'} />
          <Text style={{ fontSize: 11, marginTop: 4, fontWeight: '600', color: pathname === '/superadmin/stores' ? '#D32F2F' : '#9CA3AF' }}>Stores</Text>
        </TouchableOpacity>

        {role !== 'admin' && (
          <TouchableOpacity onPress={() => router.push('/superadmin/deletions')} style={{ alignItems: 'center', flex: 1 }} activeOpacity={0.7}>
            <Feather name="trash-2" size={22} color={pathname === '/superadmin/deletions' ? '#D32F2F' : '#9CA3AF'} />
            <Text style={{ fontSize: 11, marginTop: 4, fontWeight: '600', color: pathname === '/superadmin/deletions' ? '#D32F2F' : '#9CA3AF' }}>Deletions</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Organization Selector Modal */}
      <Modal visible={orgModalVisible} animationType="slide" transparent={true} onRequestClose={() => setOrgModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Math.max(24, insets.bottom), maxHeight: '80%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827' }}>Select Organization</Text>
              <TouchableOpacity onPress={() => setOrgModalVisible(false)} style={{ padding: 4 }}>
                <Feather name="x" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {loadingOrgs ? (
              <ActivityIndicator size="large" color="#0B5B31" style={{ marginVertical: 40 }} />
            ) : (
              <FlatList
                data={orgs}
                keyExtractor={(item) => item.organization_id}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: 16,
                      borderBottomWidth: 1,
                      borderBottomColor: '#F3F4F6'
                    }}
                    onPress={() => {
                      setSelectedOrganizationId(item.organization_id);
                      setOrgModalVisible(false);
                    }}
                  >
                    <Text style={{ fontSize: 16, fontWeight: selectedOrganizationId === item.organization_id ? '700' : '500', color: selectedOrganizationId === item.organization_id ? '#0B5B31' : '#374151' }}>
                      {item.name}
                    </Text>
                    {selectedOrganizationId === item.organization_id && (
                      <Feather name="check" size={20} color="#0B5B31" />
                    )}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={() => (
                  <Text style={{ textAlign: 'center', color: '#6B7280', marginVertical: 20 }}>No organizations found.</Text>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
