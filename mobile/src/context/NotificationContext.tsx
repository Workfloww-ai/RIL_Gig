import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { apiClient, API_URL } from '../api/client';
import { useAuthStore } from '../store/authStore';

export interface NotificationItem {
  id: string;
  user_id?: string;
  company_id?: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  read_at?: string | null;
  metadata?: Record<string, any>;
  created_at: string;
}

interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  connected: boolean;
  isDrawerOpen: boolean;
  setIsDrawerOpen: (open: boolean) => void;
  filterCategory: string;
  setFilterCategory: (category: string) => void;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const getWebSocketUrl = (token: string | null) => {
  const base = API_URL || 'http://localhost:8000';
  const cleanBase = base.replace(/\/+$/, '').replace(/\/api$/, '');
  const wsProto = cleanBase.startsWith('https') ? 'wss:' : 'ws:';
  const host = cleanBase.replace(/^https?:\/\//, '');
  const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
  return `${wsProto}//${host}/api/notifications/ws${tokenParam}`;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuthStore();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [connected, setConnected] = useState<boolean>(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const backoffRef = useRef<number>(1000);

  const refreshUnreadCount = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiClient.get('/notifications/unread-count');
      if (typeof res.data?.unread_count === 'number') {
        setUnreadCount(res.data.unread_count);
      }
    } catch {
      // Quiet fail if network offline
    }
  }, [token]);

  const refreshNotifications = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await apiClient.get('/notifications', {
        params: {
          limit: 50,
          category: filterCategory,
        },
      });
      if (res.data?.notifications) {
        setNotifications(res.data.notifications);
      }
      if (typeof res.data?.unread_count === 'number') {
        setUnreadCount(res.data.unread_count);
      }
    } catch {
      // Quiet fail
    } finally {
      setLoading(false);
    }
  }, [token, filterCategory]);

  const markAsRead = async (id: string) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true, read_at: new Date().toISOString() } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await apiClient.put(`/notifications/${id}/read`);
    } catch {
      refreshNotifications();
    }
  };

  const markAllAsRead = async () => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read: true, read_at: new Date().toISOString() }))
    );
    setUnreadCount(0);

    try {
      await apiClient.put('/notifications/read-all');
    } catch {
      refreshNotifications();
    }
  };

  // WebSocket Connection with Exponential Backoff
  const connectWebSocket = useCallback(() => {
    if (!token) return;

    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const wsUrl = getWebSocketUrl(token);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        backoffRef.current = 1000;
        ws.send(JSON.stringify({ type: 'auth', token }));
      };

      ws.onmessage = (event) => {
        try {
          if (event.data === 'pong' || event.data === '{"type":"pong"}') {
            return;
          }
          const raw = JSON.parse(event.data);

          let newNotif: NotificationItem | null = null;
          if (raw.event === 'new_notification' && raw.data) {
            newNotif = raw.data;
          } else if (raw.id && raw.title) {
            newNotif = raw;
          }

          if (newNotif) {
            // Deduplicate by ID
            setNotifications((prev) => {
              if (prev.some((item) => item.id === newNotif!.id)) {
                return prev;
              }
              return [newNotif!, ...prev];
            });
            setUnreadCount((prev) => prev + 1);
          }
        } catch {
          // ignore non-json
        }
      };

      ws.onclose = (event) => {
        setConnected(false);
        wsRef.current = null;
        if (event.code !== 1008) {
          const delay = Math.min(backoffRef.current, 30000);
          backoffRef.current = backoffRef.current * 1.5;
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, delay);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      // ws error
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      connectWebSocket();
      refreshNotifications();
      refreshUnreadCount();
    } else {
      setNotifications([]);
      setUnreadCount(0);
      setConnected(false);
      if (wsRef.current) wsRef.current.close();
    }

    const pingInterval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 25000);

    return () => {
      clearInterval(pingInterval);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [token, connectWebSocket, refreshNotifications, refreshUnreadCount]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        connected,
        isDrawerOpen,
        setIsDrawerOpen,
        filterCategory,
        setFilterCategory,
        markAsRead,
        markAllAsRead,
        refreshNotifications,
        refreshUnreadCount,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
