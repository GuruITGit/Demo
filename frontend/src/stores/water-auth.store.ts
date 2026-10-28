'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface WaterUser {
  id: string;
  username: string;
  fullName: string;
  phone?: string;
  organizationId: string;
  role: 'admin' | 'reader' | 'cashier' | 'viewer';
  caps: string[];
}

interface WaterAuthState {
  user: WaterUser | null;
  token: string | null;
  isAuthenticated: boolean;
  _hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;
  setAuth: (user: WaterUser, token: string) => void;
  clearAuth: () => void;
  hasCap: (cap: string) => boolean;
}

/** สโตร์ล็อกอินของระบบประปา — แยกจาก useAuthStore (สารบรรณ) โดยสิ้นเชิง */
export const useWaterAuthStore = create<WaterAuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      _hasHydrated: false,
      setHasHydrated: (v) => set({ _hasHydrated: v }),

      setAuth: (user, token) => {
        if (typeof window !== 'undefined') localStorage.setItem('water_access_token', token);
        set({ user, token, isAuthenticated: true });
      },
      clearAuth: () => {
        if (typeof window !== 'undefined') localStorage.removeItem('water_access_token');
        set({ user: null, token: null, isAuthenticated: false });
      },
      hasCap: (cap) => {
        const { user } = get();
        if (!user) return false;
        return user.role === 'admin' || (user.caps || []).includes(cap);
      },
    }),
    {
      name: 'water-auth',
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
);

export const waterLogout = () => useWaterAuthStore.getState().clearAuth();
