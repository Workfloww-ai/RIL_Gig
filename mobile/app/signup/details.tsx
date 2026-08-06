import React from 'react';
import { View, Text, ScrollView, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { apiClient } from '../../src/api/client';

const signupSchema = z.object({
  first_name: z.string().min(2, "First name is required"),
  last_name: z.string().optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal('')),
  address: z.string().min(5, "Address is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  pincode: z.string().length(6, "Pincode must be 6 digits"),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").optional().or(z.literal('')),
  gender: z.string().optional(),
  upi_id: z.string().optional(),
  alternate_number: z.string().optional(),
});

type SignupFormData = z.infer<typeof signupSchema>;

export default function SignupDetailsScreen() {
  const router = useRouter();
  const { mobile } = useLocalSearchParams();
  const [loading, setLoading] = React.useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupFormData) => {
    // Instead of creating the user immediately, we pass the serialized details to the next screen.
    router.push({ 
      pathname: '/signup/documents', 
      params: { 
        mobile, 
        userDetails: JSON.stringify(data) 
      } 
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView className="flex-1 px-8 pt-8" showsVerticalScrollIndicator={false}>
          <Text className="text-4xl font-bold text-gray-900 mb-3 tracking-tight">Create Profile</Text>
          <Text className="text-gray-500 mb-8 text-lg font-medium">Tell us a bit about yourself to get started.</Text>

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
              <Input label="Email" placeholder="john@example.com" keyboardType="email-address" value={value} onChangeText={onChange} error={errors.email?.message} />
            )}
          />
          <Controller
            control={control}
            name="address"
            render={({ field: { onChange, value } }) => (
              <Input label="Address *" placeholder="123 Main St" value={value} onChangeText={onChange} error={errors.address?.message} />
            )}
          />
          
          <View className="flex-row justify-between w-full">
            <View className="w-[48%]">
              <Controller
                control={control}
                name="city"
                render={({ field: { onChange, value } }) => (
                  <Input label="City *" placeholder="Mumbai" value={value} onChangeText={onChange} error={errors.city?.message} />
                )}
              />
            </View>
            <View className="w-[48%]">
              <Controller
                control={control}
                name="state"
                render={({ field: { onChange, value } }) => (
                  <Input label="State *" placeholder="Maharashtra" value={value} onChangeText={onChange} error={errors.state?.message} />
                )}
              />
            </View>
          </View>

          <Controller
            control={control}
            name="pincode"
            render={({ field: { onChange, value } }) => (
              <Input label="Pincode *" placeholder="400001" keyboardType="numeric" maxLength={6} value={value} onChangeText={onChange} error={errors.pincode?.message} />
            )}
          />

          <Controller
            control={control}
            name="alternate_number"
            render={({ field: { onChange, value } }) => (
              <Input label="Alternate Mobile (Optional)" placeholder="e.g. 9876543210" keyboardType="numeric" maxLength={10} value={value} onChangeText={onChange} error={errors.alternate_number?.message} />
            )}
          />

          <Controller
            control={control}
            name="upi_id"
            render={({ field: { onChange, value } }) => (
              <Input label="UPI ID (Optional)" placeholder="name@bank" value={value} onChangeText={onChange} error={errors.upi_id?.message} />
            )}
          />

          <View className="flex-row justify-between w-full">
            <View className="w-[48%]">
              <Controller
                control={control}
                name="gender"
                render={({ field: { onChange, value } }) => (
                  <Input label="Gender (M/F/O)" placeholder="M" maxLength={1} value={value} onChangeText={onChange} error={errors.gender?.message} />
                )}
              />
            </View>
            <View className="w-[48%]">
              <Controller
                control={control}
                name="dob"
                render={({ field: { onChange, value } }) => (
                  <Input label="Date of Birth" placeholder="YYYY-MM-DD" value={value} onChangeText={onChange} error={errors.dob?.message} />
                )}
              />
            </View>
          </View>

          <View className="mt-8 mb-12">
            <Button title="Continue to Documents" onPress={handleSubmit(onSubmit)} loading={loading} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
