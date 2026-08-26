import React from 'react';
import { TextInput, View, Text, TextInputProps } from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, ...props }: InputProps) {
  // Extract asterisk if present at the end of the label
  const hasAsterisk = label?.endsWith('*');
  const labelText = hasAsterisk && label ? label.slice(0, -1).trim() : label;

  return (
    <View className="w-full mb-4">
      {label !== undefined && (
        <Text className="text-gray-700 font-semibold mb-2 ml-1">
          {labelText}
          {hasAsterisk && <Text className="text-red-500"> *</Text>}
        </Text>
      )}
      <TextInput
        className={`w-full bg-gray-50 border ${error ? 'border-red-500' : 'border-gray-200'} rounded-xl px-5 py-4 text-gray-900 font-medium focus:border-primary-500 focus:bg-primary-50`}
        placeholderTextColor="#9ca3af"
        {...props}
      />
      {error ? <Text className="text-red-500 text-sm mt-1 ml-1">{error}</Text> : null}
    </View>
  );
}
