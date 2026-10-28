'use client';
import {
  periodSummary, summaryByMoo, summaryByType, households, debtors,
  thMonth, fmtMoney, CURRENT, RATE, TYPE_TONE,
} from '../mock';
import { PageHead, StatCard, TypeBadge } from '../ui';
import { Users, Coins, FileText, FileWarning } from 'lucide-react';

const PERIODS = [4, 5, 6, 7, 8];

export default function DashboardPage() {
  const sum = periodSummary(CURRENT.year, CURRENT.month);
  const byMoo = summaryByMoo(CURRENT.year, CURRENT.month);
  const byType = summaryByType(CURRENT.year, CURRENT.month);
  const dl = debtors();
  const totalArrears = dl.reduce((s, x) => s + x.arrears, 0);

  const trend = PERIODS.map((m) => ({ m, ...periodSummary(CURRENT.year, m) }));
  const trendMax = Math.max(...trend.map((t) => t.collected), 1);
  const mooMax = Math.max(...byMoo.map((m) => m.target), 1);
  const typeTotal = byType.reduce((s, t) => s + t.collected, 0) || 1;

  return (
    <div>
      <PageHead title="สรุปการจัดเก็บค่าขยะ" subtitle={`ภาพรวมงวด ${thMonth(CURRENT.month)} ${CURRENT.year} และแนวโน้มย้อนหลัง`} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="ผู้ใช้บริการ" value={households.length} unit="ราย" tone="amber" icon={Users} />
        <StatCard label="เก็บได้งวดนี้" value={fmtMoney(sum.collected)} unit="฿" tone="emerald" icon={Coins} sub={`${Math.round(sum.rate * 100)}% ของยอดตั้งเก็บ`} />
        <StatCard label="ยอดตั้งเก็บ" value={fmtMoney(sum.target)} unit="฿" tone="sky" icon={FileText} />
        <StatCard label="ค้างสะสม" value={fmtMoney(totalArrears)} unit="฿" tone="rose" icon={FileWarning} sub={`ลูกหนี้ ${dl.length} ราย`} />
      </div>

      {/* แนวโน้ม 5 งวด */}
      <section className="mb-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">แนวโน้มการจัดเก็บ (5 งวดล่าสุด)</h2>
        <div className="flex items-end justify-between gap-3" style={{ height: 160 }}>
          {trend.map((t) => (
            <div key={t.m} className="flex flex-1 flex-col items-center justify-end gap-2">
              <span className="text-[11px] font-semibold tabular-nums text-slate-500">{fmtMoney(t.collected)}</span>
              <div className="flex w-full items-end justify-center" style={{ height: 110 }}>
                <div className="w-8 rounded-t-lg bg-linear-to-t from-emerald-500 to-teal-400 transition-all sm:w-12"
                  style={{ height: `${Math.max(6, (t.collected / trendMax) * 100)}%` }} title={`${fmtMoney(t.collected)} บาท`} />
              </div>
              <span className={`text-[11px] ${t.m === CURRENT.month ? 'font-bold text-emerald-700' : 'text-slate-400'}`}>{thMonth(t.m).slice(0, 3)}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* แยกหมู่ */}
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">จัดเก็บแยกหมู่ (งวดนี้)</h2>
          <div className="space-y-3">
            {byMoo.map((m) => {
              const pct = m.target ? Math.round((m.collected / m.target) * 100) : 0;
              return (
                <div key={m.moo}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-600">หมู่ {m.moo} — {m.name}</span>
                    <span className="tabular-nums text-slate-400">{fmtMoney(m.collected)} / {fmtMoney(m.target)} ({pct}%)</span>
                  </div>
                  <div className="relative h-3 overflow-hidden rounded-full bg-slate-100">
                    <div className="absolute inset-y-0 left-0 rounded-full bg-slate-200" style={{ width: `${(m.target / mooMax) * 100}%` }} />
                    <div className="absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-emerald-500 to-teal-500" style={{ width: `${(m.collected / mooMax) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-slate-400">แถบเข้ม = เก็บได้ · แถบจาง = ยอดตั้งเก็บ</p>
        </section>

        {/* แยกประเภท */}
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">สัดส่วนรายรับตามประเภท (งวดนี้)</h2>
          {/* แถบสัดส่วนรวม */}
          <div className="mb-4 flex h-4 w-full overflow-hidden rounded-full">
            {byType.map((t) => {
              const w = (t.collected / typeTotal) * 100;
              const bg: Record<string, string> = {
                'บ้านพักอาศัย': 'bg-emerald-500', 'ร้านค้าย่อย': 'bg-amber-500', 'ร้านอาหาร': 'bg-orange-500',
                'ตลาด/แผงลอย': 'bg-violet-500', 'โรงงาน/สถานประกอบการ': 'bg-rose-500',
              };
              return w > 0 ? <div key={t.type} className={bg[t.type]} style={{ width: `${w}%` }} title={`${t.type} ${fmtMoney(t.collected)}`} /> : null;
            })}
          </div>
          <div className="space-y-2">
            {byType.map((t) => (
              <div key={t.type} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2"><TypeBadge type={t.type} /><span className="text-[11px] text-slate-400">{t.count} ราย</span></span>
                <span className="tabular-nums font-medium text-slate-700">{fmtMoney(t.collected)} <span className="text-[11px] font-normal text-slate-400">({Math.round((t.collected / typeTotal) * 100)}%)</span></span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
