'use client';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

type Kind = 'market' | 'waste';
const keyOf = (k: Kind, uid?: string) => `pay-seen:${k}:${uid || 'anon'}`;
const mem = new Map<string, string>(); // สำรองถ้า localStorage ใช้ไม่ได้
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => { listeners.add(cb); window.addEventListener('storage', cb); return () => { listeners.delete(cb); window.removeEventListener('storage', cb); }; };
const read = (key: string): string | null => { try { return localStorage.getItem(key) ?? mem.get(key) ?? null; } catch { return mem.get(key) ?? null; } };
const write = (key: string, iso: string) => { mem.set(key, iso); try { localStorage.setItem(key, iso); } catch { /* ข้าม */ } listeners.forEach((f) => f()); };

/**
 * จำนวนรายการ "ชำระแล้ว" ใหม่ที่เจ้าหน้าที่ยังไม่ได้เปิดดู (ป้ายแดงที่แท็บ + เมนูซ้าย)
 * นับจากเวลาที่เปิดแท็บ "ชำระแล้ว" ครั้งล่าสุด (เก็บต่อบัญชีในเครื่อง) · ครั้งแรกใช้เวลาตอนนี้เป็นจุดเริ่ม
 */
export function usePaySeen(kind: Kind, enabled = true) {
  const uid = useAuthStore((s) => s.user?.id);
  const key = keyOf(kind, uid);
  const seen = useSyncExternalStore<string | null | undefined>(subscribe, () => read(key), () => undefined);
  const { data } = useQuery<{ paidAt?: string | null }[]>({
    queryKey: [kind, 'bills', 'paid-unseen'],
    queryFn: async () => (await api.get(`/${kind}/bills`, { params: { status: 'paid' } })).data.data,
    enabled,
    refetchInterval: 15_000,
  });
  const markSeen = useCallback(() => write(key, new Date().toISOString()), [key]);
  useEffect(() => { if (seen === null && data) markSeen(); }, [seen, data, markSeen]); // ครั้งแรก: ตั้งจุดเริ่ม ไม่นับของเก่า
  const since = seen ? Date.parse(seen) : Infinity;
  const unseenPaid = seen === undefined || seen === null ? 0 : (data ?? []).filter((b) => b.paidAt && Date.parse(b.paidAt) > since).length;
  return { unseenPaid, markSeen };
}
