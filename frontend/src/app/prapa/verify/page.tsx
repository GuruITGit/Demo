'use client';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/water-api';
import { MONTH_TH } from '@/lib/baht-text';
import { ShieldCheck, TrendingUp, Minus, Activity, Printer, FileSpreadsheet, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { TableCard, Table, THead, Th, Td, Tr, TableMessage, CodeChip } from '@/components/shared/table';
import { PageHeader, Card, Field, inputCls, btn, FilterPills, MobileList } from '../ui';

const money = (n: any) => Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateTh = (s: string | null) => s ? new Date(s).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';

type Row = {
  customerCode: string; fullName: string; villageNo: number | null;
  prevReading: number; currReading: number; units: number; prevUnits: number | null;
  prevReadAt: string | null; currReadAt: string | null; totalAmount: number; deviationPct?: number;
};
type VerifyData = {
  period: { periodYear: number; periodMonth: number }; threshold: number; devPct: number; totalRead: number;
  high: { count: number; rows: Row[] }; zero: { count: number; rows: Row[] }; deviation: { count: number; rows: Row[] };
};

const TABS = [
  { key: 'high', label: 'ค่าน้ำสูงผิดปกติ', icon: TrendingUp, color: 'rose' },
  { key: 'zero', label: 'มิเตอร์คงที่ (0 หน่วย)', icon: Minus, color: 'amber' },
  { key: 'deviation', label: 'เบี่ยงเบน ≥30%', icon: Activity, color: 'violet' },
] as const;

export default function PrapaVerifyPage() {
  const nowBE = new Date().getFullYear() + 543;
  const [year, setYear] = useState(nowBE);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [threshold, setThreshold] = useState(60);
  const [tab, setTab] = useState<'high' | 'zero' | 'deviation'>('high');
  const [applied, setApplied] = useState(false);

  // งวดเริ่มต้นตามรอบบิลปัจจุบัน
  const { data: round } = useQuery({
    queryKey: ['water-round'],
    queryFn: async () => (await api.get('/water/billing/round')).data.data as { periodYear: number; periodMonth: number },
  });
  useEffect(() => {
    if (round && !applied) { setApplied(true); setYear(round.periodYear); setMonth(round.periodMonth); }
  }, [round, applied]);

  const { data, isLoading } = useQuery({
    queryKey: ['water-verify', year, month, threshold],
    queryFn: async () => (await api.get('/water/billing/verify', { params: { year, month, threshold } })).data.data as VerifyData,
  });

  const rows = data ? data[tab].rows : [];
  const showDev = tab === 'deviation';

  const downloadExcel = async () => {
    const res = await api.get('/water/billing/verify/excel', { params: { year, month, threshold }, responseType: 'blob' });
    const u = URL.createObjectURL(res.data as Blob); const a = document.createElement('a');
    a.href = u; a.download = `ตรวจจดมิเตอร์-${month}-${year}.xlsx`; a.click(); setTimeout(() => URL.revokeObjectURL(u), 60000);
  };
  const cols = showDev ? 10 : 9;

  return (
    <div className="space-y-4">
      <PageHeader icon={ShieldCheck} title="ตรวจสอบการจดมิเตอร์" desc="ตรวจค่าผิดปกติก่อนเปลี่ยนรอบบิล" />
      <p className="flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50/70 px-4 py-2.5 text-sm text-amber-800 print:hidden">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> ตรวจทุกเส้นทางก่อนเปลี่ยนรอบบิลขึ้นเดือนใหม่ — เปลี่ยนรอบแล้วแก้ยาก
      </p>

      {/* ตัวกรอง */}
      <Card className="print:hidden">
        <div className="grid grid-cols-3 gap-3 sm:flex sm:flex-wrap sm:items-end">
          <Field label="เดือน" className="sm:w-36">
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={inputCls}>
              {Object.entries(MONTH_TH).map(([n, l]) => <option key={n} value={n}>{l}</option>)}
            </select>
          </Field>
          <Field label="ปี (พ.ศ.)" className="sm:w-28">
            <input type="number" inputMode="numeric" value={year} onChange={(e) => setYear(Number(e.target.value))} className={inputCls} />
          </Field>
          <Field label="เกณฑ์สูง (หน่วย)" className="sm:w-36">
            <input type="number" inputMode="numeric" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className={inputCls} />
          </Field>
          <div className="col-span-3 grid grid-cols-2 gap-2 sm:ml-auto sm:flex">
            <button onClick={downloadExcel} className={btn('secondary')}><FileSpreadsheet className="h-4 w-4" /> Excel</button>
            <button onClick={() => window.print()} className={btn('secondary')}><Printer className="h-4 w-4" /> พิมพ์รายงาน</button>
          </div>
        </div>
      </Card>

      {/* แท็บ 3 แบบ */}
      <FilterPills className="print:hidden" value={tab} onChange={setTab}
        items={TABS.map((t) => ({ key: t.key, label: <><t.icon className="h-4 w-4" /> {t.label}</>, count: data ? data[t.key].count : 0 }))} />

      <p className="text-sm text-slate-500">
        {MONTH_TH[month]} {year} · จดแล้ว {data?.totalRead ?? 0} ราย · พบผิดปกติ <b className="text-rose-600">{rows.length}</b> ราย
      </p>

      {/* มือถือ: รายการกระชับ (ตอนสั่งพิมพ์ใช้ตารางด้านล่างแทน) */}
      <div className="sm:hidden print:hidden">
        {isLoading ? <p className="py-10 text-center text-sm text-slate-400">กำลังโหลด…</p>
        : !rows.length ? <p className="flex items-center justify-center gap-1.5 rounded-2xl border border-slate-100 bg-white py-10 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4" /> ไม่พบรายการผิดปกติ</p>
        : (
          <MobileList>
            {rows.map((r) => (
              <div key={r.customerCode} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{r.fullName}</p>
                  <p className="truncate text-xs text-slate-400"><span className="font-mono">{r.customerCode}</span> · หมู่ {r.villageNo ?? '—'} · จด {dateTh(r.currReadAt)}</p>
                  <p className="text-xs tabular-nums text-slate-500">{r.prevReading} → <span className="text-slate-700">{r.currReading}</span> · ก่อน {r.prevUnits ?? '—'} หน่วย</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-base font-bold tabular-nums text-slate-900">{r.units} <span className="text-xs font-normal text-slate-400">หน่วย</span></p>
                  {showDev && <p className="text-xs font-semibold tabular-nums text-violet-600">{r.deviationPct}%</p>}
                  <p className="text-xs tabular-nums text-slate-500">{money(r.totalAmount)}</p>
                </div>
              </div>
            ))}
          </MobileList>
        )}
      </div>

      {/* จอใหญ่ + ตอนพิมพ์: ตารางกลาง */}
      <TableCard className="hidden sm:block print:block">
        <Table className="min-w-[720px]">
          <THead>
            <Th>รหัส</Th><Th>ชื่อ-สกุล</Th><Th align="center">หมู่</Th><Th align="right">จดก่อน</Th><Th align="right">จดใหม่</Th>
            <Th align="center">วันจดใหม่</Th><Th align="right">หน่วยก่อน</Th><Th align="right">หน่วยนี้</Th>
            {showDev && <Th align="right">เบี่ยงเบน</Th>}
            <Th align="right">ค่าน้ำ</Th>
          </THead>
          <tbody>
            {isLoading ? <TableMessage colSpan={cols}>กำลังโหลด…</TableMessage>
            : rows.length ? rows.map((r) => (
              <Tr key={r.customerCode}>
                <Td><CodeChip>{r.customerCode}</CodeChip></Td>
                <Td className="text-slate-700">{r.fullName}</Td>
                <Td align="center" className="text-slate-500">{r.villageNo ?? '—'}</Td>
                <Td align="right" className="tabular-nums text-slate-500">{r.prevReading}</Td>
                <Td align="right" className="tabular-nums text-slate-700">{r.currReading}</Td>
                <Td align="center" className="text-slate-500">{dateTh(r.currReadAt)}</Td>
                <Td align="right" className="tabular-nums text-slate-400">{r.prevUnits ?? '—'}</Td>
                <Td align="right" className="font-semibold tabular-nums text-slate-800">{r.units}</Td>
                {showDev && <Td align="right" className="font-semibold tabular-nums text-violet-600">{r.deviationPct}%</Td>}
                <Td align="right" className="tabular-nums text-slate-600">{money(r.totalAmount)}</Td>
              </Tr>
            )) : <TableMessage colSpan={cols}><span className="inline-flex items-center gap-1.5 text-emerald-600"><CheckCircle2 className="h-4 w-4" /> ไม่พบรายการผิดปกติ</span></TableMessage>}
          </tbody>
        </Table>
      </TableCard>
    </div>
  );
}
