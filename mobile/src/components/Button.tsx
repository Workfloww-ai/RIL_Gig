import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator } from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'outline';
}

export function Button({ title, onPress, loading, disabled, variant = 'primary' }: ButtonProps) {
  const baseStyle = "w-full py-4 rounded-xl items-center justify-center";
  
  let variantStyle = "";
  let textStyle = "";
  
  if (variant === 'primary') {
    variantStyle = "bg-primary-500 shadow-md";
    textStyle = "text-white font-bold text-lg";
  } else if (variant === 'outline') {
    variantStyle = "bg-transparent border-2 border-primary-500";
    textStyle = "text-primary-500 font-bold text-lg";
  }
  
  if (disabled || loading) {
    variantStyle += " opacity-60";
  }

  return (
    <TouchableOpacity 
      className={`${baseStyle} ${variantStyle}`} 
      onPress={onPress} 
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#fff' : '#3b82f6'} />
      ) : (
        <Text className={textStyle}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}
