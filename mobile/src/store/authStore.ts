import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  userId: string | null;
  role: string | null;
  selectedOrganizationId: string | null;
  setToken: (token: string) => void;
  setRefreshToken: (token: string) => void;
  setUserId: (id: string) => void;
  setRole: (role: string) => void;
  setSelectedOrganizationId: (id: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      userId: null,
      role: null,
      selectedOrganizationId: null,
      setToken: (token) => set({ token }),
      setRefreshToken: (token) => set({ refreshToken: token }),
      setUserId: (id) => set({ userId: id }),
      setRole: (role) => set({ role }),
      setSelectedOrganizationId: (id) => set({ selectedOrganizationId: id }),
      logout: () => set({ token: null, refreshToken: null, userId: null, role: null, selectedOrganizationId: null }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
