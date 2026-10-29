'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/api';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  fullNameTh: string;
  fullNameEn?: string;
  titleTh?: string;
  avatarUrl?: string;
  organizationId: string;
  departmentId?: string;
  positionName?: string;
  roles: string[];
  permissions: string[];
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  _hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string | string[]) => boolean;
  isAdmin: () => boolean;
  /**
   * แก้ไข/ลบรายการนี้ได้หรือไม่
   * = admin หรือ เป็นผู้สร้าง (createdBy === user.id) หรือ มี permission ที่กำหนด
   */
  canModify: (record?: { createdBy?: string | null } | null, permission?: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      _hasHydrated: false,
      setHasHydrated: (v) => set({ _hasHydrated: v }),

      setAuth: (user, accessToken, refreshToken) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('access_token', accessToken);
          localStorage.setItem('refresh_token', refreshToken);
        }
        set({ user, accessToken, refreshToken, isAuthenticated: true });
      },

      clearAuth: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
        }
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      },

      hasPermission: (permission) => {
        const { user } = get();
        if (!user) return false;
        if (user.roles.includes('SUPER_ADMIN')) return true;
        return user.permissions.includes(permission);
      },

      hasRole: (role) => {
        const { user } = get();
        if (!user) return false;
        const roles = Array.isArray(role) ? role : [role];
        return roles.some((r) => user.roles.includes(r));
      },

      isAdmin: () => {
        const { user } = get();
        if (!user) return false;
        return user.roles.some((r) => r === 'SUPER_ADMIN' || r === 'ADMIN');
      },

      canModify: (record, permission) => {
        const { user } = get();
        if (!user) return false;
        if (user.roles.some((r) => r === 'SUPER_ADMIN' || r === 'ADMIN')) return true;
        if (record?.createdBy && record.createdBy === user.id) return true;
        if (permission && user.permissions.includes(permission)) return true;
        return false;
      },
    }),
    {
      name: 'smartgov-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

export async function loginAction(username: string, password: string) {
  const { data } = await api.post('/auth/login', { username, password });
  const { user, accessToken, refreshToken } = data.data;
  useAuthStore.getState().setAuth(user, accessToken, refreshToken);
  return user;
}

/**
 * เข้าสู่คอนโซลเจ้าของระบบ (/hub) — คนละประตูกับเว็บของ อบต.
 * backend รับเฉพาะบัญชีที่มีบทบาท SUPER_ADMIN และไม่ผูกกับ อบต. ใด (ไม่ต้องกรอกรหัสองค์กร)
 */
export async function hubLoginAction(username: string, password: string) {
  const { data } = await api.post('/auth/hub-login', { username, password });
  const { user, accessToken, refreshToken } = data.data;
  useAuthStore.getState().setAuth(user, accessToken, refreshToken);
  return user;
}

export async function logoutAction() {
  try {
    // timeout สั้น: เซิร์ฟเวอร์ช้า/ล่ม ต้องไม่ทำให้ปุ่มออกจากระบบค้าง (ล้างเซสชันในเครื่องต่อเสมอ)
    await api.post('/auth/logout', undefined, { timeout: 5000 });
  } catch {}
  useAuthStore.getState().clearAuth();
}
