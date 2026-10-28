'use client';
import { useMemo, useState } from 'react';
import {
  households, periodBills, periodSummary, summaryByMoo, THAI_MONTHS, thMonth, fmtMoney, CURRENT,
} from '../mock';
import { PageHead, DemoNote } from '../ui';
import { FileText, CheckCircle2, Printer, Zap } from 'lucide-react';

export default function BillsPage() {
  const [month, setMonth] = useState(CURRENT.month);
  const [year, setYear] = useState(CURRENT.year);
  const [issued, setIssued] = useState(false);

  const existing = periodBills(year, month);
  const alreadyIssued = existing.length > 0;
  const sum = periodSummary(year, month);
  const byMoo = summaryByMoo(year, month);
  const activeCount = households.filter((h) => h.active).length;
  const target = households.filter((h) => h.active).reduce((s, h) => s + h.rate, 0);

  const shown = alreadyIssued || issued;

  return (
    <div>
      <PageHead title="ออกบิลประจำงวด" subtitle="สร้างบิลค่าธรรมเนียมให้ทุกครัวเรือนพร้อมกัน ตามอัตราของแต่ละประเภท" />
      <DemoNote />

      {/* เลือกงวด */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select value={month} onChange={(e) => { setMonth(Number(e.target.value)); setIssued(false); }}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-400">
          {THAI_MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={(e) => { setYear(Number(e.target.value)); setIssued(false); }}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-400">
          {[2568, 2569, 2570].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <span className="text-sm text-slate-500">งวด {thMonth(month)} {year}</span>
      </div>

      {/* การ์ดออกบิล */}
      {!shown ? (
        <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/40 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm ring-1 ring-emerald-100"><FileText className="h-7 w-7" /></div>
          <p className="mt-3 font-semibold text-slate-800">ยังไม่ได้ออกบิลงวดนี้</p>
          <p className="mt-1 text-sm text-slate-500">จะออกบิลให้ผู้ใช้บริการที่ยังใช้อยู่ <b>{activeCount}</b> ราย · ยอดตั้งเก็บรวม <b className="tabular-nums">{fmtMoney(target)}</b> บาท</p>
          <button onClick={() => setIssued(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700">
            <Zap className="h-4 w-4" /> ออกบิลยกงวด ({activeCount} ใบ)
          </button>
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-emerald-800">ออกบิลงวด {thMonth(month)} {year} แล้ว — {sum.billed || activeCount} ใบ</p>
              <p className="text-xs text-emerald-600">ยอดตั้งเก็บรวม {fmtMoney(sum.target || target)} บาท · เก็บได้แล้ว {fmtMoney(sum.collected)} บาท ({Math.round(sum.rate * 100)}%)</p>
            </div>
            <button className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200 transition hover:bg-emerald-50"><Printer className="h-4 w-4" /> พิมพ์บิลทั้งงวด</button>
          </div>

          {/* พรีวิวแยกหมู่ */}
          <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold text-slate-500">
                  <th className="px-3 py-2.5">หมู่</th>
                  <th className="px-3 py-2.5 text-right">บิลที่ออก</th>
                  <th className="px-3 py-2.5 text-right">ยอดตั้งเก็บ</th>
                  <th className="px-3 py-2.5 text-right">เก็บได้แล้ว</th>
                  <th className="px-3 py-2.5 text-right">คงค้าง</th>
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
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
