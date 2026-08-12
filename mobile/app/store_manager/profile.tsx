import React from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/authStore';

export default function StoreManagerProfileScreen() {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = () => {
    if (logout) logout();
    router.replace('/');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F8F9' }}>
      {/* Top Header */}
      <View style={{ backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
        <TouchableOpacity onPress={() => router.push('/store_manager')} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#1A1A1A', flex: 1, textAlign: 'center', paddingRight: 34 }}>Manager Profile</Text>
      </View>

      <ScrollView style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16 }} showsVerticalScrollIndicator={false}>
        {/* Profile Avatar Card */}
        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 28, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2, marginBottom: 20 }}>
          <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: '#E1EBE5', alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#F2F6F4', marginBottom: 14 }}>
            <Text style={{ color: '#10472B', fontSize: 32, fontWeight: '700' }}>RK</Text>
          </View>

          <Text style={{ fontSize: 22, fontWeight: '700', color: '#1A1A1A', marginBottom: 2, letterSpacing: -0.3 }}>RAJESH KUMAR</Text>
          <Text style={{ color: '#666666', fontSize: 13, fontWeight: '500', marginBottom: 12 }}>Store Manager • Reliance Smart</Text>

          {/* Rating Badge */}
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#FDE68A' }}>
            <Text style={{ color: '#F59E0B', marginRight: 6, fontSize: 14 }}>⭐⭐⭐⭐⭐</Text>
            <Text style={{ color: '#B45309', fontWeight: '700', fontSize: 13 }}>5.0</Text>
          </View>
          <Text style={{ color: '#9CA3AF', fontSize: 11, marginTop: 6 }}>Rated by Gig Workers & Operations</Text>
        </View>

        {/* Stats Grid Card */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
          <View style={{ backgroundColor: '#FFFFFF', flex: 1, marginRight: 8, borderRadius: 24, padding: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 18 }}>📋</Text>
            </View>
            <Text style={{ color: '#666666', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, textAlign: 'center' }}>Total Requests</Text>
            <Text style={{ fontSize: 22, fontWeight: '700', color: '#1A1A1A', textAlign: 'center' }}>18</Text>
          </View>

          <View style={{ backgroundColor: '#FFFFFF', flex: 1, marginLeft: 8, borderRadius: 24, padding: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 18 }}>👥</Text>
            </View>
            <Text style={{ color: '#666666', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, textAlign: 'center' }}>Workers Hired</Text>
            <Text style={{ fontSize: 22, fontWeight: '700', color: '#1A1A1A', textAlign: 'center' }}>42</Text>
          </View>
        </View>

        {/* Settings Options */}
        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2, marginBottom: 20 }}>
          <TouchableOpacity style={{ paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
            <Text style={{ color: '#1A1A1A', fontWeight: '600', fontSize: 14 }}>Store Settings & Locations</Text>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity style={{ paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
            <Text style={{ color: '#1A1A1A', fontWeight: '600', fontSize: 14 }}>Gig Worker Escalations</Text>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity style={{ paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: '#1A1A1A', fontWeight: '600', fontSize: 14 }}>Help & Support</Text>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          onPress={handleLogout}
          style={{ backgroundColor: '#FEF2F2', borderRadius: 24, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: '#FEE2E2', flexDirection: 'row', justifyContent: 'center', marginBottom: 40 }}
          activeOpacity={0.85}
        >
          <Text style={{ color: '#E31B23', fontWeight: '700', fontSize: 16 }}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
