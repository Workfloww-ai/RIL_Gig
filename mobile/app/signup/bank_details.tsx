import React from 'react';
import { View, Text, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';

// Define the validation schema
const formSchema = z.object({
  bank_account_number: z.string()
    .min(9, 'Account number must be at least 9 characters')
    .max(18, 'Account number cannot exceed 18 characters')
    .regex(/^\d+$/, 'Account number must contain only digits'),
  confirm_account_number: z.string(),
  ifsc_code: z.string()
    .length(11, 'IFSC code must be exactly 11 characters')
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC format (e.g. ABCD0123456)'),
}).refine((data) => data.bank_account_number === data.confirm_account_number, {
  message: "Account numbers don't match",
  path: ["confirm_account_number"],
});

type FormData = z.infer<typeof formSchema>;

export default function BankDetailsScreen() {
  const router = useRouter();
  const { mobile, userDetails } = useLocalSearchParams() as { mobile: string; userDetails: string };

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      bank_account_number: '',
      confirm_account_number: '',
      ifsc_code: '',
    }
  });

  const onSubmit = (data: FormData) => {
    // Parse existing user details, append new ones
    let existingDetails = {};
    try {
      if (userDetails) {
        existingDetails = JSON.parse(userDetails);
      }
    } catch (e) {
      console.error("Failed to parse user details:", e);
    }

    const mergedDetails = {
      ...existingDetails,
      bank_account_number: data.bank_account_number,
      ifsc_code: data.ifsc_code.toUpperCase(),
    };

    router.push({
      pathname: '/signup/documents',
      params: {
        mobile,
        userDetails: JSON.stringify(mergedDetails)
      }
    });
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

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} 
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20} 
        className="flex-1 px-8"
      >
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1, paddingVertical: 32 }} 
          showsVerticalScrollIndicator={false} 
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-8">
            <Text className="text-4xl font-bold text-slate mb-3 tracking-tight">Bank Details</Text>
            <Text className="text-sage text-lg font-medium leading-relaxed">
              We need this to process your gig payments directly to your account.
            </Text>
          </View>

          {Object.keys(errors).length > 0 && (
            <View className="bg-clay/10 border border-red-200 p-4 rounded-xl mb-6">
              <Text className="text-clay font-medium text-center">
                Please fix the errors below before proceeding.
              </Text>
            </View>
          )}

          <View style={{ flex: 1, gap: 16 }}>
            <Controller
              control={control}
              name="bank_account_number"
              render={({ field: { onChange, value } }) => (
                <Input
                  label="Account Number"
                  placeholder="Enter Account Number"
                  value={value}
                  onChangeText={onChange}
                  keyboardType="numeric"
                  secureTextEntry={true} // Hidden while typing
                  error={errors.bank_account_number?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="confirm_account_number"
              render={({ field: { onChange, value } }) => (
                <Input
                  label="Confirm Account Number"
                  placeholder="Re-enter Account Number"
                  value={value}
                  onChangeText={onChange}
                  keyboardType="numeric"
                  error={errors.confirm_account_number?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="ifsc_code"
              render={({ field: { onChange, value } }) => (
                <Input
                  label="IFSC Code"
                  placeholder="e.g. SBIN0001234"
                  value={value}
                  onChangeText={(text) => onChange(text.toUpperCase())}
                  autoCapitalize="characters"
                  error={errors.ifsc_code?.message}
                />
              )}
            />
          </View>

          <View className="flex-1 justify-end mt-8">
            <Button
              title="Continue"
              onPress={handleSubmit(onSubmit)}
              className="w-full shadow-lg shadow-moss/20"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
