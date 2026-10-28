'use client';
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

/**
 * แถบแบ่งหน้ากลาง — ใช้ให้หน้าตาตรงกันทุกจุดที่มี pagination (อ้างอิงสไตล์จาก /prapa/customers)
 * ซ่อนตัวเองอัตโนมัติเมื่อมีหน้าเดียว (totalPages <= 1) ไม่ต้องเช็คเงื่อนไขซ้ำตรงหน้าที่เรียกใช้
 * ใส่ total + pageSize → แสดง "1–50 จาก 146 รายการ" ด้านซ้าย
 */
export function Pagination({ page, totalPages, onChange, className, total, pageSize, unit = 'รายการ' }: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  /** override คอนเทนเนอร์ทั้งแถบ — ค่าเริ่มต้นคือแถบเทาอ่อนมีเส้นบน เหมือน /prapa/customers */
  className?: string;
  total?: number;
  pageSize?: number;
  unit?: string;
}) {
  if (totalPages <= 1) return null;
  const btn = 'rounded-lg border border-slate-200 bg-white p-1.5 hover:bg-slate-50 disabled:opacity-40';
  const range = total != null && pageSize
    ? `${((page - 1) * pageSize + 1).toLocaleString()}–${Math.min(page * pageSize, total).toLocaleString()} จาก ${total.toLocaleString()} ${unit}`
    : null;
  return (
    <div className={className ?? `flex items-center gap-3 border-t border-slate-100 bg-slate-50/50 px-4 py-3 text-sm ${range ? 'justify-between' : 'justify-center'}`}>
      {range && <span className="hidden text-slate-400 sm:inline">{range}</span>}
      <div className="flex items-center gap-3">
        <button disabled={page <= 1} onClick={() => onChange(1)} title="หน้าแรก"
          className={btn}><ChevronsLeft className="h-4 w-4" /></button>
        <button disabled={page <= 1} onClick={() => onChange(page - 1)}
          className={btn}><ChevronLeft className="h-4 w-4" /></button>
        <span className="text-slate-500">หน้า <b className="font-medium text-slate-700">{page}</b> / {totalPages}</span>
        <button disabled={page >= totalPages} onClick={() => onChange(page + 1)}
          className={btn}><ChevronRight className="h-4 w-4" /></button>
        <button disabled={page >= totalPages} onClick={() => onChange(totalPages)} title="หน้าสุดท้าย"
          className={btn}><ChevronsRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

/**
 * แบ่งหน้ารายการที่โหลดมาทั้งก้อนแล้ว (ฝั่งหน้าเว็บ) — กลับไปหน้า 1 เองเมื่อรายการเปลี่ยน (ค้นหา/กรอง)
 * const { rows, pager } = usePaged(list, 50);  …  {rows.map(...)} <Pagination {...pager} />
 */
export function usePaged<T>(list: T[], pageSize = 50, resetKey?: unknown) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
  useEffect(() => { setPage(1); }, [resetKey]);
  const current = Math.min(page, totalPages);
  const rows = useMemo(() => list.slice((current - 1) * pageSize, current * pageSize), [list, current, pageSize]);
  // เปลี่ยนหน้าจากแถบล่าง → เลื่อนกลับขึ้นบนสุด จะได้เริ่มอ่านหน้าใหม่ตั้งแต่แถวแรก
  const onChange = (p: number) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  return { rows, pager: { page: current, totalPages, onChange, total: list.length, pageSize } };
}
