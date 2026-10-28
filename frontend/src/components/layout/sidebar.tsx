'use client';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { useDisabledModules } from '@/hooks/use-modules';
import { MODULES, NAV_GROUP_ORDER } from '@/lib/modules';

// เมนูซ้ายสร้างจากทะเบียนโมดูลกลาง (lib/modules.ts) — เพิ่มโมดูลใหม่ที่นั่นแล้วเมนูขึ้นเอง
const NAV_ITEMS = MODULES.filter((m) => m.navGroup);

// เวลาที่เจ้าหน้าที่เปิดหน้าเรื่องแจ้ง/ร้องเรียนครั้งล่าสุด — เก็บต่อผู้ใช้ในเบราว์เซอร์นี้ (เลขบนเมนูนับเรื่องที่เข้ามาหลังเวลานี้)
const seenKey = (uid?: string) => `citizen-reports-seen:${uid || 'anon'}`;
const seenMem = new Map<string, string>();   // สำรองไว้ถ้า localStorage ใช้ไม่ได้ (โหมดส่วนตัว)
const seenListeners = new Set<() => void>();
const subscribeSeen = (cb: () => void) => {
  seenListeners.add(cb);
  window.addEventListener('storage', cb);   // แท็บอื่นเปิดดูแล้ว แท็บนี้ก็หาย
  return () => { seenListeners.delete(cb); window.removeEventListener('storage', cb); };
};
const readSeen = (uid?: string): string | null => {
  try { return localStorage.getItem(seenKey(uid)) ?? seenMem.get(seenKey(uid)) ?? null; } catch { return seenMem.get(seenKey(uid)) ?? null; }
};
const writeSeen = (uid: string | undefined, iso: string) => {
  seenMem.set(seenKey(uid), iso);
  try { localStorage.setItem(seenKey(uid), iso); } catch { /* ข้าม */ }
  seenListeners.forEach((f) => f());
};

export function Sidebar({ mobileOpen = false, onClose }: { mobileOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const disabled = useDisabledModules();

  const visible = NAV_ITEMS.filter((i) =>
    (!i.permission || hasPermission(i.permission)) && !disabled.includes(i.key));

  // ตัวเลขเรื่องแจ้ง/ร้องเรียนที่เข้ามาใหม่ตั้งแต่เปิดหน้านั้นครั้งล่าสุด — เปิดหน้าแล้วหาย จนกว่าจะมีเรื่องใหม่เข้ามา
  // ดึงเฉพาะคนที่เห็นเมนูนี้ + รีเฟรชทุก 1 นาที · queryKey ขึ้นต้น 'citizen-reports' เหมือนหน้ารายการ
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const showReportCount = visible.some((i) => i.key === 'citizen-reports');
  const onReportsPage = pathname.startsWith('/citizen-reports');
  // undefined = ยังไม่ได้อ่านค่า (ฝั่งเซิร์ฟเวอร์/ก่อน hydrate) · null = ไม่เคยเปิดหน้านี้
  const seenAt = useSyncExternalStore<string | null | undefined>(subscribeSeen, () => readSeen(userId), () => undefined);

  // จำว่า "ดูแล้ว" ด้วยเวลาของเซิร์ฟเวอร์ (ไม่พึ่งนาฬิกาเครื่อง)
  const markSeen = useCallback(async () => {
    try {
      const { data } = await api.get('/citizen-reports/count');
      writeSeen(userId, data.data.now as string);
    } catch { /* ข้าม — ป้ายแค่ยังไม่หาย */ }
  }, [userId]);
  useEffect(() => { if (showReportCount && onReportsPage) void markSeen(); }, [showReportCount, onReportsPage, markSeen]);

  const { data: reportCount } = useQuery({
    queryKey: ['citizen-reports', 'count', seenAt],
    queryFn: async () => (await api.get('/citizen-reports/count', { params: { since: seenAt || undefined } })).data.data as
      { unseen: number; new: number; today: number },
    enabled: showReportCount && seenAt !== undefined,
    refetchInterval: 60_000,
  });
  // คิว "รอฉันเซ็น" (ผอ.กอง/ปลัด/นายก/admin) — queryKey เดียวกับหน้า /citizen-reports อนุมัติแล้วป้ายอัปเดตตาม
  const { data: myQueue } = useQuery({
    queryKey: ['citizen-reports-my-queue'],
    queryFn: async () => (await api.get('/citizen-reports/my-queue')).data.data as unknown[],
    enabled: showReportCount,
    refetchInterval: 60_000,
  });
  const queueCount = myQueue?.length || 0;

  const groups = NAV_GROUP_ORDER
    .map((g) => ({ name: g, items: visible.filter((i) => i.navGroup === g) }))
    .filter((g) => g.items.length > 0);

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

  const nav = (
    <nav className="space-y-4">
      {groups.map((g) => (
        <div key={g.name}>
          <p className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{g.name}</p>
          <div className="space-y-0.5">
            {g.items.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    onClose?.();
                    // กดเมนูซ้ำตอนอยู่หน้านั้นอยู่แล้ว → ถือว่าดูแล้ว + โหลดรายการใหม่
                    if (item.key === 'citizen-reports') { void markSeen(); qc.invalidateQueries({ queryKey: ['citizen-reports'] }); }
                  }}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                    active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                  )}
                >
                  <item.icon className={cn('h-4 w-4 shrink-0', item.color)} aria-hidden />
                  <span className="truncate flex-1">{item.label}</span>
                  {item.badge && (
                    <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full shrink-0">{item.badge}</span>
                  )}
                  {item.key === 'citizen-reports' && !!reportCount?.unseen && (
                    <span
                      className="min-w-5 text-center text-[11px] font-semibold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full shrink-0"
                      title={`เรื่องใหม่ ${reportCount.unseen} เรื่อง · รอจัดการทั้งหมด ${reportCount.new} · เข้ามาวันนี้ ${reportCount.today}`}
                      aria-label={`มีเรื่องแจ้งใหม่ ${reportCount.unseen} เรื่อง`}
                    >
                      {reportCount.unseen > 99 ? '99+' : reportCount.unseen}
                    </span>
                  )}
                  {item.key === 'citizen-reports' && queueCount > 0 && (
                    <span
                      className="min-w-5 text-center text-[11px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full shrink-0"
                      title={`รอคุณเซ็น ${queueCount} เรื่อง`}
                      aria-label={`มีเรื่องรอคุณเซ็น ${queueCount} เรื่อง`}
                    >
                      {queueCount > 99 ? '99+' : queueCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* เดสก์ท็อป: เมนูข้างคงที่ */}
      <aside className="no-print hidden lg:block w-60 shrink-0 overflow-y-auto bg-white border-r border-gray-100 py-3 px-3" aria-label="เมนูหลัก">
        {nav}
      </aside>

      {/* มือถือ/แท็บเล็ต: ลิ้นชักเลื่อนเข้า (drawer) */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="เมนูหลัก">
          <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
          <aside className="absolute left-0 top-0 h-full w-72 max-w-[82%] bg-white shadow-xl overflow-y-auto py-3 px-3">
            {nav}
          </aside>
        </div>
      )}
    </>
  );
}
