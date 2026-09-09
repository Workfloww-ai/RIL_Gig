import React from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface StatusModalProps {
  visible: boolean;
  title: string;
  message: string;
  isError?: boolean;
  onClose: () => void;
}

export default function StatusModal({ visible, title, message, isError = false, onClose }: StatusModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, paddingLeft: 32, paddingRight: 32, width: '80%', alignItems: 'center', overflow: 'hidden' }}
          onStartShouldSetResponder={() => true}
        >
          {/* Left Red Bar */}
          <View style={{ position: 'absolute', bottom: -20, left: 0, width: 10, height: '60%', backgroundColor: '#D32F2F', zIndex: 10, transform: [{ skewY: '45deg' }] }} />

          {/* Right Green Bar */}
          <View style={{ position: 'absolute', top: -20, right: 0, width: 10, height: '60%', backgroundColor: '#0B5B31', zIndex: 10, transform: [{ skewY: '45deg' }] }} />

          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: isError ? '#FEF2F2' : '#DCFCE7', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Ionicons name={isError ? "close-circle" : "checkmark-circle"} size={28} color={isError ? "#D32F2F" : "#15803D"} />
          </View>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 12 }}>{title}</Text>
          <Text style={{ fontSize: 15, color: '#4B5563', textAlign: 'center', lineHeight: 22, marginBottom: 24 }}>
            {message}
          </Text>
          <TouchableOpacity onPress={onClose} style={{ backgroundColor: '#F3F4F6', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, width: '100%', alignItems: 'center' }}>
            <Text style={{ color: '#4B5563', fontWeight: '600', fontSize: 15 }}>Close</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
