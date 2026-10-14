import React from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Dimensions,
} from 'react-native';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotifications, NotificationItem } from '../context/NotificationContext';

const { width } = Dimensions.get('window');

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  } catch {
    return 'Recently';
  }
}

export const NotificationDrawer: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    loading,
    isDrawerOpen,
    setIsDrawerOpen,
    filterCategory,
    setFilterCategory,
    markAsRead,
    markAllAsRead,
    connected,
  } = useNotifications();

  if (!isDrawerOpen) return null;

  const categories = [
    { id: 'ALL', label: 'All' },
    { id: 'UNREAD', label: 'Unread' },
    { id: 'LEARNING', label: 'Learning' },
    { id: 'SYSTEM', label: 'System' },
    { id: 'ACHIEVEMENTS', label: 'Achievements' },
  ];

  const filteredNotifications = notifications.filter((n) => {
    if (filterCategory === 'UNREAD') return !n.read;
    if (filterCategory === 'LEARNING') return n.type === 'LEARNING' || n.type === 'MODULE_ASSIGNED';
    if (filterCategory === 'ACHIEVEMENTS') return n.type === 'ACHIEVEMENTS' || n.type === 'GAMIFICATION';
    if (filterCategory === 'SYSTEM') return n.type === 'SYSTEM' || n.type === 'OPERATIONS';
    return true;
  });

  const getCategoryIcon = (type: string) => {
    switch (type?.toUpperCase()) {
      case 'LEARNING':
      case 'MODULE_ASSIGNED':
        return <Feather name="book-open" size={16} color="#2563EB" />;
      case 'ACHIEVEMENTS':
      case 'GAMIFICATION':
        return <Feather name="award" size={16} color="#D97706" />;
      case 'SYSTEM':
      case 'SECURITY_ALERT':
        return <Feather name="shield" size={16} color="#DC2626" />;
      default:
        return <Feather name="bell" size={16} color="#0B5B31" />;
    }
  };

  const handleNotificationPress = (item: NotificationItem) => {
    if (!item.read) {
      markAsRead(item.id);
    }
    const target = item.metadata?.action_url || item.metadata?.target_screen;
    if (target) {
      setIsDrawerOpen(false);
      if (target.startsWith('http://') || target.startsWith('https://')) {
        Linking.openURL(target).catch(() => {});
      } else {
        router.push(target as any);
      }
    }
  };

  return (
    <Modal
      visible={isDrawerOpen}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setIsDrawerOpen(false)}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setIsDrawerOpen(false)}
        />

        <View style={[styles.drawer, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={styles.headerTitle}>Notifications</Text>
              {unreadCount > 0 && (
                <View style={styles.newBadge}>
                  <Text style={styles.newBadgeText}>{unreadCount} new</Text>
                </View>
              )}
            </View>

            <View style={styles.headerActions}>
              {unreadCount > 0 && (
                <TouchableOpacity
                  onPress={() => markAllAsRead()}
                  style={styles.markAllButton}
                  activeOpacity={0.7}
                >
                  <Ionicons name="checkmark-done" size={16} color="#0B5B31" />
                  <Text style={styles.markAllText}>Mark all</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => setIsDrawerOpen(false)}
                style={styles.closeButton}
                activeOpacity={0.7}
              >
                <Feather name="x" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Category Tabs */}
          <View style={styles.tabsWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContainer}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setFilterCategory(cat.id)}
                  style={[
                    styles.tabButton,
                    filterCategory === cat.id && styles.tabButtonActive,
                  ]}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.tabText,
                      filterCategory === cat.id && styles.tabTextActive,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Notifications List */}
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#0B5B31" />
                <Text style={styles.loadingText}>Loading alerts...</Text>
              </View>
            ) : filteredNotifications.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Feather name="bell" size={26} color="#9CA3AF" />
                </View>
                <Text style={styles.emptyTitle}>All caught up!</Text>
                <Text style={styles.emptySubtitle}>
                  No notifications matching this category.
                </Text>
              </View>
            ) : (
              filteredNotifications.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => handleNotificationPress(item)}
                  activeOpacity={0.8}
                  style={[
                    styles.notificationCard,
                    !item.read && styles.unreadCard,
                  ]}
                >
                  <View style={styles.iconCircle}>
                    {getCategoryIcon(item.type)}
                  </View>

                  <View style={styles.contentCol}>
                    <View style={styles.cardHeader}>
                      <Text
                        style={[
                          styles.cardTitle,
                          !item.read && styles.unreadTitle,
                        ]}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                      <Text style={styles.timestampText}>
                        {formatRelativeTime(item.created_at)}
                      </Text>
                    </View>

                    <Text style={styles.cardMessage} numberOfLines={2}>
                      {item.message}
                    </Text>

                    {(item.metadata?.action_url || item.metadata?.target_screen) && (
                      <View style={styles.actionRow}>
                        <Text style={styles.actionText}>View details</Text>
                        <Feather name="arrow-up-right" size={12} color="#0B5B31" />
                      </View>
                    )}
                  </View>

                  {!item.read && (
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        markAsRead(item.id);
                      }}
                      style={styles.singleCheckButton}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Feather name="check" size={16} color="#9CA3AF" />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>

          {/* Footer Status */}
          <View style={styles.footer}>
            <View style={styles.statusDotRow}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: connected ? '#10B981' : '#F59E0B' },
                ]}
              />
              <Text style={styles.footerStatusText}>
                {connected ? 'Live Sync Active' : 'Offline'}
              </Text>
            </View>
            <Text style={styles.footerBrand}>SahYogi Enterprise</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  drawer: {
    width: Math.min(width * 0.88, 380),
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 16,
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  newBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  markAllText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0B5B31',
  },
  closeButton: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
  },
  tabsWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#FAFAFA',
  },
  tabsContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  tabButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tabButtonActive: {
    backgroundColor: '#0B5B31',
    borderColor: '#0B5B31',
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 12,
    paddingBottom: 20,
    gap: 10,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#6B7280',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 4,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 10,
  },
  unreadCard: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  contentCol: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
    marginRight: 6,
  },
  unreadTitle: {
    fontWeight: '800',
    color: '#111827',
  },
  timestampText: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  cardMessage: {
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 16,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 6,
  },
  actionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0B5B31',
  },
  singleCheckButton: {
    padding: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#FAFAFA',
  },
  statusDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  footerStatusText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  footerBrand: {
    fontSize: 10,
    color: '#9CA3AF',
  },
});
