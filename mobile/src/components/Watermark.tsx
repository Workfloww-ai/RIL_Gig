import React from 'react';
import { View } from 'react-native';

export function Watermark({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8F9' }}>
      {children}
    </View>
  );
}
