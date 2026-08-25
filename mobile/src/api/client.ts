import axios from 'axios';
import { useAuthStore } from '../store/authStore';

// Update this to your machine's local IP (e.g., 192.168.1.5) if testing on a physical device.
// 10.0.2.2 works for Android Emulator. localhost works for iOS Simulator.
export const API_URL = 'http://192.168.0.142:8000/api';  

export const apiClient = axios.create({
  baseURL: API_URL,
});

// Add a request interceptor to automatically attach the JWT token
apiClient.interceptors.request.use(
  (config) => {
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
