import axios from 'axios';
import { useAuthStore } from '../store/authStore';

// Update this to your machine's local IP (e.g., 192.168.1.5) if testing on a physical device.
// 10.0.2.2 works for Android Emulator. localhost works for iOS Simulator.
// Using the new localtunnel address
export const API_URL = process.env.EXPO_PUBLIC_API_URL;

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Bypass-Tunnel-Reminder': 'true' // Required to bypass localtunnel interstitial page
  }
});

// Add a request interceptor to automatically attach the JWT token
apiClient.interceptors.request.use(
  (config) => {
    // URL prefixing is handled by the baseURL configuration

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

// Add a response interceptor to handle network errors globally
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
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
