'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/water-api';
import { useWaterAuthStore } from '@/stores/water-auth.store';
import { useAccessibility } from '@/contexts/accessibility.context';
import { LogOut, Home, Menu, X, Sun, Moon } from 'lucide-react';
import { PRAPA_NAV as NAV } from './nav';

/**
 * เว็บประปา (/prapa) — เปลือก client ของ layout (metadata/ไอคอนแท็บอยู่ที่ layout.tsx): แถบบน + sidebar จัดกลุ่ม (desktop) / drawer (มือถือ)
 * auth/สิทธิ์แยกของประปาเอง (water-auth.store) · เมนูโชว์ตาม capability ของผู้ใช้
 */
/** ชื่อย่อหน่วยงานสำหรับจอแคบ — 'องค์การบริหารส่วนตำบลลำนางรอง' → 'อบต.ลำนางรอง' */
const shortOrgName = (n: string) => n
  .replace(/^องค์การบริหารส่วนตำบล\s*/, 'อบต.').replace(/^องค์การบริหารส่วนจังหวัด\s*/, 'อบจ.')
  .replace(/^เทศบาลตำบล\s*/, 'ทต.').replace(/^เทศบาลเมือง\s*/, 'ทม.').replace(/^เทศบาลนคร\s*/, 'ทน.');

export default function PrapaShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuth = useWaterAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useWaterAuthStore((s) => s._hasHydrated);
  const user = useWaterAuthStore((s) => s.user);
  const clearAuth = useWaterAuthStore((s) => s.clearAuth);
  const { mode, setMode } = useAccessibility();
  const canWater = !!user;
  const can = (caps: string[]) => user?.role === 'admin' || caps.some((c) => (user?.caps || []).includes(c));
  const isLogin = pathname === '/prapa/login';
  const isBare = pathname === '/prapa/display'; // จอลูกค้า — เต็มจอ ไม่มี sidebar/แถบบน
  const [drawer, setDrawer] = useState(false);
  // ชื่อ + โลโก้ อบต. โชว์กลางแถบบน (เหมือนระบบหลัก) — ดึงด้วย token ประปา
  const { data: org } = useQuery({
    queryKey: ['prapa-org', user?.organizationId],
    queryFn: async () => (await api.get('/water/auth/org')).data.data as { nameTh?: string; logoUrl?: string | null },
    enabled: isAuth && !!user?.organizationId,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (hasHydrated && !isLogin && !isAuth) router.replace('/prapa/login');
  }, [hasHydrated, isLogin, isAuth, router]);
  useEffect(() => { setDrawer(false); }, [pathname]);
  // service worker — ให้แอปเปิด/จดมิเตอร์ได้แม้สัญญาณหลุด (ลงทะเบียนเมื่ออยู่ /prapa เท่านั้น)
  // เฉพาะ production เท่านั้น — ตอน dev ต้องเห็นโค้ดที่แก้ทันที แต่ cache-first ของ SW จะเสิร์ฟของเก่าค้างไว้ตลอด (แก้ยังไงก็ไม่เห็นการเปลี่ยนแปลง)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/prapa-sw.js').catch(() => {});
    } else {
      // เครื่องที่เคยเปิด /prapa ตอน dev ก่อนมีเงื่อนไขนี้ อาจมี SW เก่าค้างอยู่แล้ว — ต้อง unregister + ล้าง cache ทิ้งเอง
      // ไม่งั้น SW เก่าจะ intercept request ทุกครั้ง เสิร์ฟหน้าที่แคชไว้เก่า ๆ ต่อไป ต่อให้แก้โค้ดใหม่แค่ไหนก็ไม่เห็นผล
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
      if ('caches' in window) caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
    }
  }, []);
  // manifest PWA (เพิ่มลงหน้าจอหลัก → เปิดแบบแอปเต็มจอ) — inject เฉพาะ /prapa แล้วถอนตอนออก (ไม่แตะ metadata สารบรรณ)
  useEffect(() => {
    const nodes: HTMLElement[] = [];
    const add = (tag: string, attrs: Record<string, string>) => {
      const el = document.createElement(tag);
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      document.head.appendChild(el); nodes.push(el);
    };
    add('link', { rel: 'manifest', href: '/prapa-manifest.json' });
    add('meta', { name: 'mobile-web-app-capable', content: 'yes' });
    add('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' });
    add('meta', { name: 'apple-mobile-web-app-title', content: 'ประปา' });
    add('meta', { name: 'theme-color', content: '#0891b2' });
    return () => { nodes.forEach((n) => n.remove()); };
  }, []);

  if (isLogin) return <div className="min-h-screen bg-linear-to-b from-sky-50 via-white to-cyan-50">{children}</div>;
  if (isBare) return <>{children}</>;
  if (!hasHydrated || !isAuth) return null;

  if (!canWater) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 p-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-2xl">🔒</div>
        <p className="text-lg font-semibold text-slate-800">ไม่มีสิทธิ์เข้าถึงระบบประปา</p>
        <p className="max-w-sm text-sm text-slate-500">บัญชีนี้ยังไม่ได้รับสิทธิ์กิจการประปา — ติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์</p>
        <button onClick={() => { clearAuth(); router.replace('/prapa/login'); }}
          className="mt-2 rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600">เข้าด้วยบัญชีอื่น</button>
      </div>
    );
  }

  const name = user?.fullName || user?.username || '';
  const isActive = (href: string) => pathname === href || (href !== '/prapa' && pathname.startsWith(href));

  const SidebarNav = () => (
    <nav className="space-y-4 p-3">
      <Link href="/prapa" onClick={() => setDrawer(false)}
        className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ${pathname === '/prapa' ? 'bg-sky-50 text-sky-700' : 'text-slate-600 hover:bg-slate-50'}`}>
        <Home className="h-4 w-4" /> หน้าหลัก
      </Link>
      {NAV.map((g) => ({ ...g, items: g.items.filter((it) => can(it.caps)) })).filter((g) => g.items.length).map((g) => (
        <div key={g.group}>
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{g.group}</p>
          <div className="space-y-0.5">
            {g.items.map((it) => (
              <Link key={it.href} href={it.href} onClick={() => setDrawer(false)}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition ${isActive(it.href) ? 'bg-sky-50 font-medium text-sky-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                <it.icon className="h-4 w-4 shrink-0" /> <span className="truncate">{it.label}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* แถบบน */}
      <header className="sticky top-0 z-40 bg-linear-to-r from-sky-600 to-cyan-600 text-white shadow-sm print:hidden">
        <div className="flex h-16 items-center justify-between px-4">
          <div className="flex shrink-0 items-center gap-2">
            <button onClick={() => setDrawer(true)} className="rounded-lg p-2 hover:bg-white/15 lg:hidden" title="เมนู"><Menu className="h-6 w-6" /></button>
            <Link href="/prapa" className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-white/40"><img src="/prapa/logo-mark.png" alt="" className="h-full w-full object-contain" /></div>
              <div className="hidden leading-tight sm:block">
                <p className="text-base font-bold">ระบบประปา</p>
                <p className="text-xs text-white/80">จดมิเตอร์ · เก็บค่าน้ำ</p>
              </div>
            </Link>
          </div>
          {/* ชื่อ + โลโก้หน่วยงาน — กลางแถบบน */}
          {org?.nameTh && (
            <div className="flex min-w-0 flex-1 items-center justify-center gap-2 px-2">
              {org.logoUrl && (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/95 p-0.5 ring-1 ring-white/50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={org.logoUrl} alt="" className="h-full w-full object-contain" />
                </div>
              )}
              <span className="truncate text-lg font-bold tracking-tight sm:hidden">{shortOrgName(org.nameTh)}</span>
              <span className="hidden truncate text-xl font-bold tracking-tight sm:inline">{org.nameTh}</span>
            </div>
          )}
          <div className="flex shrink-0 items-center gap-1">
            <span className="hidden max-w-48 truncate px-1 text-sm text-white/90 sm:inline">{name}</span>
            <button onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')} aria-label="สลับโหมดสว่าง/มืด"
              title={mode === 'dark' ? 'สลับเป็นโหมดสว่าง' : 'สลับเป็นโหมดมืด'}
              className="rounded-full p-2 transition hover:bg-white/15">
              {mode === 'dark' ? <Sun className="h-5 w-5" aria-hidden /> : <Moon className="h-5 w-5" aria-hidden />}
            </button>
            <button onClick={() => { clearAuth(); router.replace('/prapa/login'); }}
              className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm transition hover:bg-white/15" title="ออกจากระบบ">
              <LogOut className="h-5 w-5" /><span className="hidden sm:inline">ออก</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* sidebar desktop */}
        <aside className="sticky top-16 hidden h-[calc(100vh-64px)] w-64 shrink-0 overflow-y-auto border-r border-slate-100 bg-white lg:block print:hidden">
          <SidebarNav />
        </aside>

        {/* เนื้อหา — เต็มความกว้างจอ ไม่จำกัด max-width (เดิมมี max-w-7xl/max-w-5xl ซ้อนกันทำให้เหลือพื้นที่ว่างซ้ายขวาบนจอกว้าง) */}
        <main className="min-w-0 flex-1 px-4 py-4 pb-20 lg:px-6">{children}</main>
      </div>

      {/* drawer มือถือ */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setDrawer(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute left-0 top-0 h-full w-72 overflow-y-auto bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <span className="font-semibold text-slate-800">เมนูระบบประปา</span>
              <button onClick={() => setDrawer(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <SidebarNav />
          </div>
        </div>
      )}
    </div>
  );
}
