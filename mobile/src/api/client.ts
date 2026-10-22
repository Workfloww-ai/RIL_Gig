import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { NativeModules } from 'react-native';

const CURRENT_MAC_IP = '10.5.62.248';

const getBaseApiUrl = () => {
  let envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl?.endsWith('/api')) {
    envUrl = envUrl.replace(/\/api$/, '');
  }

  // In development, prioritize the real Mac IP so requests don't hit outdated/cached IPs
  if (__DEV__) {
    return `http://${CURRENT_MAC_IP}:8000`;
  }

  return envUrl || `http://${CURRENT_MAC_IP}:8000`;
};

export const API_URL = getBaseApiUrl();

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 10000, // 10s timeout so requests never hang indefinitely
  headers: {
    'Bypass-Tunnel-Reminder': 'true' // Required to bypass localtunnel interstitial page
  }
});

// Add a request interceptor to automatically attach the JWT token
apiClient.interceptors.request.use(
  async (config) => {
    // Automatically prepend /api if it's missing
    if (config.url) {
      if (config.url.startsWith('/') && !config.url.startsWith('/api')) {
        config.url = `/api${config.url}`;
      } else if (!config.url.startsWith('/') && !config.url.startsWith('api/')) {
        config.url = `/api/${config.url}`;
      }
    }

    console.log(`[Network] ${config.method?.toUpperCase()} ${config.baseURL || ''}${config.url}`);

    let token = useAuthStore.getState().token;

    // Headless background tasks (like background location) might run before Zustand is hydrated from storage
    if (!token) {
      try {
        const raw = await SecureStore.getItemAsync('auth-storage');
        if (raw) {
          const parsed = JSON.parse(raw);
          token = parsed?.state?.token;
          if (token) {
            useAuthStore.getState().setToken(token);
            if (parsed?.state?.refreshToken) {
              useAuthStore.getState().setRefreshToken(parsed.state.refreshToken);
            }
            if (parsed?.state?.userId) {
              useAuthStore.getState().setUserId(parsed.state.userId);
            }
          }
        }
      } catch (err) {
        console.warn('[Network] SecureStore fallback error:', err);
      }
    }

    if (token) {
      console.log(`[Network] Attaching JWT Token to ${config.url}`);
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      console.log(`[Network] No token found for ${config.url}`);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Flag and queue to handle concurrent requests during token refresh
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (error: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

// Add a response interceptor to handle network errors globally
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Handle 401 Unauthorized errors for token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue this request while refresh is happening
        return new Promise(function(resolve, reject) {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(apiClient(originalRequest));
            },
            reject: (err: any) => {
              reject(err);
            }
          });
        });
      }
      
      originalRequest._retry = true;
      isRefreshing = true;
      
      try {
        let { refreshToken } = useAuthStore.getState();
        const { setToken, logout } = useAuthStore.getState();

        if (!refreshToken) {
          try {
            const raw = await SecureStore.getItemAsync('auth-storage');
            if (raw) {
              const parsed = JSON.parse(raw);
              refreshToken = parsed?.state?.refreshToken;
            }
          } catch (_) {}
        }

        console.log("[Interceptor] 401 caught. Refresh Token in store:", refreshToken ? "EXISTS" : "MISSING");
        
        if (!refreshToken) {
          console.warn("[Interceptor] No refresh token found, logging out.");
          logout();
          return Promise.reject(error);
        }
        
        console.log(`[Interceptor] Attempting to refresh token at ${API_URL}/api/auth/refresh`);
        // Use a new axios instance or raw fetch to avoid interceptor loops
        const refreshResponse = await axios.post(`${API_URL}/api/auth/refresh`, {
          refresh_token: refreshToken
        }, {
          headers: {
            'Content-Type': 'application/json',
            'Bypass-Tunnel-Reminder': 'true'
          }
        });
        
        console.log("[Interceptor] Refresh response status:", refreshResponse.data?.status);
        if (refreshResponse.data?.status === 'success' && refreshResponse.data?.token) {
          console.log("[Interceptor] Successfully refreshed token!");
          const newToken = refreshResponse.data.token;
          
          // Update store
          setToken(newToken);
          
          // Resolve queued requests with new token
          processQueue(null, newToken);
          
          // Update original request headers
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          
          isRefreshing = false;
          // Retry the original request
          return apiClient(originalRequest);
        } else {
          console.error("[Interceptor] Refresh API returned failure status, logging out.");
          processQueue(error, null);
          logout();
          isRefreshing = false;
          return Promise.reject(error);
        }
      } catch (refreshError: any) {
        console.error("[Interceptor] Network or Server Error during refresh:", refreshError?.response?.data || refreshError.message);
        processQueue(refreshError, null);
        useAuthStore.getState().logout();
        isRefreshing = false;
        return Promise.reject(refreshError);
      }
    }
    
    if (!error.response && (error.code === 'ECONNABORTED' || error.message === 'Network Error' || error.message.includes('Network'))) {
      if (originalRequest && !originalRequest._fallbackTried) {
        originalRequest._fallbackTried = true;
        const currentBase = originalRequest.baseURL || API_URL || '';
        const fallbackBase = currentBase.includes('localhost') ? `http://${CURRENT_MAC_IP}:8000` : 'http://localhost:8000';
        console.log(`[Network Interceptor] Retrying with fallback: ${fallbackBase}${originalRequest.url}`);
        originalRequest.baseURL = fallbackBase;
        return apiClient(originalRequest);
      }

      console.error(`[Network Error] Failed URL: ${error.config?.baseURL || ''}${error.config?.url} | Reason: ${error.message} (${error.code || 'NO_CODE'})`);
      error.response = {
        data: {
          detail: 'Poor network connection. Please check your signal and try again.',
        },
      };
    }
    return Promise.reject(error);
  }
);
