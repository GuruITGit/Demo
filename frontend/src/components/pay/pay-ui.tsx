'use client';
import type { ReactNode } from 'react';
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
    <div role="tablist" className="flex gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-white p-1">
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          type="button"
          aria-selected={value === t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors',
            value === t.key ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100',
          )}
        >
          {t.label}
          {!!t.badge && (
            <span className={cn('rounded-full px-1.5 text-[11px] font-bold leading-5', value === t.key ? 'bg-white/25 text-white' : 'bg-red-500 text-white')}>{t.badge}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function Metric({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'warn' | 'ok' | 'bad' }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={cn('mt-1 text-2xl font-bold', tone === 'warn' ? 'text-amber-600' : tone === 'ok' ? 'text-green-700' : tone === 'bad' ? 'text-red-600' : 'text-gray-900')}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

export function Panel({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-xl border border-gray-200 bg-white', className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-3">
          {title && <h2 className="font-semibold text-gray-800">{title}</h2>}
          {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block text-sm', className)}>
      <span className="text-gray-700">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-xs text-gray-400">{hint}</span>}
    </label>
  );
}

export const inputCls = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100';

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-10 text-center text-sm text-gray-500">{children}</p>;
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
