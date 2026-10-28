'use client';
import { useState } from 'react';
import {
  periodSummary, summaryByMoo, summaryByType, debtors,
  THAI_MONTHS, thMonth, fmtMoney, CURRENT,
} from '../mock';
import { PageHead, TypeBadge } from '../ui';
import { FileSpreadsheet, FileText, Users, Coins, FileWarning } from 'lucide-react';

type Tab = 'debtors' | 'income';

export default function ReportPage() {
  const [month, setMonth] = useState(CURRENT.month);
  const [year, setYear] = useState(CURRENT.year);
  const [tab, setTab] = useState<Tab>('debtors');

  const sum = periodSummary(year, month);
  const byMoo = summaryByMoo(year, month);
  const byType = summaryByType(year, month);
  const dl = debtors();
  const totalArrears = dl.reduce((s, x) => s + x.arrears, 0);

  return (
    <div>
      <PageHead title="รายงานลูกหนี้ / รายรับ" subtitle="สรุปการจัดเก็บค่าธรรมเนียมขยะมูลฝอย แยกหมู่ / ประเภท" />

      {/* ตัวเลือก */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-400">
          {THAI_MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-400">
          {[2568, 2569, 2570].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <div className="ml-auto flex gap-2">
          <button className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3.5 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"><FileSpreadsheet className="h-4 w-4" /> Excel</button>
          <button className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"><FileText className="h-4 w-4" /> PDF</button>
        </div>
      </div>

      {/* KPI */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi icon={Users} tone="sky" label="ออกบิล" value={`${sum.billed} ราย`} />
        <Kpi icon={Coins} tone="emerald" label="เก็บได้" value={`${fmtMoney(sum.collected)} ฿`} />
        <Kpi icon={FileText} tone="amber" label="ตั้งเก็บ" value={`${fmtMoney(sum.target)} ฿`} />
        <Kpi icon={FileWarning} tone="rose" label="ค้างสะสม" value={`${fmtMoney(totalArrears)} ฿`} />
      </div>

      {/* แท็บ */}
      <div className="mb-3 flex gap-1 rounded-full bg-slate-100 p-1 text-sm">
        {([['debtors', 'ลูกหนี้ (แยกหมู่)'], ['income', 'รายรับ (แยกประเภท)']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-1 rounded-full px-3 py-1.5 font-medium transition ${tab === k ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}>{l}</button>
        ))}
      </div>

      {tab === 'debtors' && (
        <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold text-slate-500">
                <th className="px-3 py-2.5">หมู่</th>
                <th className="px-3 py-2.5 text-right">ผู้ใช้บริการ</th>
                <th className="px-3 py-2.5 text-right">ตั้งเก็บ</th>
                <th className="px-3 py-2.5 text-right">เก็บได้</th>
                <th className="px-3 py-2.5 text-right">คงค้าง</th>
                <th className="px-3 py-2.5 text-right">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {byMoo.map((m) => (
                <tr key={m.moo} className="hover:bg-emerald-50/30">
                  <td className="px-3 py-2.5 font-medium text-slate-700">หมู่ {m.moo} — {m.name}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{m.count}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{fmtMoney(m.target)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-emerald-600">{fmtMoney(m.collected)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-rose-600">{fmtMoney(m.target - m.collected)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{m.target ? Math.round((m.collected / m.target) * 100) : 0}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-800">
                <td className="px-3 py-2.5">รวม</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{byMoo.reduce((s, m) => s + m.count, 0)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(byMoo.reduce((s, m) => s + m.target, 0))}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">{fmtMoney(byMoo.reduce((s, m) => s + m.collected, 0))}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-rose-700">{fmtMoney(byMoo.reduce((s, m) => s + (m.target - m.collected), 0))}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{Math.round(sum.rate * 100)}%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {tab === 'income' && (
        <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold text-slate-500">
                <th className="px-3 py-2.5">ประเภทผู้ใช้บริการ</th>
                <th className="px-3 py-2.5 text-right">อัตรา/เดือน</th>
                <th className="px-3 py-2.5 text-right">จำนวนราย</th>
                <th className="px-3 py-2.5 text-right">เก็บได้แล้ว</th>
                <th className="px-3 py-2.5 text-right">ยอดตั้งเก็บ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {byType.map((t) => (
                <tr key={t.type} className="hover:bg-emerald-50/30">
                  <td className="px-3 py-2.5"><TypeBadge type={t.type} /></td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{fmtMoney(t.rate)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{t.count}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-emerald-600">{fmtMoney(t.collected)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{fmtMoney(t.target)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-800">
                <td className="px-3 py-2.5">รวม</td>
                <td className="px-3 py-2.5" />
                <td className="px-3 py-2.5 text-right tabular-nums">{byType.reduce((s, t) => s + t.count, 0)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">{fmtMoney(byType.reduce((s, t) => s + t.collected, 0))}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(byType.reduce((s, t) => s + t.target, 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, tone, label, value }: { icon: any; tone: string; label: string; value: string }) {
  const TONE: Record<string, string> = {
    emerald: 'from-emerald-500 to-teal-600', sky: 'from-sky-500 to-cyan-600',
    amber: 'from-amber-500 to-orange-600', rose: 'from-rose-500 to-pink-600',
  };
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br ${TONE[tone]} text-white shadow-sm`}><Icon className="h-4 w-4" /></span>
      <p className="mt-2 text-[11px] text-slate-400">{label}</p>
      <p className="text-lg font-bold tabular-nums text-slate-800">{value}</p>
    </div>
  );
}
