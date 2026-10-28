'use client';
import { cn } from '@/lib/utils';

/**
 * ชุดตารางกลางของทั้งเว็บ — หน้าตาเดียวกับ /prapa/customers (กล่องมน + เส้นตาราง + หัวตัวเล็กตัวหนา)
 * ใช้ประกอบเอง: <TableCard><Table><THead><Th/></THead><tbody><Tr><Td/></Tr></tbody></Table><Pagination/></TableCard>
 * ตารางแบบคอลัมน์ธรรมดาใช้ <DataTable> (ข้างในเรียกชุดนี้) · แถบแบ่งหน้าใช้ <Pagination> จาก ./pagination
 */

/** กล่องครอบตาราง (+ แถบแบ่งหน้าด้านล่าง) — เลื่อนแนวนอนได้เมื่อจอแคบ */
export function TableCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm', className)}>{children}</div>;
}

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full border-collapse text-sm', className)}>{children}</table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return <thead><tr className="bg-slate-50/70 text-left">{children}</tr></thead>;
}

const cellBase = 'border border-slate-200 px-4 py-3';

export function Th({ children, align, className }: { children?: React.ReactNode; align?: 'left' | 'right' | 'center'; className?: string }) {
  return (
    <th className={cn(cellBase, 'text-xs font-semibold uppercase tracking-wide text-slate-500',
      align === 'right' && 'text-right', align === 'center' && 'text-center', className)}>
      {children}
    </th>
  );
}

export function Td({ children, align, className, colSpan, onClick }: {
  children?: React.ReactNode; align?: 'left' | 'right' | 'center'; className?: string; colSpan?: number;
  onClick?: React.MouseEventHandler<HTMLTableCellElement>;
}) {
  return (
    <td colSpan={colSpan} onClick={onClick}
      className={cn(cellBase, align === 'right' && 'text-right', align === 'center' && 'text-center', className)}>
      {children}
    </td>
  );
}

/** แถว — ใส่ onClick แล้วจะชี้ได้/ไฮไลต์ตอนเอาเมาส์วาง */
export function Tr({ children, onClick, className, ...rest }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr onClick={onClick} {...rest} className={cn('transition-colors', onClick ? 'cursor-pointer hover:bg-sky-50/40' : 'hover:bg-slate-50/60', className)}>
      {children}
    </tr>
  );
}

/** แถวสถานะเต็มความกว้าง — กำลังโหลด / ไม่มีข้อมูล */
export function TableMessage({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return <tr><td colSpan={colSpan} className={cn(cellBase, 'py-14 text-center text-sm text-slate-400')}>{children}</td></tr>;
}

/** ช่องว่าง (ไม่มีค่า) — ขีดจาง ๆ ให้ตาข้ามไปได้ */
export const Dash = () => <span className="text-slate-300">—</span>;

/** ป้ายรหัส (โมโน พื้นเทา) — รหัสผู้ใช้น้ำ / เลขที่เอกสาร */
export function CodeChip({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-medium text-slate-600">{children}</span>;
}

const TONES = {
  slate: ['bg-slate-100 text-slate-500', 'bg-slate-400'],
  sky: ['bg-sky-50 text-sky-700', 'bg-sky-500'],
  emerald: ['bg-emerald-50 text-emerald-700', 'bg-emerald-500'],
  amber: ['bg-amber-50 text-amber-700', 'bg-amber-500'],
  rose: ['bg-rose-50 text-rose-600', 'bg-rose-500'],
  indigo: ['bg-indigo-50 text-indigo-700', 'bg-indigo-500'],
} as const;
export type Tone = keyof typeof TONES;

/** ป้ายสถานะมีจุดสีนำหน้า */
export function StatusPill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const [box, dot] = TONES[tone];
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium', box)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />
      {children}
    </span>
  );
}
