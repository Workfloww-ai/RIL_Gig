import axios from 'axios';
import { useAuthStore } from '../store/authStore';

// Update this to your machine's local IP (e.g., 192.168.1.5) if testing on a physical device.
// 10.0.2.2 works for Android Emulator. localhost works for iOS Simulator.
// Using the new localtunnel address
// If the env variable already has /api, strip it so the interceptor can handle it
export const API_URL = process.env.EXPO_PUBLIC_API_URL?.endsWith('/api') 
  ? process.env.EXPO_PUBLIC_API_URL.replace(/\/api$/, '') 
  : process.env.EXPO_PUBLIC_API_URL;

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Bypass-Tunnel-Reminder': 'true' // Required to bypass localtunnel interstitial page
  }
});

// Add a request interceptor to automatically attach the JWT token
apiClient.interceptors.request.use(
  (config) => {
    // Automatically prepend /api if it's missing
    if (config.url) {
      if (config.url.startsWith('/') && !config.url.startsWith('/api')) {
        config.url = `/api${config.url}`;
      } else if (!config.url.startsWith('/') && !config.url.startsWith('api/')) {
        config.url = `/api/${config.url}`;
      }
    }

    const token = useAuthStore.getState().token;
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
        const { refreshToken, setToken, logout } = useAuthStore.getState();
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
      // Modify the error so frontend components can easily extract the detail string
      error.response = {
        data: {
          detail: 'Poor network connection. Please check your signal and try again.',
        },
      };
    }
    return Promise.reject(error);
  }
);
