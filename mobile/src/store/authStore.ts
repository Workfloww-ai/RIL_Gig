import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';

/**
 * PERSISTENT AUTH STORE
 *
 * Design Decision:
 * ─────────────────────────────────────────────────────────────────────
 * Tokens are stored in expo-secure-store (device keychain) via Zustand persist.
 *
 * Behavior:
 *  ✅ App backgrounded (home button / task switch) → stays logged in.
 *  ✅ App killed from Recents → stays logged in (SecureStore rehydrates on next open).
 *  ✅ Device rebooted / app opened after days → stays logged in.
 *  ✅ Only a manual logout() call (profile page) clears the session.
 *
 * Token lifecycle:
 *  → Access token expires in 30 mins (short-lived for security).
 *  → On 401, the axios interceptor silently swaps it using the refresh token.
 *  → Refresh token expires in 7 days. After 7 days of zero API activity the
 *    user must re-login — this is the only automatic session expiry.
 * ─────────────────────────────────────────────────────────────────────
 */

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  userId: string | null;
  role: string | null;
  selectedOrganizationId: string | null;
  _hasHydrated: boolean;

  setToken: (token: string) => void;
  setRefreshToken: (token: string) => void;
  setUserId: (id: string) => void;
  setRole: (role: string) => void;
  setSelectedOrganizationId: (id: string | null) => void;
  setHasHydrated: (state: boolean) => void;
  logout: () => void;
}

// Custom SecureStore adapter for Zustand persist
const secureStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return await SecureStore.getItemAsync(name);
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await SecureStore.setItemAsync(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await SecureStore.deleteItemAsync(name);
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      userId: null,
      role: null,
      selectedOrganizationId: null,
      _hasHydrated: false,

      setToken: (token) => set({ token }),
      setRefreshToken: (token) => set({ refreshToken: token }),
      setUserId: (id) => set({ userId: id }),
      setRole: (role) => set({ role }),
      setSelectedOrganizationId: (id) => set({ selectedOrganizationId: id }),
      setHasHydrated: (state) => set({ _hasHydrated: state }),

      logout: () =>
        set({
          token: null,
          refreshToken: null,
          userId: null,
          role: null,
          selectedOrganizationId: null,
        }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => secureStorage),
      // Only persist auth data, not UI-only flags
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        userId: state.userId,
        role: state.role,
        selectedOrganizationId: state.selectedOrganizationId,
      }),
      onRehydrateStorage: () => (state) => {
        // Mark store as hydrated once SecureStore finishes loading
        state?.setHasHydrated(true);
      },
    }
  )
);
