import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('finance_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Enterprise-grade error handling interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      if (typeof window !== 'undefined') {
        // Clear invalid or expired token
        localStorage.removeItem('finance_token');
        // Automatically redirect to login if not already there
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export const sendOtp = (mobile_number: string) => {
  return api.post('/api/auth/send-otp', { mobile_number });
};

export const verifyOtp = (mobile_number: string, otp: string) => {
  return api.post('/api/auth/verify-otp', { mobile_number, otp });
};

export const getDashboardStats = () => {
  return api.get('/api/finance/dashboard-stats');
};

export const getPendingPayments = (params?: Record<string, string | number>) => {
  return api.get('/api/finance/pending-payments', { params });
};

export const processPayment = (paymentId: string, data: { transaction_reference: string; remarks?: string }) => {
  return api.post(`/api/finance/process-payment/${paymentId}`, data);
};

export const getPaymentHistory = (params?: Record<string, string | number>) => {
  return api.get('/api/finance/payment-history', { params });
};

export const getCurrentUser = () => {
  return api.get('/api/auth/me');
};

export default api;
