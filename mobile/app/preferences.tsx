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

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const toggleSelectAllCurrentDomain = () => {
    if (!currentDomain) return;
    const currentCatIds = currentDomain.categories.map((c) => c.category_id);
    const allSelected = currentCatIds.every((id) => selectedCategories.has(id));

    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        currentCatIds.forEach((id) => next.delete(id));
      } else {
        currentCatIds.forEach((id) => next.add(id));
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
  const currentDomainCategoryCount = currentDomain ? currentDomain.categories.length : 0;
  const currentDomainSelectedCount = currentDomain
    ? currentDomain.categories.filter((c) => selectedCategories.has(c.category_id)).length
    : 0;
  const isAllCurrentDomainSelected = currentDomainCategoryCount > 0 && currentDomainSelectedCount === currentDomainCategoryCount;

  const pendingDomain = domains.find((d) => d.domain_id === pendingDomainId);

  const screenWidth = Dimensions.get('window').width;
  const cardWidth = (screenWidth - 40 - 24) / 4;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: '#FAFBFB' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFBFB" />

      {/* Decorative Brand Top Accent Line */}
      <View style={{ height: 4, flexDirection: 'row', width: '100%' }}>
        <View style={{ flex: 1, backgroundColor: '#10472B' }} />
        <View style={{ width: 60, backgroundColor: '#D32F2F' }} />
      </View>

      {/* Header Bar */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, backgroundColor: '#FAFBFB' }}>
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
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#D32F2F', letterSpacing: 0.5 }}>
                Sah<Text style={{ color: '#10472B' }}>Yogi</Text>
              </Text>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#777777', marginLeft: 6 }}>
                • {isOnboarding ? 'STEP 2: PREFERENCES' : 'JOB PREFERENCES'}
              </Text>
            </View>
            <Text style={{ fontSize: 24, fontWeight: '800', color: '#1A1A1A', marginTop: 4, letterSpacing: -0.5 }}>
              Hi {userName ? userName.charAt(0).toUpperCase() + userName.slice(1).toLowerCase() : 'Worker'}, Select Domain & Roles
            </Text>
          </View>

          <Image
            source={require('../assets/images/newlogo.png')}
            style={{ width: 52, height: 52, resizeMode: 'contain', marginLeft: 12 }}
          />
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#10472B" />
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
            <View style={{ backgroundColor: '#EAF3EC', borderWidth: 1.5, borderColor: '#10472B', borderRadius: 16, padding: 14, marginBottom: 16, flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="lock-check" size={24} color="#10472B" style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#10472B' }}>
                  Industry Domain Registered: {currentDomain?.name || 'Selected Domain'}
                </Text>
                <Text style={{ fontSize: 11, fontWeight: '600', color: '#2E7D32', marginTop: 2 }}>
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
              <View style={{ backgroundColor: isDomainLocked ? '#EAF3EC' : '#F2F6F4', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: isDomainLocked ? '#10472B' : '#C3D3CA' }}>
                <Text style={{ color: '#10472B', fontSize: 11, fontWeight: '700' }}>{isDomainLocked ? 'Domain Locked' : 'Single Domain'}</Text>
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
                    backgroundColor: isDomainActive ? '#EAF3EC' : isDomainOtherAndLocked ? '#F9FAFB' : '#FFFFFF',
                    borderRadius: 16,
                    borderWidth: 1.5,
                    borderColor: isDomainActive ? '#10472B' : '#E5E7EB',
                    padding: 14,
                    marginBottom: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    opacity: isDomainOtherAndLocked ? 0.45 : 1,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: isDomainActive ? 0.06 : 0.02,
                    shadowRadius: 3,
                    elevation: isDomainActive ? 2 : 1,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 10 }}>
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        backgroundColor: isDomainActive ? '#10472B' : isDomainOtherAndLocked ? '#E5E7EB' : '#F3F4F6',
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
                        <Text style={{ fontSize: 15, fontWeight: '800', color: isDomainActive ? '#10472B' : isDomainOtherAndLocked ? '#9CA3AF' : '#1A1A1A' }}>
                          <Text style={{ color: '#D32F2F' }}>{domIdx + 1}. </Text>
                          {dom.name}
                        </Text>
                        {hasCertified && (
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#10472B', marginLeft: 6 }}>
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
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#10472B', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
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
                borderWidth: 1.5,
                borderColor: currentDomainSelectedCount > 0 ? '#10472B' : '#E5E7EB',
                padding: 16,
                marginBottom: 16,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 6,
                elevation: 2,
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
                      backgroundColor: '#10472B',
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
                    backgroundColor: currentDomainSelectedCount > 0 ? '#10472B' : '#FFF5F5',
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: currentDomainSelectedCount > 0 ? '#10472B' : '#FED7D7',
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
                  const isSelected = selectedCategories.has(cat.category_id);
                  const isCertified = certifiedCategories.has(cat.category_id);

                  return (
                    <View key={cat.category_id} style={{ width: cardWidth, paddingHorizontal: 3, marginBottom: 10 }}>
                      <TouchableOpacity
                        onPress={() => toggleCategory(cat.category_id)}
                        activeOpacity={0.8}
                        style={{
                          backgroundColor: isSelected ? '#EAF3EC' : '#FFFFFF',
                          borderRadius: 16,
                          borderWidth: 1.5,
                          borderColor: isSelected ? '#10472B' : '#F0F0F0',
                          paddingVertical: 12,
                          paddingHorizontal: 6,
                          alignItems: 'center',
                          justifyContent: 'center',
                          minHeight: 96,
                          position: 'relative',
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: isSelected ? 0.08 : 0.02,
                          shadowRadius: 3,
                          elevation: isSelected ? 2 : 1,
                        }}
                      >
                        {/* Corner Indicator Badge */}
                        <View
                          style={{
                            position: 'absolute',
                            top: 6,
                            right: 6,
                            width: 14,
                            height: 14,
                            borderRadius: 7,
                            backgroundColor: isSelected ? '#10472B' : '#FFCDD2',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {isSelected ? (
                            <MaterialCommunityIcons name="check" size={10} color="#FFFFFF" />
                          ) : null}
                        </View>

                        {/* Icon Container */}
                        <View
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: 12,
                            backgroundColor: isSelected ? '#10472B' : '#F3F4F6',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 8,
                          }}
                        >
                          <MaterialCommunityIcons
                            name={getCategoryIcon(cat.name)}
                            size={22}
                            color={isSelected ? '#FFFFFF' : '#4B5563'}
                          />
                        </View>

                        {/* Category Name */}
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: isSelected ? '800' : '600',
                            color: isSelected ? '#10472B' : '#374151',
                            textAlign: 'center',
                            lineHeight: 14,
                          }}
                          numberOfLines={2}
                        >
                          {cat.name}
                        </Text>

                        {isCertified && (
                          <View
                            style={{
                              marginTop: 4,
                              backgroundColor: '#E8F5E9',
                              paddingHorizontal: 4,
                              paddingVertical: 1,
                              borderRadius: 4,
                            }}
                          >
                            <Text style={{ fontSize: 9, fontWeight: '700', color: '#10472B' }}>
                              Certified
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })}
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
              backgroundColor: '#FFEBEE',
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderWidth: 1,
              borderColor: '#FFCDD2',
              marginRight: 10,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '900', color: '#D32F2F', textAlign: 'center' }}>
              {selectedCategories.size} <Text style={{ fontSize: 13, fontWeight: '700', color: '#777777' }}>/ {currentDomainCategoryCount}</Text>
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
            backgroundColor: '#10472B',
            paddingHorizontal: 22,
            paddingVertical: 14,
            borderRadius: 14,
            flexDirection: 'row',
            alignItems: 'center',
            shadowColor: '#10472B',
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
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, width: '85%', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 }}>
            <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#FFF5F5', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <MaterialCommunityIcons name="alert-circle-outline" size={30} color="#D32F2F" />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#1A1A1A', marginBottom: 8, textAlign: 'center' }}>
              Switch Industry Domain?
            </Text>
            <Text style={{ fontSize: 14, color: '#555555', textAlign: 'center', lineHeight: 20, marginBottom: 20 }}>
              Changing to <Text style={{ fontWeight: '700', color: '#10472B' }}>{pendingDomain?.name}</Text> will clear your selected roles from the current domain.
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
                style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#10472B', alignItems: 'center' }}
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
