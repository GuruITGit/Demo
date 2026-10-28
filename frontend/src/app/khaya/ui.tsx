'use client';
/** ชุด UI ที่ใช้ซ้ำทั่วโปรแกรมค่าขยะ /khaya — ให้ทุกหน้าหน้าตาเป็นชุดเดียวกัน */
import type { KType } from './mock';
import { TYPE_TONE, fmtMoney } from './mock';

/** badge ประเภทผู้ใช้บริการ */
export function TypeBadge({ type, className = '' }: { type: KType; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${TYPE_TONE[type]} ${className}`}>
      {type}
    </span>
  );
}

/** badge หมู่ */
export function MooBadge({ moo }: { moo: number }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
      หมู่ {moo}
    </span>
  );
}

/** จำนวนเงิน (จัดขวา ตัวเลขเรียงหลัก) */
export function Money({ v, className = '' }: { v: number; className?: string }) {
  return <span className={`tabular-nums ${className}`}>{fmtMoney(v)}</span>;
}

/** สถานะจ่าย/ค้าง */
export function PaidBadge({ paid }: { paid: boolean }) {
  return paid ? (
    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">ชำระแล้ว</span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600 ring-1 ring-rose-200">ค้างชำระ</span>
  );
}

/** หัวข้อหน้า (ชื่อ + คำอธิบาย + ปุ่มมุมขวา) */
export function PageHead({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-slate-800">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

/** การ์ดสถิติ (ตัวเลขเด่น) */
export function StatCard({
  label, value, unit, tone = 'emerald', icon: Icon, sub,
}: {
  label: string; value: string | number; unit?: string; tone?: 'emerald' | 'sky' | 'amber' | 'rose' | 'violet' | 'slate';
  icon?: any; sub?: string;
}) {
  const TONE: Record<string, string> = {
    emerald: 'from-emerald-500 to-teal-600',
    sky: 'from-sky-500 to-cyan-600',
    amber: 'from-amber-500 to-orange-600',
    rose: 'from-rose-500 to-pink-600',
    violet: 'from-violet-500 to-purple-600',
    slate: 'from-slate-500 to-slate-600',
  };
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        {Icon && (
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br ${TONE[tone]} text-white shadow-sm`}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-slate-800">
        {value}
        {unit && <span className="ml-1 text-sm font-medium text-slate-400">{unit}</span>}
      </p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>}
    </div>
  );
}

/** แถบความคืบหน้า (อัตราจัดเก็บ) */
export function ProgressBar({ value, tone = 'emerald' }: { value: number; tone?: string }) {
  const TONE: Record<string, string> = {
    emerald: 'bg-emerald-500', amber: 'bg-amber-500', rose: 'bg-rose-500',
  };
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${TONE[tone] || TONE.emerald}`} style={{ width: `${Math.min(100, Math.round(value * 100))}%` }} />
    </div>
  );
}

/** แบนเนอร์แจ้งว่าเป็น demo (mock) */
export function DemoNote({ text }: { text?: string }) {
  return (
    <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
      <span className="mt-0.5">ℹ️</span>
      <span>{text || 'หน้าสาธิต (demo) — ข้อมูลเป็นตัวอย่าง ไม่เชื่อมฐานข้อมูลจริง'}</span>
    </div>
  );
}
