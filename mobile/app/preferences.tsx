import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { apiClient } from '../src/api/client';
import StatusModal from '../src/components/StatusModal';

interface CategoryItem {
  category_id: string;
  name: string;
  domain_id: string;
  is_active?: boolean;
}

interface DomainGroup {
  domain_id: string;
  name: string;
  categories: CategoryItem[];
}

export default function PreferencesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams() as { onboarding?: string; name?: string };
  const isOnboarding = params.onboarding === 'true';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userName, setUserName] = useState<string>(params.name || 'Worker');

  const [domains, setDomains] = useState<DomainGroup[]>([]);
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [certifiedCategories, setCertifiedCategories] = useState<Set<string>>(new Set());
  const [isDomainLocked, setIsDomainLocked] = useState(false);

  // Domain Switch Confirmation Modal
  const [pendingDomainId, setPendingDomainId] = useState<string | null>(null);
  const [showDomainSwitchModal, setShowDomainSwitchModal] = useState(false);

  const [statusModal, setStatusModal] = useState({
    visible: false,
    title: '',
    message: '',
    isError: false,
  });

  const showAlert = (title: string, message: string, isError: boolean = false) => {
    setStatusModal({
      visible: true,
      title,
      message,
      isError,
    });
  };

  // Map category names to icons
  const getCategoryIcon = (categoryName: string): keyof typeof MaterialCommunityIcons.glyphMap => {
    const lower = categoryName.toLowerCase();
    if (lower.includes('electric')) return 'lightning-bolt';
    if (lower.includes('plumb')) return 'water';
    if (lower.includes('hvac') || lower.includes('ac')) return 'weather-windy';
    if (lower.includes('carpent')) return 'hammer';
    if (lower.includes('mechanic')) return 'wrench';
    if (lower.includes('retail') || lower.includes('cashier')) return 'barcode-scan';
    if (lower.includes('warehouse') || lower.includes('loader')) return 'warehouse';
    if (lower.includes('hospitality') || lower.includes('f&b')) return 'silverware-fork-knife';
    if (lower.includes('logistic') || lower.includes('deliver')) return 'bike-fast';
    if (lower.includes('phlebotom') || lower.includes('medic')) return 'needle';
    return 'briefcase-outline';
  };

  // Map domain names to icons
  const getDomainIcon = (domainName: string): keyof typeof MaterialCommunityIcons.glyphMap => {
    const lower = domainName.toLowerCase();
    if (lower.includes('non') || lower.includes('retail')) return 'storefront-outline';
    if (lower.includes('tech') || lower.includes('trade')) return 'wrench';
    if (lower.includes('med') || lower.includes('health')) return 'medical-bag';
    return 'domain';
  };

  // Brief description for each domain
  const getDomainSubtitle = (domainName: string): string => {
    const lower = domainName.toLowerCase();
    if (lower.includes('non') || lower.includes('retail')) return 'Retail, Warehouse, Hospitality, Logistics & Delivery';
    if (lower.includes('tech') || lower.includes('trade')) return 'Plumber, Carpenter, Electrical, Mechanical, HVAC';
    if (lower.includes('med') || lower.includes('health')) return 'Phlebotomy & Healthcare Support';
    return 'Specialized Industry Roles';
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);

        const [categoriesRes, userPrefsRes, profileRes] = await Promise.all([
          apiClient.get('/preferences/categories'),
          apiClient.get('/preferences/my').catch(() => ({ data: { selected_category_ids: [], certified_category_ids: [] } })),
          apiClient.get('/auth/me').catch(() => ({ data: null })),
        ]);

        const fetchedDomains: DomainGroup[] = categoriesRes.data?.domains || [];
        setDomains(fetchedDomains);

        let initialDomainId: string | null = null;
        let selectedSet = new Set<string>();

        if (userPrefsRes.data) {
          const selected = userPrefsRes.data.selected_category_ids || [];
          selectedSet = new Set<string>(selected);
          const certified = new Set<string>(userPrefsRes.data.certified_category_ids || []);
          setSelectedCategories(selectedSet);
          setCertifiedCategories(certified);

          // Detect which domain the user's saved categories or certifications belong to
          const priorCategoryIds = selected.length > 0 ? selected : Array.from(certified);
          if (priorCategoryIds.length > 0) {
            for (const dom of fetchedDomains) {
              if (dom.categories.some((c) => priorCategoryIds.includes(c.category_id))) {
                initialDomainId = dom.domain_id;
                setIsDomainLocked(true);
                break;
              }
            }
          }
        }

        // Default to the first domain if no domain was pre-selected
        if (!initialDomainId && fetchedDomains.length > 0) {
          initialDomainId = fetchedDomains[0].domain_id;
        }

        setSelectedDomainId(initialDomainId);

        if (profileRes?.data?.first_name) {
          setUserName(profileRes.data.first_name);
        }
      } catch (err: any) {
        console.error('Failed to load preferences data:', err);
        showAlert('Error', 'Unable to load categories. Please check your connection.', true);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  const handleDomainPress = (targetDomainId: string) => {
    if (isDomainLocked) {
      if (targetDomainId === selectedDomainId) return;
      showAlert(
        'Industry Domain Locked',
        `Your industry domain is fixed to ${currentDomain?.name || 'your registered domain'}. You cannot change domains, but you can freely select and add any roles within ${currentDomain?.name || 'this domain'} below.`,
        false
      );
      return;
    }
    if (targetDomainId === selectedDomainId) return;

    // Check if user has any categories currently selected in the existing domain
    if (selectedCategories.size > 0) {
      setPendingDomainId(targetDomainId);
      setShowDomainSwitchModal(true);
    } else {
      setSelectedDomainId(targetDomainId);
    }
  };

  const confirmDomainSwitch = () => {
    if (isDomainLocked) return;
    if (pendingDomainId) {
      setSelectedDomainId(pendingDomainId);
      setSelectedCategories(new Set()); // Reset selections to guarantee single-domain compliance
    }
    setPendingDomainId(null);
    setShowDomainSwitchModal(false);
  };

  const toggleCategory = (cat: CategoryItem) => {
    if (cat.is_active === false) return;
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat.category_id)) {
        next.delete(cat.category_id);
      } else {
        next.add(cat.category_id);
      }
      return next;
    });
  };

  const toggleSelectAllCurrentDomain = () => {
    if (!currentDomain) return;
    const activeCats = currentDomain.categories.filter((c) => c.is_active !== false);
    const activeCatIds = activeCats.map((c) => c.category_id);
    if (activeCatIds.length === 0) return;

    const allActiveSelected = activeCatIds.every((id) => selectedCategories.has(id));

    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (allActiveSelected) {
        activeCatIds.forEach((id) => next.delete(id));
      } else {
        activeCatIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (selectedCategories.size === 0) {
      showAlert('Selection Required', 'Please select at least 1 job category in your domain to continue.', true);
      return;
    }

    try {
      setSaving(true);
      await apiClient.post('/preferences/save', {
        category_ids: Array.from(selectedCategories),
      });

      if (isOnboarding) {
        router.replace('/library');
      } else {
        showAlert('Preferences Updated', 'Your job preferences have been saved successfully.', false);
        setTimeout(() => {
          router.replace('/library');
        }, 1200);
      }
    } catch (err: any) {
      console.error('Failed to save preferences:', err);
      showAlert('Save Failed', err.response?.data?.detail || 'Could not save your preferences. Please try again.', true);
    } finally {
      setSaving(false);
    }
  };

  const currentDomain = domains.find((d) => d.domain_id === selectedDomainId);
  const currentDomainActiveCategories = currentDomain
    ? currentDomain.categories.filter((c) => c.is_active !== false)
    : [];
  const currentDomainCategoryCount = currentDomainActiveCategories.length;
  const currentDomainSelectedCount = currentDomainActiveCategories.filter((c) =>
    selectedCategories.has(c.category_id)
  ).length;
  const isAllCurrentDomainSelected =
    currentDomainCategoryCount > 0 && currentDomainSelectedCount === currentDomainCategoryCount;

  const pendingDomain = domains.find((d) => d.domain_id === pendingDomainId);

  const screenWidth = Dimensions.get('window').width;
  const cardWidth = (screenWidth - 40 - 24) / 4;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: '#FAFBFB' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header Bar */}
      <View
        style={{
          backgroundColor: '#FFFFFF',
          paddingTop: 10,
          paddingBottom: 16,
          paddingHorizontal: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.05,
          shadowRadius: 10,
          elevation: 6,
          zIndex: 10,
          position: 'relative',
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {!isOnboarding && (
                <TouchableOpacity
                  onPress={() => router.back()}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: '#F3F4F6',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 8,
                  }}
                >
                  <MaterialCommunityIcons name="arrow-left" size={18} color="#374151" />
                </TouchableOpacity>
              )}
              <Text style={{ fontSize: 13, fontWeight: '800', letterSpacing: 0.5 }}>
                <Text style={{ color: '#0B5B31' }}>Sah</Text>
                <Text style={{ color: '#D32F2F' }}>Yogi</Text>
              </Text>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#777777', marginLeft: 6 }}>
                • {isOnboarding ? 'STEP 2: PREFERENCES' : 'JOB PREFERENCES'}
              </Text>
            </View>
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#1A1A1A', marginTop: 4, letterSpacing: -0.5 }}>
              Select Domain & Roles
            </Text>
          </View>

          <Image
            source={require('../assets/images/newlogo.png')}
            style={{ width: 60, height: 60, resizeMode: 'contain', marginLeft: 12 }}
          />
        </View>

        {/* Decorative Brand Line - Absolute Bottom (Same as library.tsx) */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 8, flexDirection: 'row', overflow: 'hidden' }}>
          <View style={{ flex: 1, backgroundColor: '#0B5B31' }} />
          <View style={{ width: 0, height: 0, borderTopWidth: 8, borderTopColor: '#0B5B31', borderRightWidth: 8, borderRightColor: 'transparent', marginLeft: -1 }} />
          <View style={{ width: 4, height: 8, backgroundColor: 'transparent' }} />
          <View style={{ width: 0, height: 0, borderBottomWidth: 8, borderBottomColor: '#D32F2F', borderLeftWidth: 8, borderLeftColor: 'transparent', marginRight: -1 }} />
          <View style={{ flex: 1, backgroundColor: '#D32F2F' }} />
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#0B5B31" />
          <Text style={{ marginTop: 12, fontSize: 14, color: '#666666', fontWeight: '600' }}>
            Loading categories...
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 110 + insets.bottom }}
          showsVerticalScrollIndicator={false}
        >
          {/* Locked Status Banner if already configured */}
          {isDomainLocked && (
            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: '#E5E7EB',
                borderLeftWidth: 4,
                borderLeftColor: '#D32F2F',
                borderRightWidth: 4,
                borderRightColor: '#0B5B31',
                padding: 14,
                marginBottom: 16,
                flexDirection: 'row',
                alignItems: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 6,
                elevation: 2,
              }}
            >
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  backgroundColor: '#EAF3EC',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <MaterialCommunityIcons name="lock-check" size={22} color="#0B5B31" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#1A1A1A' }}>
                  Industry Domain Registered: <Text style={{ color: '#0B5B31' }}>{currentDomain?.name || 'Selected Domain'}</Text>
                </Text>
                <Text style={{ fontSize: 11, fontWeight: '600', color: '#666666', marginTop: 2 }}>
                  Domain cannot be changed, but you can select or add any roles in this domain below.
                </Text>
              </View>
            </View>
          )}

          {/* ======================================================== */}
          {/* STEP 1: CHOOSE DOMAIN (EXCLUSIVE SELECTION) */}
          {/* ======================================================== */}
          <View style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <View>
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#1A1A1A' }}>
                  <Text style={{ color: '#D32F2F' }}>Step 1: </Text>Industry Domain
                </Text>
                <Text style={{ fontSize: 12, color: '#666666', marginTop: 2 }}>
                  {isDomainLocked ? 'Your registered industry sector' : 'Job roles are organized exclusively by domain'}
                </Text>
              </View>
              <View style={{ backgroundColor: isDomainLocked ? '#EAF3EC' : '#F2F6F4', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: isDomainLocked ? '#0B5B31' : '#C3D3CA' }}>
                <Text style={{ color: '#0B5B31', fontSize: 11, fontWeight: '700' }}>{isDomainLocked ? 'Domain Locked' : 'Single Domain'}</Text>
              </View>
            </View>

            {domains.map((dom, domIdx) => {
              const isDomainActive = dom.domain_id === selectedDomainId;
              const isDomainOtherAndLocked = isDomainLocked && !isDomainActive;
              const hasCertified = dom.categories.some((c) => certifiedCategories.has(c.category_id));

              return (
                <TouchableOpacity
                  key={dom.domain_id}
                  onPress={() => handleDomainPress(dom.domain_id)}
                  activeOpacity={isDomainOtherAndLocked ? 0.6 : 0.8}
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: '#E5E7EB',
                    borderLeftWidth: 4,
                    borderLeftColor: isDomainOtherAndLocked ? '#D1D5DB' : '#D32F2F',
                    borderRightWidth: 4,
                    borderRightColor: isDomainOtherAndLocked ? '#D1D5DB' : '#0B5B31',
                    padding: 14,
                    marginBottom: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    opacity: isDomainOtherAndLocked ? 0.45 : 1,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: isDomainActive ? 0.08 : 0.03,
                    shadowRadius: 6,
                    elevation: isDomainActive ? 3 : 2,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 10 }}>
                    <View
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 12,
                        backgroundColor: isDomainActive ? '#0B5B31' : isDomainOtherAndLocked ? '#E5E7EB' : '#F3F4F6',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 12,
                      }}
                    >
                      <MaterialCommunityIcons
                        name={getDomainIcon(dom.name)}
                        size={22}
                        color={isDomainActive ? '#FFFFFF' : '#4B5563'}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ fontSize: 15, fontWeight: '800', color: isDomainActive ? '#0B5B31' : isDomainOtherAndLocked ? '#9CA3AF' : '#1A1A1A' }}>
                          <Text style={{ color: '#D32F2F' }}>{domIdx + 1}. </Text>
                          {dom.name}
                        </Text>
                        {hasCertified && (
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#0B5B31', marginLeft: 6 }}>
                            • Certified ✓
                          </Text>
                        )}
                      </View>
                      <Text style={{ fontSize: 11, color: isDomainOtherAndLocked ? '#9CA3AF' : '#666666', marginTop: 2 }} numberOfLines={1}>
                        {getDomainSubtitle(dom.name)}
                      </Text>
                    </View>
                  </View>

                  {/* Radio / Selection Indicator / Lock Badge */}
                  {isDomainOtherAndLocked ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                      <MaterialCommunityIcons name="lock" size={12} color="#9CA3AF" style={{ marginRight: 4 }} />
                      <Text style={{ fontSize: 10, fontWeight: '700', color: '#9CA3AF' }}>Locked</Text>
                    </View>
                  ) : isDomainActive ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#0B5B31', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                      {isDomainLocked && <MaterialCommunityIcons name="lock" size={11} color="#FFFFFF" style={{ marginRight: 4 }} />}
                      <Text style={{ fontSize: 10, fontWeight: '700', color: '#FFFFFF' }}>{isDomainLocked ? 'Registered' : 'Selected'}</Text>
                    </View>
                  ) : (
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        borderWidth: 2,
                        borderColor: '#CBD5E1',
                        backgroundColor: '#FFFFFF',
                      }}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ======================================================== */}
          {/* STEP 2: SELECT CATEGORIES IN CHOSEN DOMAIN */}
          {/* ======================================================== */}
          {currentDomain && (
            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: '#E5E7EB',
                borderLeftWidth: 5,
                borderLeftColor: '#D32F2F',
                borderRightWidth: 5,
                borderRightColor: '#0B5B31',
                padding: 16,
                marginBottom: 16,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
                elevation: 3,
              }}
            >
              {/* Domain Header Card */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 8 }}>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: '#0B5B31',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 10,
                    }}
                  >
                    <MaterialCommunityIcons
                      name={getDomainIcon(currentDomain.name)}
                      size={20}
                      color="#FFFFFF"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#1A1A1A' }} numberOfLines={1}>
                      <Text style={{ color: '#D32F2F' }}>Step 2: </Text>
                      {currentDomain.name} Roles
                    </Text>
                    <Text style={{ fontSize: 11, color: '#666666', marginTop: 1 }}>
                      Choose 1 or more roles in this domain
                    </Text>
                  </View>
                </View>

                {/* Domain Action Badge Button */}
                <TouchableOpacity
                  onPress={toggleSelectAllCurrentDomain}
                  activeOpacity={0.7}
                  style={{
                    backgroundColor: currentDomainSelectedCount > 0 ? '#0B5B31' : '#FFF5F5',
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: currentDomainSelectedCount > 0 ? '#0B5B31' : '#FED7D7',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: currentDomainSelectedCount > 0 ? '#FFFFFF' : '#D32F2F',
                    }}
                  >
                    {isAllCurrentDomainSelected ? 'All Selected ✓' : currentDomainSelectedCount > 0 ? `${currentDomainSelectedCount} Selected ✓` : '+ Select All'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Category Cards Grid */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
                {currentDomain.categories.map((cat) => {
                  const isInactive = cat.is_active === false;
                  const isSelected = selectedCategories.has(cat.category_id);
                  const isCertified = certifiedCategories.has(cat.category_id);

                  return (
                    <View key={cat.category_id} style={{ width: cardWidth, paddingHorizontal: 3, marginBottom: 10 }}>
                      <TouchableOpacity
                        onPress={() => toggleCategory(cat)}
                        disabled={isInactive}
                        activeOpacity={isInactive ? 1 : 0.8}
                        style={{
                          backgroundColor: isInactive ? '#F9FAFB' : isSelected ? '#EAF3EC' : '#FFFFFF',
                          borderRadius: 16,
                          borderWidth: isSelected ? 1.5 : 1,
                          borderColor: isInactive ? '#E5E7EB' : isSelected ? '#0B5B31' : '#E5E7EB',
                          paddingVertical: 12,
                          paddingHorizontal: 4,
                          alignItems: 'center',
                          justifyContent: 'center',
                          minHeight: 104,
                          position: 'relative',
                          opacity: isInactive ? 0.6 : 1,
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: isSelected ? 2 : 1 },
                          shadowOpacity: isSelected ? 0.08 : 0.02,
                          shadowRadius: isSelected ? 4 : 2,
                          elevation: isSelected ? 3 : 1,
                        }}
                      >
                        {/* Corner Indicator Badge */}
                        {isInactive ? (
                          <View
                            style={{
                              position: 'absolute',
                              top: 5,
                              right: 5,
                              backgroundColor: '#E5E7EB',
                              paddingHorizontal: 4,
                              paddingVertical: 1.5,
                              borderRadius: 4,
                            }}
                          >
                            <Text style={{ fontSize: 7, fontWeight: '800', color: '#6B7280' }}>
                              SOON
                            </Text>
                          </View>
                        ) : isSelected ? (
                          <View
                            style={{
                              position: 'absolute',
                              top: 6,
                              right: 6,
                              width: 16,
                              height: 16,
                              borderRadius: 8,
                              backgroundColor: '#0B5B31',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <MaterialCommunityIcons name="check" size={11} color="#FFFFFF" />
                          </View>
                        ) : (
                          <View
                            style={{
                              position: 'absolute',
                              top: 6,
                              right: 6,
                              width: 14,
                              height: 14,
                              borderRadius: 7,
                              borderWidth: 1.5,
                              borderColor: '#CBD5E1',
                              backgroundColor: '#FFFFFF',
                            }}
                          />
                        )}

                        {/* Icon Container */}
                        <View
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 12,
                            backgroundColor: isInactive ? '#E5E7EB' : isSelected ? '#0B5B31' : '#F3F4F6',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 6,
                          }}
                        >
                          <MaterialCommunityIcons
                            name={getCategoryIcon(cat.name)}
                            size={22}
                            color={isInactive ? '#9CA3AF' : isSelected ? '#FFFFFF' : '#4B5563'}
                          />
                        </View>

                        {/* Category Name */}
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: isInactive ? '600' : isSelected ? '800' : '600',
                            color: isInactive ? '#9CA3AF' : isSelected ? '#0B5B31' : '#374151',
                            textAlign: 'center',
                            lineHeight: 14,
                          }}
                          numberOfLines={2}
                        >
                          {cat.name}
                        </Text>

                        {/* Coming Soon or Certified Badge */}
                        {isInactive ? (
                          <View
                            style={{
                              marginTop: 4,
                              backgroundColor: '#E5E7EB',
                              paddingHorizontal: 4,
                              paddingVertical: 1.5,
                              borderRadius: 4,
                            }}
                          >
                            <Text style={{ fontSize: 8, fontWeight: '700', color: '#6B7280' }}>
                              Coming Soon
                            </Text>
                          </View>
                        ) : isCertified ? (
                          <View
                            style={{
                              marginTop: 4,
                              backgroundColor: '#E8F5E9',
                              paddingHorizontal: 4,
                              paddingVertical: 1,
                              borderRadius: 4,
                            }}
                          >
                            <Text style={{ fontSize: 9, fontWeight: '700', color: '#0B5B31' }}>
                              Certified
                            </Text>
                          </View>
                        ) : null}
                      </TouchableOpacity>
                    </View>
                  );
                })}
                {currentDomain.categories.length === 0 && (
                  <View style={{ width: '100%', paddingVertical: 24, alignItems: 'center' }}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={32} color="#9CA3AF" />
                    <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 8, fontWeight: '600' }}>
                      No active job roles currently available in this domain.
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* Sticky Bottom Floating Action Bar */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#FFFFFF',
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: Math.max(insets.bottom, 12),
          borderTopWidth: 1,
          borderTopColor: '#EEEEEE',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.06,
          shadowRadius: 10,
          elevation: 10,
        }}
      >
        {/* Selected Count Indicator Badge */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderWidth: 1,
              borderColor: '#E5E7EB',
              borderLeftWidth: 3.5,
              borderLeftColor: '#D32F2F',
              borderRightWidth: 3.5,
              borderRightColor: '#0B5B31',
              marginRight: 10,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.04,
              shadowRadius: 3,
              elevation: 1,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '900', color: '#1A1A1A', textAlign: 'center' }}>
              <Text style={{ color: '#D32F2F' }}>{selectedCategories.size}</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#777777' }}> / {currentDomainCategoryCount}</Text>
            </Text>
          </View>
          <View>
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#1A1A1A' }}>
              {currentDomain ? currentDomain.name : 'Domain'}
            </Text>
            <Text style={{ fontSize: 11, fontWeight: '600', color: '#666666' }}>
              {selectedCategories.size} {selectedCategories.size === 1 ? 'Role' : 'Roles'} Selected
            </Text>
          </View>
        </View>

        {/* Action Button: Always allows saving preferences */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving || loading}
          activeOpacity={0.8}
          style={{
            backgroundColor: '#0B5B31',
            paddingHorizontal: 22,
            paddingVertical: 14,
            borderRadius: 14,
            flexDirection: 'row',
            alignItems: 'center',
            shadowColor: '#0B5B31',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 4,
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 15, marginRight: 8 }}>
                {isOnboarding ? 'Save & Continue' : 'Save Roles'}
              </Text>
              <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Domain Switch Warning Modal */}
      <Modal visible={showDomainSwitchModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 20,
              borderWidth: 1,
              borderColor: '#E5E7EB',
              borderLeftWidth: 4,
              borderLeftColor: '#D32F2F',
              borderRightWidth: 4,
              borderRightColor: '#0B5B31',
              padding: 24,
              width: '85%',
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#FFF5F5', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <MaterialCommunityIcons name="alert-circle-outline" size={30} color="#D32F2F" />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#1A1A1A', marginBottom: 8, textAlign: 'center' }}>
              Switch Industry Domain?
            </Text>
            <Text style={{ fontSize: 14, color: '#555555', textAlign: 'center', lineHeight: 20, marginBottom: 20 }}>
              Changing to <Text style={{ fontWeight: '700', color: '#0B5B31' }}>{pendingDomain?.name}</Text> will clear your selected roles from the current domain.
            </Text>
            <View style={{ flexDirection: 'row', width: '100%', gap: 10 }}>
              <TouchableOpacity
                onPress={() => {
                  setPendingDomainId(null);
                  setShowDomainSwitchModal(false);
                }}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center' }}
              >
                <Text style={{ color: '#4B5563', fontWeight: '700', fontSize: 14 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmDomainSwitch}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#0B5B31', alignItems: 'center' }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>Switch</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Application Themed Alert Modal */}
      <StatusModal
        visible={statusModal.visible}
        title={statusModal.title}
        message={statusModal.message}
        isError={statusModal.isError}
        onClose={() => setStatusModal((prev) => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
  );
}
