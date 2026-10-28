'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/water-api';
import { useWaterAuthStore } from '@/stores/water-auth.store';
import { ChevronRight } from 'lucide-react';
import { WaterIllus } from '@/components/brand/water-illus';
import { PRAPA_NAV } from './nav';
import { SlipIcon } from '@/components/brand/water-icons';

const money = (n: any) => Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PrapaHome() {
  const user = useWaterAuthStore((s) => s.user);
  const can = (caps: string[]) => user?.role === 'admin' || caps.some((c) => (user?.caps || []).includes(c));
  const canReading = can(['reading']);
  const canReports = can(['reports']);
  const canSlips = can(['slips']);

  const { data: dash } = useQuery({
    queryKey: ['prapa-dash-mini'],
    queryFn: async () => (await api.get('/water/collection/dashboard')).data.data as any,
    enabled: canReports,
  });
  const { data: slips } = useQuery({
    queryKey: ['prapa-slips-count'],
    queryFn: async () => (await api.get('/water/billing/slips/pending')).data.data as any,
    enabled: canSlips,
  });
  const slipCount = slips?.count ?? 0;

  // เมนูทุกโมดูลที่มีสิทธิ์ — ชุดเดียวกับ sidebar (จดมิเตอร์มีการ์ดใหญ่ด้านบนแล้ว)
  const groups = PRAPA_NAV.map((g) => ({ ...g, items: g.items.filter((it) => can(it.caps)) }))
    .filter((g) => g.items.length);

  return (
    <div className="space-y-5">
      {/* จดมิเตอร์ — งานหลัก (รูปเด่น) */}
      {canReading && (
        <Link href="/prapa/reading"
          className="group flex min-h-[112px] overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:min-h-[184px]">
          <div className="w-28 shrink-0 overflow-hidden sm:w-72">
            <WaterIllus name="meter" className="h-full w-full transition-transform duration-300 group-hover:scale-105" />
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-2 p-4 sm:gap-3 sm:p-8">
            <div className="min-w-0 flex-1">
              <span className="mb-1.5 inline-block rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700">งานหลัก</span>
              <h2 className="text-lg font-bold text-slate-800 sm:text-2xl">จดมิเตอร์ / เก็บค่าน้ำ</h2>
              <p className="mt-0.5 text-sm text-slate-500 sm:text-base"><span className="sm:hidden">กดเพื่อเริ่มจด · รับเงิน</span><span className="hidden sm:inline">เลือกหมู่ → จดเลข → คิดเงิน → พิมพ์ใบแจ้งหนี้ → รับชำระ</span></p>
            </div>
            <ChevronRight className="h-7 w-7 shrink-0 text-sky-300 transition group-hover:translate-x-1" />
          </div>
        </Link>
      )}

      {/* สลิปรอตรวจ (เด่นเมื่อมี) */}
      {slipCount > 0 && (
        <Link href="/prapa/slips"
          className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/70 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-rose-500 to-pink-600 text-white"><SlipIcon className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-rose-700">มีสลิปโอนรอตรวจ {slipCount} รายการ</p>
            <p className="text-xs text-rose-500">ประชาชนจ่าย QR แล้ว — กดยืนยันเพื่อออกใบเสร็จ</p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-rose-300" />
        </Link>
      )}

      {dash?.hasData && (
        <div className="grid grid-cols-3 gap-2">
          <Mini label="งวดล่าสุด" value={dash.totals ? `${dash.totals.rate}%` : '—'} sub="อัตราเก็บ" tone="text-cyan-600" />
          <Mini label="เก็บได้" value={money(dash.totals?.collected)} sub="บาท" tone="text-emerald-600" />
          <Mini label="ค้างชำระ" value={money(dash.totals?.outstanding)} sub="บาท" tone="text-rose-600" />
        </div>
      )}

      {/* เมนูทุกโมดูล (ชุดเดียวกับ sidebar) — การ์ดรูปขนาดเล็ก แบ่งกลุ่ม เปิดมือถือมาเห็นครบ */}
      {groups.map((g) => (
        <section key={g.group}>
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{g.group}</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-5 xl:grid-cols-6">
            {g.items.map((it) => (
              <Link key={it.href} href={it.href}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[.98]">
                <div className="aspect-4/3 w-full overflow-hidden">
                  <WaterIllus name={it.illus} className="h-full w-full transition-transform duration-300 group-hover:scale-105" />
                </div>
                {it.href === '/prapa/slips' && slipCount > 0 && (
                  <span className="absolute right-1.5 top-1.5 min-w-5 rounded-full bg-rose-500 px-1.5 text-center text-[11px] font-bold leading-5 text-white">{slipCount}</span>
                )}
                <div className="px-2 py-2 sm:px-3 sm:py-2.5">
                  <p className="line-clamp-2 text-xs font-semibold leading-snug text-slate-800 sm:text-sm">{it.label}</p>
                  <p className="mt-0.5 hidden truncate text-[11px] text-slate-400 sm:block">{it.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Mini({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-3 py-2.5 text-center shadow-sm">
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className={`text-lg font-semibold ${tone}`}>{value}</p>
      <p className="text-[10px] text-slate-400">{sub}</p>
    </div>
  );
}
