import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, ActivityIndicator, Alert, Platform, FlatList } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { State, City } from 'country-state-city';
import { apiClient } from '../../src/api/client';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';

// Validation Schema for Add Manager
const managerSchema = z.object({
  first_name: z.string().min(2, "First name is required"),
  last_name: z.string().min(2, "Last name is required"),
  email: z.string().email("Must be a valid email"),
  mobile_number: z.string().min(10, "Phone number is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  role: z.string().min(2, "Role is required"),
  store_id: z.string().min(2, "Assigned store is required")
});

type ManagerFormData = z.infer<typeof managerSchema>;

export default function SuperadminManagers() {
  const insets = useSafeAreaInsets();
  
  const [managers, setManagers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<any[]>([]);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Dropdown Modals
  const [showStateModal, setShowStateModal] = useState(false);
  const [showCityModal, setShowCityModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showStoreModal, setShowStoreModal] = useState(false);
  
  const [selectedStateCode, setSelectedStateCode] = useState('');

  const { control, handleSubmit, setValue, reset, watch, formState: { errors } } = useForm<ManagerFormData>({
    resolver: zodResolver(managerSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      mobile_number: '',
      city: '',
      state: '',
      role: '',
      store_id: ''
    }
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [managersRes, storesRes] = await Promise.all([
        apiClient.get('/superadmin/managers'),
        apiClient.get('/superadmin/stores')
      ]);
      if (managersRes?.data?.managers) setManagers(managersRes.data.managers);
      if (storesRes?.data?.stores) setStores(storesRes.data.stores);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleStateSelect = (stateObj: any) => {
    setValue('state', stateObj.name, { shouldValidate: true });
    setSelectedStateCode(stateObj.isoCode);
    setValue('city', '', { shouldValidate: true });
    setShowStateModal(false);
  };

  const handleCitySelect = (cityObj: any) => {
    setValue('city', cityObj.name, { shouldValidate: true });
    setShowCityModal(false);
  };

  const onSubmit = async (data: ManagerFormData) => {
    setSubmitting(true);
    try {
      await apiClient.post('/superadmin/managers', data);
      Alert.alert('Success', 'Manager created successfully');
      setIsAddModalOpen(false);
      reset();
      setSelectedStateCode('');
      fetchData();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to create manager');
    } finally {
      setSubmitting(false);
    }
  };

  const getStoreName = (storeId: string) => {
    const store = stores.find(s => s.store_id === storeId);
    return store ? store.store_name : '';
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* Main Content */}
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#1A1A1A', letterSpacing: -0.3 }}>Store Managers</Text>
          <TouchableOpacity
            onPress={() => setIsAddModalOpen(true)}
            style={{ backgroundColor: '#D32F2F', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center' }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>+ Add Manager</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}>
          {loading ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#D32F2F" />
            </View>
          ) : managers.length === 0 ? (
            <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' }}>
              <Text style={{ color: '#6B7280', fontSize: 15 }}>No managers found. Add one to get started.</Text>
            </View>
          ) : (
            managers.map((manager) => (
              <View key={manager.user_id} style={{ backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#F3F4F6', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 }}>
                
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 6 }}>{manager.first_name} {manager.last_name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="storefront-outline" size={14} color="#6B7280" style={{ marginRight: 6 }} />
                      <Text style={{ fontSize: 13, color: '#6B7280', fontWeight: '500' }}>{manager.store_name || 'Unassigned'}</Text>
                    </View>
                  </View>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="storefront" size={20} color="#D32F2F" />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                  <Feather name="phone" size={14} color="#9CA3AF" style={{ marginRight: 8 }} />
                  <Text style={{ fontSize: 14, color: '#4B5563', fontWeight: '500' }}>{manager.mobile_number}</Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Feather name="mail" size={14} color="#9CA3AF" style={{ marginRight: 8 }} />
                  <Text style={{ fontSize: 14, color: '#4B5563', fontWeight: '500' }}>{manager.email || 'N/A'}</Text>
                </View>

                <View style={{ position: 'absolute', bottom: 16, right: 16, alignItems: 'flex-end' }}>
                  {manager.role_name && (
                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#D32F2F', textTransform: 'capitalize', marginBottom: 4 }}>
                      {manager.role_name}
                    </Text>
                  )}
                  <View style={{ backgroundColor: manager.is_verified ? '#DCFCE7' : '#FEF2F2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                    <Text style={{ fontSize: 10, fontWeight: '600', color: manager.is_verified ? '#15803D' : '#D32F2F' }}>
                      {manager.is_verified ? 'Verified' : 'Not Verified'}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>

      {/* Add Manager Modal */}
      <Modal visible={isAddModalOpen} animationType="slide" transparent={true}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '90%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827' }}>Add New Store Manager</Text>
              <TouchableOpacity onPress={() => setIsAddModalOpen(false)} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="close" size={20} color="#4B5563" />
              </TouchableOpacity>
            </View>

            <KeyboardAwareScrollView contentContainerStyle={{ padding: 24 }} showsVerticalScrollIndicator={false}>
              
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Controller
                    control={control}
                    name="first_name"
                    render={({ field: { onChange, value } }) => (
                      <Input label="First Name" placeholder="John" value={value} onChangeText={onChange} error={errors.first_name?.message} />
                    )}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Controller
                    control={control}
                    name="last_name"
                    render={({ field: { onChange, value } }) => (
                      <Input label="Last Name" placeholder="Doe" value={value} onChangeText={onChange} error={errors.last_name?.message} />
                    )}
                  />
                </View>
              </View>

              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, value } }) => (
                  <Input label="Email" placeholder="john@example.com" keyboardType="email-address" autoCapitalize="none" value={value} onChangeText={onChange} error={errors.email?.message} />
                )}
              />

              <Controller
                control={control}
                name="mobile_number"
                render={({ field: { onChange, value } }) => (
                  <Input label="Phone Number" placeholder="0000000000" keyboardType="phone-pad" value={value} onChangeText={onChange} error={errors.mobile_number?.message} />
                )}
              />


              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Controller
                    control={control}
                    name="state"
                    render={({ field: { value } }) => (
                      <View style={{ marginBottom: 16 }}>
                        <Text style={{ color: '#4B5563', fontWeight: '600', fontSize: 13, marginBottom: 8, marginLeft: 4 }}>State</Text>
                        <TouchableOpacity 
                          onPress={() => setShowStateModal(true)}
                          style={{ backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: errors.state ? '#D32F2F' : '#E5E7EB', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                        >
                          <Text style={{ color: value ? '#111827' : '#9CA3AF' }}>{value || "State"}</Text>
                          <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
                        </TouchableOpacity>
                        {errors.state && <Text style={{ color: '#D32F2F', fontSize: 12, marginTop: 4, marginLeft: 4 }}>{errors.state.message}</Text>}
                      </View>
                    )}
                  />
                </View>

                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Controller
                    control={control}
                    name="city"
                    render={({ field: { value } }) => (
                      <View style={{ marginBottom: 16 }}>
                        <Text style={{ color: '#4B5563', fontWeight: '600', fontSize: 13, marginBottom: 8, marginLeft: 4 }}>City</Text>
                        <TouchableOpacity 
                          onPress={() => {
                            if (selectedStateCode) setShowCityModal(true);
                          }}
                          style={{ backgroundColor: !selectedStateCode ? '#F3F4F6' : '#F9FAFB', borderWidth: 1, borderColor: errors.city ? '#D32F2F' : '#E5E7EB', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', opacity: !selectedStateCode ? 0.7 : 1 }}
                        >
                          <Text style={{ color: value ? '#111827' : '#9CA3AF' }}>{value || "City"}</Text>
                          <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
                        </TouchableOpacity>
                        {errors.city && <Text style={{ color: '#D32F2F', fontSize: 12, marginTop: 4, marginLeft: 4 }}>{errors.city.message}</Text>}
                      </View>
                    )}
                  />
                </View>
              </View>


              <Controller
                control={control}
                name="role"
                render={({ field: { value } }) => (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ color: '#4B5563', fontWeight: '600', fontSize: 13, marginBottom: 8, marginLeft: 4 }}>Role</Text>
                    <TouchableOpacity 
                      onPress={() => setShowRoleModal(true)}
                      style={{ backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: errors.role ? '#D32F2F' : '#E5E7EB', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <Text style={{ color: value ? '#111827' : '#9CA3AF', textTransform: value ? 'capitalize' : 'none' }}>{value || "Select role"}</Text>
                      <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
                    </TouchableOpacity>
                    {errors.role && <Text style={{ color: '#D32F2F', fontSize: 12, marginTop: 4, marginLeft: 4 }}>{errors.role.message}</Text>}
                  </View>
                )}
              />

              <Controller
                control={control}
                name="store_id"
                render={({ field: { value } }) => (
                  <View style={{ marginBottom: 24 }}>
                    <Text style={{ color: '#4B5563', fontWeight: '600', fontSize: 13, marginBottom: 8, marginLeft: 4 }}>Assigned Store</Text>
                    <TouchableOpacity 
                      onPress={() => setShowStoreModal(true)}
                      style={{ backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: errors.store_id ? '#D32F2F' : '#E5E7EB', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <Text style={{ color: value ? '#111827' : '#9CA3AF' }} numberOfLines={1}>
                        {value ? getStoreName(value) : "Select a store..."}
                      </Text>
                      <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
                    </TouchableOpacity>
                    {errors.store_id && <Text style={{ color: '#D32F2F', fontSize: 12, marginTop: 4, marginLeft: 4 }}>{errors.store_id.message}</Text>}
                  </View>
                )}
              />

              <View style={{ paddingBottom: 24 }}>
                <Button title="Create Manager" onPress={handleSubmit(onSubmit)} loading={submitting} />
              </View>
            </KeyboardAwareScrollView>
          </View>
        </View>
      </Modal>

      {/* Modals for Selectors */}
      <Modal visible={showStateModal} animationType="fade" transparent={true}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} activeOpacity={1} onPress={() => setShowStateModal(false)}>
          <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '60%' }} onStartShouldSetResponder={() => true}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>Select State</Text>
              <TouchableOpacity onPress={() => setShowStateModal(false)}>
                <Text style={{ color: '#6B7280', fontWeight: '600' }}>Close</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={State.getStatesOfCountry('IN')}
              keyExtractor={item => item.isoCode}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => handleStateSelect(item)} style={{ paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F9FAFB', flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 16, color: '#1F2937', fontWeight: '500' }}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showCityModal} animationType="fade" transparent={true}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} activeOpacity={1} onPress={() => setShowCityModal(false)}>
          <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '60%' }} onStartShouldSetResponder={() => true}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>Select City</Text>
              <TouchableOpacity onPress={() => setShowCityModal(false)}>
                <Text style={{ color: '#6B7280', fontWeight: '600' }}>Close</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={selectedStateCode ? City.getCitiesOfState('IN', selectedStateCode) : []}
              keyExtractor={item => item.name}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => handleCitySelect(item)} style={{ paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F9FAFB', flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 16, color: '#1F2937', fontWeight: '500' }}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showRoleModal} animationType="fade" transparent={true}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} activeOpacity={1} onPress={() => setShowRoleModal(false)}>
          <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 24 }} onStartShouldSetResponder={() => true}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>Select Role</Text>
              <TouchableOpacity onPress={() => setShowRoleModal(false)}>
                <Text style={{ color: '#6B7280', fontWeight: '600' }}>Close</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => { setValue('role', 'store manager', { shouldValidate: true }); setShowRoleModal(false); }} style={{ paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' }}>
              <Text style={{ fontSize: 16, color: '#1F2937', fontWeight: '500' }}>Store Manager</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setValue('role', 'supervisor', { shouldValidate: true }); setShowRoleModal(false); }} style={{ paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' }}>
              <Text style={{ fontSize: 16, color: '#1F2937', fontWeight: '500' }}>Supervisor</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showStoreModal} animationType="fade" transparent={true}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} activeOpacity={1} onPress={() => setShowStoreModal(false)}>
          <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '60%' }} onStartShouldSetResponder={() => true}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>Select Store</Text>
              <TouchableOpacity onPress={() => setShowStoreModal(false)}>
                <Text style={{ color: '#6B7280', fontWeight: '600' }}>Close</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={stores.filter(store => 
                (!watch('state') || store.state === watch('state')) && 
                (!watch('city') || store.city === watch('city'))
              )}
              keyExtractor={item => item.store_id}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => { setValue('store_id', item.store_id, { shouldValidate: true }); setShowStoreModal(false); }} style={{ paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' }}>
                  <Text style={{ fontSize: 16, color: '#1F2937', fontWeight: '700', marginBottom: 4 }}>{item.store_name}</Text>
                  <Text style={{ fontSize: 13, color: '#6B7280' }}>{item.address}, {item.city}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={() => (
                <View style={{ padding: 24, alignItems: 'center', marginTop: 20 }}>
                  <Text style={{ color: '#6B7280', fontSize: 15, textAlign: 'center' }}>No store found for this city and state</Text>
                </View>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}
