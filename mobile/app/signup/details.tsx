import React, { useState } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, Modal, FlatList, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import DateTimePicker from '@react-native-community/datetimepicker';
import { State, City } from 'country-state-city';

import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';

const signupSchema = z.object({
  first_name: z.string().min(2, "First name is required"),
  last_name: z.string().optional(),
  email: z.string().email("Invalid email address"),
  address: z.string().min(5, "Address is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  pincode: z.string().length(6, "Pincode must be 6 digits"),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").min(1, "Date of birth is required"),
  gender: z.string().min(1, "Gender is required"),
  upi_id: z.string().regex(/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/, "Invalid UPI ID").min(1, "UPI ID is required"),
  alternate_number: z.string().regex(/^\d{10}$/, "Must be exactly 10 digits").or(z.literal('')),
});

type SignupFormData = z.infer<typeof signupSchema>;

const GENDER_OPTIONS = ['Male', 'Female', 'Other'];

export default function SignupDetailsScreen() {
  const router = useRouter();
  const { mobile } = useLocalSearchParams();
  const [loading, setLoading] = useState(false);

  // Modals state
  const [showStateModal, setShowStateModal] = useState(false);
  const [showCityModal, setShowCityModal] = useState(false);
  const [showGenderModal, setShowGenderModal] = useState(false);
  
  // Track selected state code for fetching cities
  const [selectedStateCode, setSelectedStateCode] = useState('');
  
  // DatePicker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [date, setDate] = useState(new Date(2000, 0, 1)); // Default to Jan 1 2000

  const { control, handleSubmit, setValue, watch, formState: { errors } } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  const selectedState = watch('state');

  const onSubmit = async (data: SignupFormData) => {
    router.push({ 
      pathname: '/signup/documents', 
      params: { 
        mobile, 
        userDetails: JSON.stringify(data) 
      } 
    });
  };

  const handleStateSelect = (stateObj: any) => {
    setValue('state', stateObj.name, { shouldValidate: true });
    setSelectedStateCode(stateObj.isoCode);
    // Reset city when state changes
    setValue('city', '', { shouldValidate: true });
    setShowStateModal(false);
  };

  const handleCitySelect = (cityObj: any) => {
    setValue('city', cityObj.name, { shouldValidate: true });
    setShowCityModal(false);
  };

  const handleGenderSelect = (gender: string) => {
    setValue('gender', gender, { shouldValidate: true });
    setShowGenderModal(false);
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || date;
    setShowDatePicker(Platform.OS === 'ios');
    setDate(currentDate);
    
    // Format YYYY-MM-DD
    const formatted = currentDate.toISOString().split('T')[0];
    setValue('dob', formatted, { shouldValidate: true });
  };

  return (
    <SafeAreaView className="flex-1 bg-sand pt-8">
      <KeyboardAwareScrollView 
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        enableOnAndroid={true}
        extraScrollHeight={20}
      >
        <Text className="text-4xl font-bold text-slate mb-2 tracking-tight">Create Profile</Text>
        <Text className="text-sage mb-8 text-base font-medium">Tell us a bit about yourself to get started.</Text>

        {Object.keys(errors).length > 0 && (
          <View className="bg-clay/10 border border-red-200 p-4 rounded-xl mb-6">
            <Text className="text-clay font-medium">Please fill all mandatory fields correctly before proceeding.</Text>
          </View>
        )}

        <View className="bg-cream p-5 rounded-3xl shadow-sm border border-sage/10 mb-6">
          <Controller
            control={control}
            name="first_name"
            render={({ field: { onChange, value } }) => (
              <Input label="First Name *" placeholder="John" value={value} onChangeText={onChange} error={errors.first_name?.message} />
            )}
          />
          <Controller
            control={control}
            name="last_name"
            render={({ field: { onChange, value } }) => (
              <Input label="Last Name" placeholder="Doe" value={value} onChangeText={onChange} error={errors.last_name?.message} />
            )}
          />
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, value } }) => (
              <Input label="Email *" placeholder="john@example.com" keyboardType="email-address" value={value} onChangeText={onChange} error={errors.email?.message} />
            )}
          />

          {/* Gender Selector */}
          <Controller
            control={control}
            name="gender"
            render={({ field: { value } }) => (
              <View className="mb-4">
                <Text className="text-slate font-medium text-sm mb-2 ml-1">Gender <Text className="text-clay/80">*</Text></Text>
                <TouchableOpacity 
                  onPress={() => setShowGenderModal(true)}
                  className={`w-full bg-sand border ${errors.gender ? 'border-clay/50' : 'border-sage/20'} rounded-2xl px-5 py-4 flex-row justify-between items-center`}
                >
                  <Text className={value ? "text-slate" : "text-sage"}>
                    {value || "Select Gender"}
                  </Text>
                  <Text className="text-sage">▼</Text>
                </TouchableOpacity>
                {errors.gender && <Text className="text-clay/80 text-xs mt-1 ml-1">{errors.gender.message}</Text>}
              </View>
            )}
          />

          {/* Date of Birth Selector */}
          <Controller
            control={control}
            name="dob"
            render={({ field: { value } }) => (
              <View className="mb-4">
                <Text className="text-slate font-medium text-sm mb-2 ml-1">Date of Birth <Text className="text-clay/80">*</Text></Text>
                <TouchableOpacity 
                  onPress={() => setShowDatePicker(true)}
                  className={`w-full bg-sand border ${errors.dob ? 'border-clay/50' : 'border-sage/20'} rounded-2xl px-5 py-4 flex-row justify-between items-center`}
                >
                  <Text className={value ? "text-slate" : "text-sage"}>
                    {value || "YYYY-MM-DD"}
                  </Text>
                  <Text className="text-sage">📅</Text>
                </TouchableOpacity>
                {errors.dob && <Text className="text-clay/80 text-xs mt-1 ml-1">{errors.dob.message}</Text>}
              </View>
            )}
          />
        </View>

        <Text className="text-lg font-bold text-slate mb-4 ml-1">Contact & Address</Text>
        <View className="bg-cream p-5 rounded-3xl shadow-sm border border-sage/10 mb-6">
          <Controller
            control={control}
            name="alternate_number"
            render={({ field: { onChange, value } }) => (
              <Input label="Alternate Mobile *" placeholder="e.g. 9876543210" keyboardType="numeric" maxLength={10} value={value} onChangeText={onChange} error={errors.alternate_number?.message} />
            )}
          />

          <Controller
            control={control}
            name="address"
            render={({ field: { onChange, value } }) => (
              <Input label="Address *" placeholder="123 Main St" value={value} onChangeText={onChange} error={errors.address?.message} />
            )}
          />
          
          {/* State Selector */}
          <Controller
            control={control}
            name="state"
            render={({ field: { value } }) => (
              <View className="mb-4">
                <Text className="text-slate font-medium text-sm mb-2 ml-1">State <Text className="text-clay/80">*</Text></Text>
                <TouchableOpacity 
                  onPress={() => setShowStateModal(true)}
                  className={`w-full bg-sand border ${errors.state ? 'border-clay/50' : 'border-sage/20'} rounded-2xl px-5 py-4 flex-row justify-between items-center`}
                >
                  <Text className={value ? "text-slate" : "text-sage"}>
                    {value || "Select State"}
                  </Text>
                  <Text className="text-sage">▼</Text>
                </TouchableOpacity>
                {errors.state && <Text className="text-clay/80 text-xs mt-1 ml-1">{errors.state.message}</Text>}
              </View>
            )}
          />

          {/* City Selector */}
          <Controller
            control={control}
            name="city"
            render={({ field: { value } }) => (
              <View className="mb-4">
                <Text className="text-slate font-medium text-sm mb-2 ml-1">City <Text className="text-clay/80">*</Text></Text>
                <TouchableOpacity 
                  onPress={() => {
                    if (selectedStateCode) setShowCityModal(true);
                  }}
                  className={`w-full ${!selectedStateCode ? 'bg-sage/10 opacity-70' : 'bg-sand'} border ${errors.city ? 'border-clay/50' : 'border-sage/20'} rounded-2xl px-5 py-4 flex-row justify-between items-center`}
                >
                  <Text className={value ? "text-slate" : "text-sage"}>
                    {!selectedStateCode ? "Select State First" : (value || "Select City")}
                  </Text>
                  <Text className="text-sage">▼</Text>
                </TouchableOpacity>
                {errors.city && <Text className="text-clay/80 text-xs mt-1 ml-1">{errors.city.message}</Text>}
              </View>
            )}
          />

          <Controller
            control={control}
            name="pincode"
            render={({ field: { onChange, value } }) => (
              <Input label="Pincode *" placeholder="400001" keyboardType="numeric" maxLength={6} value={value} onChangeText={onChange} error={errors.pincode?.message} />
            )}
          />
        </View>

        <Text className="text-lg font-bold text-slate mb-4 ml-1">Payment Details</Text>
        <View className="bg-cream p-5 rounded-3xl shadow-sm border border-sage/10 mb-8">
          <Controller
            control={control}
            name="upi_id"
            render={({ field: { onChange, value } }) => (
              <Input label="UPI ID *" placeholder="name@bank" value={value} onChangeText={onChange} error={errors.upi_id?.message} />
            )}
          />
          <Text className="text-sage text-xs ml-1 -mt-2 mb-2">Used for quick payouts.</Text>
        </View>

        <View className="mb-12">
          <Button title="Continue to Documents" onPress={handleSubmit(onSubmit)} loading={loading} />
        </View>
      </KeyboardAwareScrollView>

      {/* DatePicker (Android shows modal, iOS shows inline picker but handled gracefully here) */}
      {showDatePicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display="default"
          onChange={onDateChange}
          maximumDate={new Date()} // Can't be born in the future
        />
      )}

      {/* Gender Modal */}
      <Modal visible={showGenderModal} animationType="fade" transparent={true}>
        <TouchableOpacity 
          className="flex-1 bg-black/50 justify-center items-center p-6"
          activeOpacity={1}
          onPress={() => setShowGenderModal(false)}
        >
          <View className="bg-cream w-full rounded-3xl overflow-hidden shadow-xl" onStartShouldSetResponder={() => true}>
            <View className="bg-sand px-6 py-4 border-b border-sage/10">
              <Text className="text-lg font-bold text-slate">Select Gender</Text>
            </View>
            {GENDER_OPTIONS.map((g, idx) => (
              <TouchableOpacity 
                key={idx} 
                onPress={() => handleGenderSelect(g)}
                className={`px-6 py-5 ${idx !== GENDER_OPTIONS.length - 1 ? 'border-b border-gray-50' : ''}`}
              >
                <Text className="text-slate font-medium text-base">{g}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* State Modal */}
      <Modal visible={showStateModal} animationType="fade" transparent={true}>
        <TouchableOpacity 
          className="flex-1 bg-black/50 justify-end"
          activeOpacity={1}
          onPress={() => setShowStateModal(false)}
        >
          <View className="bg-cream w-full rounded-t-3xl overflow-hidden shadow-xl h-2/3" onStartShouldSetResponder={() => true}>
            <View className="bg-sand px-6 py-5 border-b border-sage/10 flex-row justify-between items-center">
              <Text className="text-lg font-bold text-slate">Select State</Text>
              <TouchableOpacity onPress={() => setShowStateModal(false)}>
                <Text className="text-sage font-bold">Close</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={State.getStatesOfCountry('IN')}
              keyExtractor={item => item.isoCode}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  onPress={() => handleStateSelect(item)}
                  className="px-6 py-4 border-b border-gray-50 flex-row justify-between items-center"
                >
                  <Text className="text-slate font-medium text-base mb-1">{item.name}</Text>
                  <Text className="text-moss font-bold">→</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* City Modal */}
      <Modal visible={showCityModal} animationType="fade" transparent={true}>
        <TouchableOpacity 
          className="flex-1 bg-black/50 justify-end"
          activeOpacity={1}
          onPress={() => setShowCityModal(false)}
        >
          <View className="bg-cream w-full rounded-t-3xl overflow-hidden shadow-xl h-2/3" onStartShouldSetResponder={() => true}>
            <View className="bg-sand px-6 py-5 border-b border-sage/10 flex-row justify-between items-center">
              <Text className="text-lg font-bold text-slate">Select City</Text>
              <TouchableOpacity onPress={() => setShowCityModal(false)}>
                <Text className="text-sage font-bold">Close</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={selectedStateCode ? City.getCitiesOfState('IN', selectedStateCode) : []}
              keyExtractor={item => item.name}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  onPress={() => handleCitySelect(item)}
                  className="px-6 py-4 border-b border-gray-50 flex-row justify-between items-center"
                >
                  <View>
                    <Text className="text-slate font-medium text-base mb-1">{item.name}</Text>
                  </View>
                  <Text className="text-moss font-bold">→</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}
