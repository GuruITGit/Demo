'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/water-api';
import { MONTH_TH } from '@/lib/baht-text';
import { BarChart3, TrendingUp, AlertTriangle, ChevronDown } from 'lucide-react';
import { TableCard, Table, THead, Th, Td, Tr } from '@/components/shared/table';
import { StatCard } from '../ui';

const money = (n: any) => Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money0 = (n: any) => Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 });
const periodLabel = (p: any) => p ? `${MONTH_TH[p.periodMonth]} ${p.periodYear}` : '';

export default function PrapaDashboardPage() {
  const [sel, setSel] = useState('');
  const { data: periods } = useQuery({
    queryKey: ['water-collection-periods'],
    queryFn: async () => (await api.get('/water/collection/periods')).data.data as any[],
  });
  const [y, m] = sel ? sel.split('-').map(Number) : [undefined, undefined];
  const { data: d, isLoading } = useQuery({
    queryKey: ['prapa-dashboard', y, m],
    queryFn: async () => (await api.get('/water/collection/dashboard', { params: { year: y, month: m } })).data.data as any,
  });

  const maxTrend = Math.max(1, ...(d?.trend || []).map((t: any) => Math.max(t.billed, t.collected)));

  const { data: alerts } = useQuery({
    queryKey: ['prapa-alerts', d?.period?.periodYear, d?.period?.periodMonth],
    enabled: !!d?.period,
    queryFn: async () => (await api.get('/water/billing/alerts/list', { params: { year: d.period.periodYear, month: d.period.periodMonth } })).data.data as any,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-lg font-bold text-slate-800"><BarChart3 className="h-5 w-5 text-sky-500" /> สรุปการเก็บค่าน้ำ</h1>
          {d?.hasData && <p className="mt-0.5 text-sm text-slate-500">ประจำงวด <span className="font-medium text-slate-800">{periodLabel(d.period)}</span></p>}
        </div>
        {(periods?.length ?? 0) > 0 && (
          <select value={sel} onChange={(e) => setSel(e.target.value)} className="h-10 shrink-0 rounded-xl border border-slate-200 bg-white px-2.5 text-base outline-none focus:border-sky-400 sm:h-9 sm:text-sm">
            <option value="">งวดล่าสุด</option>
            {periods!.map((p) => <option key={`${p.periodYear}-${p.periodMonth}`} value={`${p.periodYear}-${p.periodMonth}`}>{MONTH_TH[p.periodMonth]} {p.periodYear}</option>)}
          </select>
        )}
      </div>

      {isLoading ? (
        <p className="py-16 text-center text-sm text-slate-400">กำลังโหลด...</p>
      ) : !d?.hasData ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <BarChart3 className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 font-medium text-slate-600">ยังไม่มีข้อมูลการจัดเก็บ</p>
          <p className="mt-1 text-sm text-slate-400">เริ่มจดมิเตอร์และรับชำระ แล้วหน้านี้จะสรุปให้อัตโนมัติ</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="ยอดบิลทั้งงวด" value={money(d.totals.billed)} unit="บาท" tone="text-slate-900" />
            <StatCard label="เก็บได้" value={money(d.totals.collected)} unit="บาท" tone="text-emerald-600" />
            <StatCard label="ค้างชำระ" value={money(d.totals.outstanding)} unit="บาท" tone="text-rose-600" />
            <StatCard label="อัตราการเก็บ" value={String(d.totals.rate)} unit="%" tone="text-cyan-600" sub={`${money0(d.totals.customers)} ราย`} />
          </div>

          {alerts && (alerts.zeroUnits.count > 0 || alerts.highUsage.count > 0) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {alerts.zeroUnits.count > 0 && (
                <AlertCard title="มิเตอร์เสีย / บ้านร้าง" desc="จดแล้วใช้ 0 หน่วย — ควรออกตรวจ" tone="amber"
                  count={alerts.zeroUnits.count} rows={alerts.zeroUnits.rows} unitLabel="" />
              )}
              {alerts.highUsage.count > 0 && (
                <AlertCard title="ใช้น้ำผิดปกติ (ท่อรั่ว?)" desc={`ใช้เกิน ${alerts.threshold} หน่วย — เตือนก่อนบิลบาน`} tone="rose"
                  count={alerts.highUsage.count} rows={alerts.highUsage.rows} unitLabel="หน่วย" />
              )}
            </div>
          )}

          {d.trend?.length > 1 && (
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
              <p className="mb-4 flex items-center gap-1.5 text-sm font-medium text-slate-700"><TrendingUp className="h-4 w-4 text-cyan-500" />ย้อนหลัง {d.trend.length} งวด</p>
              <div className="flex items-end gap-2 overflow-x-auto pb-1" style={{ minHeight: 140 }}>
                {d.trend.map((t: any, i: number) => (
                  <div key={i} className="flex min-w-8 flex-1 flex-col items-center gap-1 sm:min-w-10">
                    <div className="flex h-28 w-full items-end justify-center gap-0.5">
                      <div className="w-2.5 rounded-t bg-slate-200" style={{ height: `${(t.billed / maxTrend) * 100}%` }} title={`บิล ${money(t.billed)}`} />
                      <div className="w-2.5 rounded-t bg-emerald-400" style={{ height: `${(t.collected / maxTrend) * 100}%` }} title={`เก็บได้ ${money(t.collected)}`} />
                    </div>
                    <span className="whitespace-nowrap text-[10px] text-slate-400">{MONTH_TH[t.periodMonth].slice(0, 3)} {String(t.periodYear).slice(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">แยกรายหมู่ — งวด {periodLabel(d.period)}</p>
            {/* มือถือ: แถวกระชับต่อหมู่ (ชื่อหมู่+อัตราเก็บ / ยอด 3 ช่อง) */}
            <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100 bg-white sm:hidden">
              {d.byVillage.map((v: any) => {
                const rate = v.billed > 0 ? (v.collected / v.billed) * 100 : 0;
                const low = rate < 80;
                return (
                  <div key={v.villageNo} className="px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <p className="w-24 shrink-0 text-sm font-medium text-slate-800">หมู่ {v.villageNo} <span className="text-xs font-normal text-slate-400">{money0(v.customers)} ราย</span></p>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full ${low ? 'bg-rose-400' : 'bg-emerald-400'}`} style={{ width: `${Math.min(100, rate)}%` }} />
                      </div>
                      <span className={`w-10 shrink-0 text-right text-xs font-semibold tabular-nums ${low ? 'text-rose-500' : 'text-slate-500'}`}>{rate.toFixed(0)}%</span>
                    </div>
                    <div className="mt-1 grid grid-cols-3 gap-2 text-xs tabular-nums">
                      <span className="text-slate-500">บิล <span className="text-slate-700">{money0(v.billed)}</span></span>
                      <span className="text-slate-500">เก็บ <span className="text-emerald-600">{money0(v.collected)}</span></span>
                      <span className="text-right text-slate-500">ค้าง <span className={v.outstanding > 0 ? 'text-rose-600' : 'text-slate-300'}>{money0(v.outstanding)}</span></span>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* จอใหญ่: ตารางกลาง */}
            <TableCard className="hidden sm:block">
              <Table>
                <THead><Th>หมู่</Th><Th align="right">ราย</Th><Th align="right">ยอดบิล</Th><Th align="right">เก็บได้</Th><Th align="right">ค้าง</Th><Th>อัตราเก็บ</Th></THead>
                <tbody>
                  {d.byVillage.map((v: any) => {
                    const rate = v.billed > 0 ? (v.collected / v.billed) * 100 : 0;
                    const low = rate < 80;
                    return (
                      <Tr key={v.villageNo}>
                        <Td className="whitespace-nowrap font-medium text-slate-700">หมู่ {v.villageNo}</Td>
                        <Td align="right" className="text-slate-500">{money0(v.customers)}</Td>
                        <Td align="right" className="font-mono text-slate-700">{money(v.billed)}</Td>
                        <Td align="right" className="font-mono text-emerald-600">{money(v.collected)}</Td>
                        <Td align="right" className={`font-mono ${v.outstanding > 0 ? 'text-rose-600' : 'text-slate-300'}`}>{money(v.outstanding)}</Td>
                        <Td>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                              <div className={`h-full rounded-full ${low ? 'bg-rose-400' : 'bg-emerald-400'}`} style={{ width: `${Math.min(100, rate)}%` }} />
                            </div>
                            <span className={`w-11 text-right text-xs font-medium ${low ? 'text-rose-500' : 'text-slate-500'}`}>{rate.toFixed(0)}%</span>
                          </div>
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableCard>
          </div>
        </>
      )}
    </div>
  );
}

function AlertCard({ title, desc, tone, count, rows, unitLabel }: { title: string; desc: string; tone: 'amber' | 'rose'; count: number; rows: any[]; unitLabel: string }) {
  const [open, setOpen] = useState(false);
  const c = tone === 'rose'
    ? { border: 'border-rose-200', bg: 'bg-rose-50/60', text: 'text-rose-600', chip: 'bg-rose-100 text-rose-700' }
    : { border: 'border-amber-200', bg: 'bg-amber-50/60', text: 'text-amber-600', chip: 'bg-amber-100 text-amber-700' };
  return (
    <div className={`rounded-2xl border ${c.border} ${c.bg} p-4`}>
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-3 text-left">
        <div>
          <p className={`flex items-center gap-1.5 text-sm font-semibold ${c.text}`}><AlertTriangle className="h-4 w-4 shrink-0" /> {title}</p>
          <p className="text-xs text-slate-500">{desc}</p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5"><span className={`rounded-full px-2.5 py-1 text-sm font-bold ${c.chip}`}>{count} ราย</span><ChevronDown className={`h-4 w-4 text-slate-400 transition ${open ? 'rotate-180' : ''}`} /></span>
      </button>
      {open && count > 0 && (
        <div className="mt-3 max-h-56 space-y-1 overflow-y-auto border-t border-slate-200/60 pt-2">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center justify-between gap-2 py-0.5 text-xs">
              <span className="min-w-0 truncate text-slate-700"><span className="font-mono text-slate-400">{r.customerCode}</span> {r.fullName}</span>
              <span className="shrink-0 text-slate-400">ม.{r.villageNo} · {r.units}{unitLabel}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
