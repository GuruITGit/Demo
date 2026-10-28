export const MONTH_ABBR = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
export const money = (n: any) => Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const USAGE_STATUS: Record<string, { label: string; cls: string }> = {
  '01': { label: 'ใช้งาน', cls: 'bg-emerald-50 text-emerald-600' },
  '02': { label: 'ยกเลิก-มีหนี้ค้าง', cls: 'bg-rose-50 text-rose-500' },
  '03': { label: 'ยกเลิก', cls: 'bg-slate-100 text-slate-400' },
};
export function StatusBadge({ s }: { s?: string | null }) {
  const m = s ? USAGE_STATUS[s] : null;
  if (!m) return <span className="text-slate-300">—</span>;
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${m.cls}`}>{m.label}</span>;
}

export const BILL_STATUS: Record<string, { label: string; cls: string }> = {
  paid: { label: 'ชำระแล้ว', cls: 'bg-emerald-50 text-emerald-600' },
  unpaid: { label: 'ค้างชำระ', cls: 'bg-rose-50 text-rose-500' },
  cancelled: { label: 'ยกเลิก', cls: 'bg-slate-100 text-slate-400' },
};
