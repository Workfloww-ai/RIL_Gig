import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Platform, Modal, ScrollView, FlatList, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { State, City } from 'country-state-city';
import { apiClient } from '../../src/api/client';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';

// Validation Schema for Add Store
const storeSchema = z.object({
  store_name: z.string().min(2, "Store name is required"),
  address: z.string().min(5, "Street address is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  pincode: z.string().length(6, "PIN Code must be 6 digits"),
  google_map_link: z.string().url("Must be a valid URL").optional().or(z.literal('')),
  store_type: z.string().min(2, "Store type is required")
});

type StoreFormData = z.infer<typeof storeSchema>;

export default function SuperadminStores() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expandedStoreId, setExpandedStoreId] = useState<string | null>(null);

  const toggleExpand = (storeId: string) => {
    setExpandedStoreId(prev => prev === storeId ? null : storeId);
  };
  
  // State/City modal state
  const [showStateModal, setShowStateModal] = useState(false);
  const [showCityModal, setShowCityModal] = useState(false);
  const [showStoreTypeModal, setShowStoreTypeModal] = useState(false);
  const [selectedStateCode, setSelectedStateCode] = useState('');

  const { control, handleSubmit, setValue, reset, formState: { errors } } = useForm<StoreFormData>({
    resolver: zodResolver(storeSchema),
    defaultValues: {
      store_name: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      google_map_link: '',
      store_type: ''
    }
  });

  const fetchStores = async () => {
    setLoading(true);
    try {
      const storesRes = await apiClient.get('/superadmin/stores');
      if (storesRes?.data?.stores) setStores(storesRes.data.stores);
    } catch (err) {
      console.error('Failed to fetch stores data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
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

  const onSubmit = async (data: StoreFormData) => {
    setSubmitting(true);
    try {
      await apiClient.post('/superadmin/stores', data);
      Alert.alert('Success', 'Store created successfully');
      setIsAddModalOpen(false);
      reset();
      setSelectedStateCode('');
      fetchStores();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to create store');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* Main Content */}
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#1A1A1A', letterSpacing: -0.3 }}>Stores</Text>
          <TouchableOpacity
            onPress={() => setIsAddModalOpen(true)}
            style={{ backgroundColor: '#D32F2F', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, flexDirection: 'row', alignItems: 'center' }}
          >
            <Ionicons name="add" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>Add Store</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}>
          {loading ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ color: '#6B7280' }}>Loading stores...</Text>
            </View>
          ) : stores.length === 0 ? (
            <View style={{ backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' }}>
              <Text style={{ color: '#6B7280', fontSize: 15 }}>No stores found. Add one to get started.</Text>
            </View>
          ) : (
            stores.map((store) => (
              <View key={store.store_id} style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 }}>
                <TouchableOpacity onPress={() => toggleExpand(store.store_id)} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginRight: 8 }}>{store.store_name}</Text>
                      {store.store_type ? (
                        <View style={{ backgroundColor: '#EEF2FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                          <Text style={{ fontSize: 10, color: '#4F46E5', fontWeight: '600', textTransform: 'capitalize' }}>{store.store_type}</Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="location-outline" size={14} color="#6B7280" style={{ marginRight: 4 }} />
                      <Text style={{ fontSize: 13, color: '#6B7280' }} numberOfLines={1}>
                        {store.address}, {store.city}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name={expandedStoreId === store.store_id ? "chevron-up" : "chevron-down"} size={20} color="#6B7280" />
                </TouchableOpacity>

                {expandedStoreId === store.store_id && (
                  <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
                    <View style={{ marginBottom: 12 }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 4 }}>Full Address</Text>
                      <Text style={{ fontSize: 14, color: '#1F2937' }}>{store.address}, {store.city}, {store.state} - {store.pincode}</Text>
                    </View>
                    {store.google_map_link ? (
                      <View style={{ marginBottom: 4 }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 4 }}>Google Map Link</Text>
                        <Text style={{ fontSize: 14, color: '#3B82F6' }}>{store.google_map_link}</Text>
                      </View>
                    ) : null}
                  </View>
                )}
              </View>
            ))
          )}
        </ScrollView>
      </View>

      {/* Add Store Modal */}
      <Modal visible={isAddModalOpen} animationType="slide" transparent={true}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '90%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827' }}>Add New Store</Text>
              <TouchableOpacity onPress={() => setIsAddModalOpen(false)} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="close" size={20} color="#4B5563" />
              </TouchableOpacity>
            </View>

            <KeyboardAwareScrollView contentContainerStyle={{ padding: 24 }} showsVerticalScrollIndicator={false}>
              <Controller
                control={control}
                name="store_name"
                render={({ field: { onChange, value } }) => (
                  <Input label="Store Name" placeholder="SuperMart" value={value} onChangeText={onChange} error={errors.store_name?.message} />
                )}
              />
              <Controller
                control={control}
                name="address"
                render={({ field: { onChange, value } }) => (
                  <Input label="Street Address" placeholder="Main Street" value={value} onChangeText={onChange} error={errors.address?.message} />
                )}
              />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  {/* State Selector */}
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
                  {/* City Selector */}
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

              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Controller
                    control={control}
                    name="pincode"
                    render={({ field: { onChange, value } }) => (
                      <Input label="PIN Code" placeholder="000000" keyboardType="numeric" maxLength={6} value={value} onChangeText={onChange} error={errors.pincode?.message} />
                    )}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Controller
                    control={control}
                    name="store_type"
                    render={({ field: { value } }) => (
                      <View style={{ marginBottom: 16 }}>
                        <Text style={{ color: '#4B5563', fontWeight: '600', fontSize: 13, marginBottom: 8, marginLeft: 4 }}>Store Type</Text>
                        <TouchableOpacity 
                          onPress={() => setShowStoreTypeModal(true)}
                          style={{ backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: errors.store_type ? '#D32F2F' : '#E5E7EB', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                        >
                          <Text style={{ color: value ? '#111827' : '#9CA3AF', textTransform: value ? 'capitalize' : 'none' }}>{value || "Store Type"}</Text>
                          <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
                        </TouchableOpacity>
                        {errors.store_type && <Text style={{ color: '#D32F2F', fontSize: 12, marginTop: 4, marginLeft: 4 }}>{errors.store_type.message}</Text>}
                      </View>
                    )}
                  />
                </View>
              </View>

              <Controller
                control={control}
                name="google_map_link"
                render={({ field: { onChange, value } }) => (
                  <Input label="Google Maps Link" placeholder="https://maps.google.com/..." value={value} onChangeText={onChange} error={errors.google_map_link?.message} />
                )}
              />


              <View style={{ marginTop: 24, paddingBottom: 24 }}>
                <Button title="Create Store" onPress={handleSubmit(onSubmit)} loading={submitting} />
              </View>
            </KeyboardAwareScrollView>
          </View>
        </View>
      </Modal>

      {/* State Modal */}
      <Modal visible={showStateModal} animationType="fade" transparent={true}>
        <TouchableOpacity 
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => setShowStateModal(false)}
        >
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
                <TouchableOpacity 
                  onPress={() => handleStateSelect(item)}
                  style={{ paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F9FAFB', flexDirection: 'row', justifyContent: 'space-between' }}
                >
                  <Text style={{ fontSize: 16, color: '#1F2937', fontWeight: '500' }}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* City Modal */}
      <Modal visible={showCityModal} animationType="fade" transparent={true}>
        <TouchableOpacity 
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => setShowCityModal(false)}
        >
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
                <TouchableOpacity 
                  onPress={() => handleCitySelect(item)}
                  style={{ paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F9FAFB', flexDirection: 'row', justifyContent: 'space-between' }}
                >
                  <Text style={{ fontSize: 16, color: '#1F2937', fontWeight: '500' }}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Store Type Modal */}
      <Modal visible={showStoreTypeModal} animationType="fade" transparent={true}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} activeOpacity={1} onPress={() => setShowStoreTypeModal(false)}>
          <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 24 }} onStartShouldSetResponder={() => true}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>Select Store Type</Text>
              <TouchableOpacity onPress={() => setShowStoreTypeModal(false)}>
                <Text style={{ color: '#6B7280', fontWeight: '600' }}>Close</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => { setValue('store_type', 'offline store', { shouldValidate: true }); setShowStoreTypeModal(false); }} style={{ paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' }}>
              <Text style={{ fontSize: 16, color: '#1F2937', fontWeight: '500' }}>Offline Store</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setValue('store_type', 'dark store', { shouldValidate: true }); setShowStoreTypeModal(false); }} style={{ paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' }}>
              <Text style={{ fontSize: 16, color: '#1F2937', fontWeight: '500' }}>Dark Store</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setValue('store_type', 'hybrid store', { shouldValidate: true }); setShowStoreTypeModal(false); }} style={{ paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' }}>
              <Text style={{ fontSize: 16, color: '#1F2937', fontWeight: '500' }}>Hybrid Store</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}
