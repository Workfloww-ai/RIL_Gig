import { create } from 'zustand';

interface AuthState {
  token: string | null;
  userId: string | null;
  setToken: (token: string) => void;
  setUserId: (id: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  userId: null,
  setToken: (token) => set({ token }),
  setUserId: (id) => set({ userId: id }),
  logout: () => set({ token: null, userId: null }),
}));
