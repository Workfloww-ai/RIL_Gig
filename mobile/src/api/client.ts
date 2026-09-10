import axios from 'axios';
import { useAuthStore } from '../store/authStore';

// Read the API URL from your mobile/.env file
// It will fallback to localhost (for iOS simulator) if the env variable is missing
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api';

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
