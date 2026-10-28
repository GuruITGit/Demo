'use client';
import { useMemo, useState } from 'react';
import { households, ROUTES, billsOf, unpaidBills, arrearsOf, fmtMoney } from '../mock';
import { PageHead, TypeBadge, DemoNote } from '../ui';
import { Banknote, Truck, CheckCircle2, Coins } from 'lucide-react';

export default function CollectPage() {
  const [moo, setMoo] = useState(1);
  const [paidSet, setPaidSet] = useState<Set<string>>(new Set()); // householdId ที่รับเงินแล้วรอบนี้
  const [collected, setCollected] = useState(0);

  const route = ROUTES.find((r) => r.moo === moo)!;
  const rows = useMemo(() =>
    households
      .filter((h) => h.moo === moo && h.active)
      .map((h) => ({ ...h, arrears: arrearsOf(h.id), unpaid: unpaidBills(h.id).length }))
      .sort((a, b) => a.code.localeCompare(b.code)),
    [moo]);

  const receive = (id: string, amount: number) => {
    if (paidSet.has(id) || amount <= 0) return;
    setPaidSet(new Set([...paidSet, id]));
    setCollected((c) => c + amount);
  };

  const doneCount = rows.filter((h) => paidSet.has(h.id) || h.arrears === 0).length;

  return (
    <div>
      <PageHead title="รับชำระ (ภาคสนาม)" subtitle="เก็บเงินตามหมู่/เส้นทางรถ — กด 'รับเงิน' รายบ้าน ระบบรวมยอดให้อัตโนมัติ" />
      <DemoNote text="หน้าสาธิต — ยอดรวม 'เก็บวันนี้' นับเฉพาะรอบนี้ (รีเฟรชแล้วรีเซ็ต)" />

      {/* หัว: เลือกหมู่ + สรุป */}
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
          <label className="text-[11px] font-medium text-slate-400">เลือกหมู่/เส้นทาง</label>
          <select value={moo} onChange={(e) => setMoo(Number(e.target.value))}
            className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-400">
            {ROUTES.map((r) => <option key={r.moo} value={r.moo}>หมู่ {r.moo} — {r.name}</option>)}
          </select>
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-400"><Truck className="h-3.5 w-3.5" /> วันเก็บ {route.days} · รถ {route.truck}</p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-3">
          <Coins className="h-8 w-8 text-emerald-500" />
          <div>
            <p className="text-[11px] font-medium text-emerald-700">เก็บได้วันนี้</p>
            <p className="text-xl font-bold tabular-nums text-emerald-700">{fmtMoney(collected)} <span className="text-sm">บาท</span></p>
          </div>
        </div>
        <div className="flex items-center rounded-2xl border border-slate-100 bg-white px-5 py-3">
          <div>
            <p className="text-[11px] font-medium text-slate-400">เก็บครบแล้ว</p>
            <p className="text-xl font-bold tabular-nums text-slate-700">{doneCount}<span className="text-sm text-slate-400">/{rows.length}</span></p>
          </div>
        </div>
      </div>

      {/* รายชื่อ */}
      <div className="space-y-1.5">
        {rows.map((h) => {
          const done = paidSet.has(h.id);
          const noDebt = h.arrears === 0;
          return (
            <div key={h.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition ${done ? 'border-emerald-200 bg-emerald-50/60' : noDebt ? 'border-slate-100 bg-slate-50/60' : 'border-slate-100 bg-white'}`}>
              <span className="font-mono text-xs text-slate-400">{h.code}</span>
              <span className="min-w-0 flex-1">
                <span className="font-medium text-slate-800">{h.name}</span>
                <span className="ml-2"><TypeBadge type={h.type} /></span>
              </span>
              <span className="hidden text-right text-xs text-slate-500 sm:block">
                {noDebt ? 'ไม่ค้าง' : <span className="font-semibold text-rose-600">ค้าง {h.unpaid} งวด · {fmtMoney(h.arrears)}</span>}
              </span>
              {done || noDebt
                ? <span className="inline-flex w-28 items-center justify-center gap-1 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> {done ? 'รับแล้ว' : 'ไม่ค้าง'}</span>
                : <button onClick={() => receive(h.id, h.arrears)}
                    className="inline-flex w-28 items-center justify-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700">
                    <Banknote className="h-3.5 w-3.5" /> รับเงิน
                  </button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
