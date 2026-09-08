import React from 'react';
import { View, ImageBackground } from 'react-native';

export function Watermark({ children }: { children: React.ReactNode }) {
  return (
    <ImageBackground 
      source={require('../../assets/images/logo-sahyogi.png')} 
      style={{ flex: 1 }}
      imageStyle={{ opacity: 0.05, resizeMode: 'contain' }}
    >
      <View 
        className="absolute left-0 top-[15%] bottom-[50%] bg-clay" 
        style={{ width: 9, borderTopRightRadius: 9, borderBottomRightRadius: 9, zIndex: 50 }}
        pointerEvents="none"
      />
      <View 
        className="absolute right-0 top-[50%] bottom-[15%] bg-moss" 
        style={{ width: 9, borderTopLeftRadius: 9, borderBottomLeftRadius: 9, zIndex: 50 }}
        pointerEvents="none"
      />
      {children}
    </ImageBackground>
  );
}
