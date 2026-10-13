import axios from 'axios';

// Get base URL: Fallback to production backend if not specified
const getBaseUrl = () => {
  const url = process.env.NEXT_PUBLIC_API_URL || 'https://sahyogi-backend-540529464663.asia-south2.run.app';
  // Strip trailing slashes and /api so /api/auth/... calls don't become /api/api/auth/...
  return url.replace(/\/+$/, '').replace(/\/api$/, '');
};

const api = axios.create({
  baseURL: getBaseUrl(),
});

api.interceptors.request.use((config) => {
  // Normalize request URLs so they always start with /api
  if (config.url) {
    if (config.url.startsWith('/') && !config.url.startsWith('/api')) {
      config.url = `/api${config.url}`;
    } else if (!config.url.startsWith('/') && !config.url.startsWith('api/')) {
      config.url = `/api/${config.url}`;
    }
  }

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
        const url = error.config?.url || '';
        const isAuthEndpoint = url.includes('/login-password') ||
                               url.includes('/forgot-password') ||
                               url.includes('/reset-password');

        // Only redirect to login for protected resources, NOT public auth forms
        if (!isAuthEndpoint) {
          localStorage.removeItem('finance_token');
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
      }
    }
    return Promise.reject(error);
  }
);

export const checkMobile = (mobile_number: string) => {
  return api.post('/api/auth/check-mobile', { mobile_number });
};

export const sendOtp = (mobile_number: string) => {
  return api.post('/api/auth/send-otp', { mobile_number });
};

export const verifyOtp = (mobile_number: string, otp: string) => {
  return api.post('/api/auth/verify-otp', { mobile_number, otp });
};

export const loginWithPassword = (identifier: string, password: string) => {
  return api.post('/api/auth/login-password', { identifier, password });
};

export const forgotPassword = (identifier: string) => {
  return api.post('/api/auth/forgot-password', { identifier });
};

export const resetPassword = (token: string, new_password: string) => {
  return api.post('/api/auth/reset-password', { token, new_password });
};

export const changePassword = (current_password: string, new_password: string) => {
  return api.post('/api/auth/change-password', { current_password, new_password });
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
