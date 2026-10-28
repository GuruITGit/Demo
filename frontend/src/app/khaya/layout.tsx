'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home, Menu, X, Users, FileText, Receipt, Coins, FileWarning,
  BarChart3, ClipboardList, Truck, Settings2,
} from 'lucide-react';
import { KhayaMark } from '@/components/brand/khaya-mark';

/**
 * โปรแกรมจัดเก็บค่าธรรมเนียมขยะมูลฝอย (/khaya) — demo หน้าเว็บล้วน
 * ไม่มีระบบล็อกอิน/บัญชีผู้ใช้ (เข้าใช้ได้เลย) · โทนเขียว emerald/teal แยกจากประปา (ฟ้า)
 */
const NAV: { group: string; items: { href: string; label: string; icon: any }[] }[] = [
  {
    group: 'งานประจำ',
    items: [
      { href: '/khaya/bills', label: 'ออกบิลประจำงวด', icon: FileText },
      { href: '/khaya/cashier', label: 'รับชำระเงิน (สำนักงาน)', icon: Receipt },
      { href: '/khaya/collect', label: 'รับชำระ (ภาคสนาม)', icon: Coins },
      { href: '/khaya/notices', label: 'หนังสือแจ้งค้างชำระ', icon: FileWarning },
    ],
  },
  {
    group: 'รายงาน',
    items: [
      { href: '/khaya/dashboard', label: 'สรุปการจัดเก็บ', icon: BarChart3 },
      { href: '/khaya/report', label: 'รายงานลูกหนี้ / รายรับ', icon: ClipboardList },
    ],
  },
  {
    group: 'ทะเบียน & เส้นทาง',
    items: [
      { href: '/khaya/customers', label: 'ทะเบียนผู้ใช้บริการ', icon: Users },
      { href: '/khaya/schedule', label: 'ตารางเก็บขยะ / เส้นทางรถ', icon: Truck },
    ],
  },
  {
    group: 'ตั้งค่า',
    items: [
      { href: '/khaya/rate', label: 'อัตราค่าธรรมเนียม', icon: Settings2 },
    ],
  },
];

export default function KhayaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  useEffect(() => { setDrawer(false); }, [pathname]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  const SidebarNav = () => (
    <nav className="space-y-4 p-3">
      <Link href="/khaya" onClick={() => setDrawer(false)}
        className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ${pathname === '/khaya' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'}`}>
        <Home className="h-4 w-4" /> หน้าหลัก
      </Link>
      {NAV.map((g) => (
        <div key={g.group}>
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{g.group}</p>
          <div className="space-y-0.5">
            {g.items.map((it) => (
              <Link key={it.href} href={it.href} onClick={() => setDrawer(false)}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition ${isActive(it.href) ? 'bg-emerald-50 font-medium text-emerald-700' : 'text-slate-600 hover:bg-slate-50'}`}>
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
      <header className="sticky top-0 z-40 bg-linear-to-r from-emerald-600 to-teal-600 text-white shadow-sm print:hidden">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2">
            <button onClick={() => setDrawer(true)} className="rounded-lg p-1.5 hover:bg-white/15 lg:hidden" title="เมนู"><Menu className="h-5 w-5" /></button>
            <Link href="/khaya" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-white/40"><KhayaMark className="h-6 w-6" /></div>
              <div className="leading-tight">
                <p className="text-sm font-bold">ระบบค่าขยะมูลฝอย</p>
                <p className="text-[10px] text-white/80">ทะเบียน · ออกบิล · จัดเก็บ</p>
              </div>
            </Link>
          </div>
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white/90 ring-1 ring-white/25">DEMO</span>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl">
        {/* sidebar desktop */}
        <aside className="sticky top-13 hidden h-[calc(100vh-52px)] w-64 shrink-0 overflow-y-auto border-r border-slate-100 bg-white lg:block print:hidden">
          <SidebarNav />
        </aside>

        {/* เนื้อหา */}
        <main className="min-w-0 flex-1 px-4 py-4 pb-20">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>

      {/* drawer มือถือ */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setDrawer(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute left-0 top-0 h-full w-72 overflow-y-auto bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <span className="font-semibold text-slate-800">เมนูระบบค่าขยะ</span>
              <button onClick={() => setDrawer(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <SidebarNav />
          </div>
        </div>
      )}
    </div>
  );
}
