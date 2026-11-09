'use client';
import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/utils';

/** ชื่อหน่วยงาน (ไว้พิมพ์หัว QR/ใบเสร็จ) */
export function useOrgName(): string {
  const orgId = useAuthStore((s) => s.user?.organizationId);
  const { data } = useQuery({
    queryKey: ['organization', orgId],
    queryFn: async () => (await api.get(`/organizations/${orgId}`)).data.data,
    enabled: !!orgId,
    staleTime: 5 * 60_000,
  });
  return (data as { nameTh?: string } | undefined)?.nameTh ?? '';
}

/** แท็บแนวนอนของหน้าค่าแผง/ค่าขยะ (เลื่อนได้บนมือถือ) พร้อมป้ายตัวเลข */
export function PayTabs<T extends string>({ tabs, value, onChange }: {
  tabs: { key: T; label: string; badge?: number }[];
  value: T;
  onChange: (k: T) => void;
}) {
  return (
    <div role="tablist" className="flex flex-wrap gap-1 rounded border border-gray-200 bg-white p-1">
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          type="button"
          aria-selected={value === t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            'inline-flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-sm px-2 py-1 text-xs font-medium transition-colors',
            value === t.key ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100',
          )}
        >
          {t.label}
          {!!t.badge && (
            <span className={cn('rounded-sm px-1 text-[10px] font-bold leading-4', value === t.key ? 'bg-white/25 text-white' : 'bg-red-500 text-white')}>{t.badge}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function Metric({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'warn' | 'ok' | 'bad' }) {
  return (
    <div className="rounded border border-gray-200 bg-white p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={cn('mt-0.5 text-lg font-bold', tone === 'warn' ? 'text-amber-600' : tone === 'ok' ? 'text-green-700' : tone === 'bad' ? 'text-red-600' : 'text-gray-900')}>{value}</p>
      {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
    </div>
  );
}

export function Panel({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded border border-gray-200 bg-white', className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-3 py-2">
          {title && <h2 className="text-[13px] font-semibold text-gray-800">{title}</h2>}
          {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block text-[13px]', className)}>
      <span className="text-gray-700">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-xs text-gray-400">{hint}</span>}
    </label>
  );
}

export const inputCls = 'w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100';

/** กรองผู้ค้างชำระตามจำนวนเดือนที่ค้าง + ค้นหา · เรียงค้างนานสุดก่อน */
export function filterDues<T extends { months: number; total: number }>(rows: T[], min: number, q: string, text: (r: T) => string): T[] {
  const k = q.trim().toLowerCase();
  return rows.filter((r) => r.months >= min && (!k || text(r).toLowerCase().includes(k))).sort((a, b) => b.months - a.months || b.total - a.total);
}
/** สีเตือนตามเดือนที่ค้าง: 2 เดือน = เหลือง · 3 เดือนขึ้นไป = แดง */
export const dueTone = (months: number) => (months >= 3 ? 'font-semibold text-red-600' : months >= 2 ? 'font-semibold text-amber-600' : '');
const DUE_SUGGEST = [1, 2, 3, 6, 12];
/** ช่องเดียว: พิมพ์จำนวนเดือนเอง หรือเลือกจากรายการแนะนำ (ว่าง = ทั้งหมด) + ค้นหา */
export function DuesFilter({ min, setMin, q, setQ, placeholder }: { min: number; setMin: (n: number) => void; q: string; setQ: (s: string) => void; placeholder: string }) {
  return (
    <div className="no-print flex flex-wrap items-center gap-3 border-b border-gray-100 px-3 py-2">
      <label className="flex items-center gap-2 text-[13px] text-gray-700">
        ค้างตั้งแต่
        <input type="number" inputMode="numeric" min={1} max={99} list="due-months" className={cn(inputCls, 'w-24 text-center')}
          value={min || ''} placeholder="ทั้งหมด" onChange={(e) => setMin(Math.max(0, Math.floor(Number(e.target.value)) || 0))} />
        เดือนขึ้นไป
      </label>
      <datalist id="due-months">{DUE_SUGGEST.map((n) => <option key={n} value={n}>{`${n} เดือน`}</option>)}</datalist>
      <input className={cn(inputCls, 'ml-auto max-w-xs')} value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-3 py-6 text-center text-xs text-gray-500">{children}</p>;
}

/** แถบตัวกรองงวด: ตัวเลือก 12 เดือนล่าสุด (พ.ศ.-เดือน) */
export function recentPeriods(n = 12): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < n; i++) {
    out.push(`${d.getFullYear() + 543}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

/** ป้ายวิธีชำระ: โอน / เงินสด / สแกนจ่าย — เห็นชัดทุกที่ที่แสดงบิลที่ชำระแล้ว */
export function MethodChip({ method }: { method: string | null | undefined }) {
  const label = method === 'cash' ? 'เงินสด' : method === 'transfer' ? 'โอน' : method === 'qr' ? 'สแกนจ่าย' : '—';
  const tone = method === 'cash' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-sky-50 text-sky-800 border-sky-200';
  return <span className={cn('inline-block rounded-md border px-2 py-0.5 text-xs font-semibold', tone)}>{label}</span>;
}

/** ปุ่มดูสลิป (เปิดรูปเต็มจอ) — โอนแต่ไม่มีรูปเก็บไว้ (เช่น ข้อมูลเดโมเก่า) จะบอกชัดว่าไม่มีรูป · เงินสดไม่แสดงอะไร */
export function SlipButton({ url, method }: { url?: string | null; method?: string | null }) {
  const [open, setOpen] = useState(false);
  if (!url) return method === 'transfer' || method === 'qr' ? <span className="text-xs text-gray-400">ไม่มีรูปสลิปเก็บไว้</span> : null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded-md border border-gray-300 bg-white px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-50">ดูสลิป</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3" onClick={() => setOpen(false)} role="dialog" aria-label="รูปสลิป">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="สลิปโอนเงิน" className="max-h-full max-w-full rounded bg-white" />
        </div>
      )}
    </>
  );
}

/** ปุ่ม "จัดการ" ปุ่มเดียว — กดแล้วเลือกการกระทำจากรายการ (ใช้ fixed เพื่อไม่ถูกตารางที่เลื่อนได้ตัดขอบ) */
export type RowMenuItem = { label: string; onClick: () => void; danger?: boolean; hint?: string; disabled?: boolean };
export function RowMenu({ items }: { items: RowMenuItem[] }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  return (
    <>
      <button type="button" aria-haspopup="menu" aria-expanded={!!pos}
        onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setPos(pos ? null : { x: Math.max(8, r.right - 224), y: r.bottom + 4 }); }}
        className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-gray-300 bg-white px-3 py-1.5 text-[13px] font-medium text-gray-700 hover:bg-gray-50">
        จัดการ <span aria-hidden className="text-xs text-gray-400">▾</span>
      </button>
      {pos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPos(null)} />
          <ul role="menu" style={{ left: pos.x, top: Math.min(pos.y, window.innerHeight - items.length * 40 - 16) }} className="fixed z-50 w-56 rounded border border-gray-200 bg-white py-1 shadow-md">
            {items.map((it, i) => (
              <li key={i} role="none" className={it.danger ? 'mt-1 border-t border-gray-100 pt-1' : undefined}>
                <button type="button" role="menuitem" disabled={it.disabled} onClick={() => { setPos(null); it.onClick(); }}
                  className={cn('flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent', it.danger ? 'text-red-600' : 'text-gray-800')}>
                  {it.label}{it.hint && <span className="text-xs text-gray-400">{it.hint}</span>}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

/** ตัวเลือกแบบลิสต์ดรอปดาวน์ — ใช้แทนปุ่มกรองหลายปุ่ม */
export function Segmented<T extends string>({ options, value, onChange, className, label }: { options: readonly (readonly [T, string])[]; value: T; onChange: (v: T) => void; className?: string; label?: string }) {
  return (
    <label className={cn('inline-flex items-center gap-2 text-[13px] text-gray-600', className)}>
      {label && <span>{label}</span>}
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className={cn(inputCls, 'w-auto! min-w-[10rem]')}>
        {options.map(([k, text]) => <option key={k} value={k}>{text}</option>)}
      </select>
    </label>
  );
}
