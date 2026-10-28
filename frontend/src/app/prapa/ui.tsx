'use client';
/**
 * ชุด UI กลางของระบบประปา — ทุกหน้าใน /prapa ใช้ตัวเดียวกัน หน้าตา/ระยะ/สีจะได้เหมือนกันทั้งระบบ
 * - มือถือมาก่อน: ช่องกรอกสูง 44px ตัวอักษร 16px (iPhone ไม่ซูม) · จอ sm ขึ้นไปค่อยเล็กลง
 * - ตาราง/แบ่งหน้า ใช้ของกลาง components/shared/table.tsx + pagination.tsx
 */
import { useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ───────────── ช่องกรอก ───────────── */

/** ช่องกรอก/เลือก — ไม่มี padding ซ้ายขวา และไม่กำหนดความกว้าง (ต่อท้ายเองได้โดยไม่ชนกัน) */
export const controlBase =
  'h-11 rounded-xl border border-slate-200 bg-white text-base text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50 disabled:text-slate-400 sm:h-10 sm:text-sm';
/** ช่องกรอกเต็มความกว้าง (ใช้บ่อยสุด) */
export const inputCls = `${controlBase} w-full px-3`;
/** ช่องข้อความหลายบรรทัด */
export const textareaCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 sm:text-sm';

/** ป้าย + ช่องกรอก */
export function Field({ label, hint, className, children }: { label: React.ReactNode; hint?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

/** ช่องค้นหา (ไอคอนแว่น + ปุ่มล้าง) */
export function SearchInput({ value, onChange, placeholder = 'ค้นหา...', className, autoFocus }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string; autoFocus?: boolean;
}) {
  return (
    <div className={cn('relative min-w-0', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input type="text" inputMode="search" value={value} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} className={`${controlBase} w-full pl-9 pr-9`} />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="ล้างคำค้นหา"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X className="h-4 w-4" /></button>
      )}
    </div>
  );
}

/* ───────────── ปุ่ม ───────────── */

const BTN_TONE = {
  primary: 'bg-sky-600 text-white hover:bg-sky-700',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
  secondary: 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800',
  ghost: 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
} as const;
export type BtnTone = keyof typeof BTN_TONE;
/** class ปุ่ม — มือถือสูง 44px · จอใหญ่ 36-40px */
export function btn(tone: BtnTone = 'primary', size: 'md' | 'sm' = 'md') {
  return cn(
    'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
    size === 'md' ? 'h-11 px-4 text-sm sm:h-10' : 'h-9 px-3 text-sm sm:h-8 sm:text-xs',
    BTN_TONE[tone],
  );
}

/* ───────────── โครงหน้า ───────────── */

/** หัวหน้า: ไอคอน + ชื่อ + คำอธิบายบรรทัดเดียว + ปุ่มด้านขวา */
export function PageHeader({ icon: Icon, iconClass = 'text-sky-500', title, desc, badge, actions }: {
  icon: React.ComponentType<{ className?: string }>; iconClass?: string; title: React.ReactNode; desc?: React.ReactNode; badge?: React.ReactNode; actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-lg font-bold text-slate-800">
          <Icon className={cn('h-5 w-5 shrink-0', iconClass)} /> <span className="min-w-0">{title}</span> {badge}
        </h1>
        {desc && <p className="mt-0.5 text-sm text-slate-500">{desc}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/** กล่องเนื้อหา */
export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5', className)}>{children}</div>;
}

/** หัวข้อในกล่อง + คำอธิบายสั้น */
export function SectionTitle({ title, desc, actions }: { title: React.ReactNode; desc?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-700">{title}</p>
        {desc && <p className="mt-0.5 text-xs text-slate-400">{desc}</p>}
      </div>
      {actions}
    </div>
  );
}

/** ตัวเลขสรุป */
export function StatCard({ label, value, unit, tone = 'text-slate-900', sub, className }: {
  label: React.ReactNode; value: React.ReactNode; unit?: string; tone?: string; sub?: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn('rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm sm:p-4', className)}>
      <p className="text-xs text-slate-400">{label}</p>
      <p className={cn('mt-1 text-xl font-semibold tabular-nums sm:text-2xl', tone)}>{value}{unit && <span className="ml-1 text-sm font-normal text-slate-400">{unit}</span>}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

/** ไม่มีข้อมูล / กำลังโหลด */
export function EmptyState({ icon: Icon, title, desc, className }: { icon?: React.ComponentType<{ className?: string }>; title: React.ReactNode; desc?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-12 text-center', className)}>
      {Icon && <Icon className="mx-auto h-9 w-9 text-slate-300" />}
      <p className={cn('text-sm font-medium text-slate-500', Icon && 'mt-3')}>{title}</p>
      {desc && <p className="mt-1 text-xs text-slate-400">{desc}</p>}
    </div>
  );
}

/* ───────────── ตัวกรอง ───────────── */

export type Pill<K extends string> = { key: K; label: React.ReactNode; count?: number; dot?: string };
/** ปุ่มกรองแบบเม็ดยา — มือถือเลื่อนซ้ายขวา · จอใหญ่ขึ้นบรรทัดใหม่ */
export function FilterPills<K extends string>({ items, value, onChange, className }: { items: Pill<K>[]; value: K; onChange: (k: K) => void; className?: string }) {
  return (
    <div className={cn('-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0', className)}>
      {items.map((it) => {
        const on = value === it.key;
        return (
          <button key={it.key} type="button" onClick={() => onChange(it.key)}
            className={cn('inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border text-sm font-medium transition',
              it.count != null ? 'pl-3 pr-1.5' : 'px-3.5',
              on ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300')}>
            {it.dot && <span className={cn('h-2 w-2 rounded-full', it.dot)} />}
            {it.label}
            {it.count != null && <span className={cn('min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs font-semibold tabular-nums', on ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500')}>{it.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** แท็บแบบกล่อง (สลับมุมมอง) — มือถือเต็มความกว้าง */
export function Tabs<K extends string>({ items, value, onChange, className }: { items: { key: K; label: React.ReactNode }[]; value: K; onChange: (k: K) => void; className?: string }) {
  return (
    <div className={cn('flex w-full overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 text-sm sm:inline-flex sm:w-auto', className)}>
      {items.map((t) => (
        <button key={t.key} type="button" onClick={() => onChange(t.key)}
          className={cn('flex-1 whitespace-nowrap rounded-lg px-4 py-2 font-medium transition sm:flex-none sm:py-1.5',
            value === t.key ? 'bg-sky-600 text-white' : 'text-slate-500 hover:text-slate-700')}>{t.label}</button>
      ))}
    </div>
  );
}

/* ───────────── หน้าต่างลอย ───────────── */

/**
 * หน้าต่างลอย — มือถือเด้งขึ้นจากล่าง (bottom sheet) · จอใหญ่อยู่กลางจอ
 * footer = แถบปุ่มติดล่าง (เว้นขอบล่างของ iPhone ให้แล้ว)
 */
export function Sheet({ title, subtitle, onClose, footer, size = 'md', children }: {
  title: React.ReactNode; subtitle?: React.ReactNode; onClose: () => void; footer?: React.ReactNode; size?: 'md' | 'lg' | 'xl'; children: React.ReactNode;
}) {
  // ปิดด้วย Esc + ล็อกการเลื่อนหน้าหลังขณะเปิด
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  const w = size === 'xl' ? 'sm:max-w-3xl' : size === 'lg' ? 'sm:max-w-xl' : 'sm:max-w-md';
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}
        className={cn('flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl', w)}>
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-slate-200 sm:hidden" />
        <div className="flex shrink-0 items-start gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold text-slate-900">{title}</h3>
            {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="ปิด"
            className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
        {footer && <div className="shrink-0 border-t border-slate-100 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">{footer}</div>}
      </div>
    </div>
  );
}

/** กล่องรวมรายการบนมือถือ (แถวคั่นเส้น) — คู่กับตารางกลางบนจอใหญ่ */
export function MobileList({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100 bg-white', className)}>{children}</div>;
}
