'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

/**
 * คีย์โมดูลที่หน่วยงานของผู้ใช้ปัจจุบัน "ปิดใช้งาน" ไว้ (feature flags ต่อ อบต.)
 * ใช้ซ่อนเมนู/บล็อกหน้าให้ตรงกับที่ backend บล็อก API — SUPER_ADMIN ตั้งค่าที่ /admin/tenants
 */
export function useDisabledModules(): string[] {
  const isAuthed = useAuthStore((s) => !!s.user);
  const { data } = useQuery<string[]>({
    queryKey: ['current-modules'],
    queryFn: () => api.get('/organizations/current/modules').then((r) => r.data.data?.disabledModules || []),
    enabled: isAuthed,
    staleTime: 60_000,
  });
  return data || [];
}
