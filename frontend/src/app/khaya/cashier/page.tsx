'use client';
import { useMemo, useState } from 'react';
import {
  households, billsOf, arrearsOf, thMonth, fmtMoney, mooName,
} from '../mock';
import { PageHead, TypeBadge, DemoNote } from '../ui';
import { Search, Receipt, Banknote, Printer, CheckCircle2, X } from 'lucide-react';

type RcptLine = { label: string; amount: number };
type Receipt = { no: string; name: string; code: string; method: string; date: string; lines: RcptLine[]; total: number };

export default function CashierPage() {
  const [q, setQ] = useState('');
  const [selId, setSelId] = useState<string | null>(null);
  const [paidSet, setPaidSet] = useState<Set<string>>(new Set());  // บิลที่ "รับชำระ" ในเซสชันนี้
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [method, setMethod] = useState<'เงินสด' | 'โอน'>('เงินสด');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [rseq, setRseq] = useState(7001);

  const results = useMemo(() => {
    const s = q.trim();
    if (!s) return [];
    return households
      .filter((h) => h.name.includes(s) || h.code.includes(s))
      .slice(0, 8)
      .map((h) => ({ ...h, arrears: arrearsOf(h.id) }));
  }, [q]);

  const sel = selId ? households.find((h) => h.id === selId) : null;
  const unpaid = useMemo(() => {
    if (!selId) return [];
    return billsOf(selId).filter((b) => !b.paid && !paidSet.has(b.id));
  }, [selId, paidSet]);

  const pick = (id: string) => {
    setSelId(id);
    setReceipt(null);
    const u = billsOf(id).filter((b) => !b.paid && !paidSet.has(b.id));
    setChecked(new Set(u.map((b) => b.id))); // เลือกทุกงวดค้างเป็นค่าเริ่มต้น
  };

  const toggle = (id: string) => {
    const n = new Set(checked);
    n.has(id) ? n.delete(id) : n.add(id);
    setChecked(n);
  };

  const chosen = unpaid.filter((b) => checked.has(b.id));
  const total = chosen.reduce((s, b) => s + b.amount, 0);

  const pay = () => {
    if (!sel || chosen.length === 0) return;
    const no = String(rseq);
    setReceipt({
      no,
      name: sel.name, code: sel.code, method,
      date: new Date().toLocaleDateString('th-TH', { day: '2-digit', month: 'long', year: 'numeric' }),
      lines: chosen.map((b) => ({ label: `ค่าธรรมเนียมขยะ ${thMonth(b.month)} ${b.year}`, amount: b.amount })),
      total,
    });
    setPaidSet(new Set([...paidSet, ...chosen.map((b) => b.id)]));
    setRseq(rseq + 1);
    setChecked(new Set());
  };

  return (
    <div>
      <PageHead title="รับชำระเงิน (สำนักงาน)" subtitle="ค้นหาครัวเรือน → เลือกงวดที่ค้าง → รับเงิน → พิมพ์ใบเสร็จ" />
      <DemoNote text="หน้าสาธิต — กด 'รับชำระ' แล้วบิลจะถูกทำเครื่องหมายว่าจ่ายแล้วเฉพาะรอบนี้ (รีเฟรชแล้วรีเซ็ต)" />

      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        {/* ค้นหา */}
        <div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder="พิมพ์ชื่อ หรือ รหัสผู้ใช้บริการ..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
          </div>
          <div className="mt-3 space-y-1.5">
            {results.map((h) => (
              <button key={h.id} onClick={() => pick(h.id)}
                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition ${selId === h.id ? 'border-emerald-300 bg-emerald-50' : 'border-slate-100 bg-white hover:border-emerald-200 hover:bg-emerald-50/40'}`}>
                <span>
                  <span className="font-medium text-slate-800">{h.name}</span>
                  <span className="ml-2 font-mono text-xs text-slate-400">{h.code}</span>
                  <span className="mt-0.5 flex items-center gap-1.5"><TypeBadge type={h.type} /><span className="text-[11px] text-slate-400">{mooName(h.moo)}</span></span>
                </span>
                <span className={`shrink-0 text-right text-xs font-semibold ${h.arrears > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {h.arrears > 0 ? `ค้าง ${fmtMoney(h.arrears)}` : 'ไม่ค้าง'}
                </span>
              </button>
            ))}
            {q.trim() && results.length === 0 && <p className="py-6 text-center text-sm text-slate-400">ไม่พบผู้ใช้บริการ</p>}
            {!q.trim() && <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">พิมพ์เพื่อค้นหาผู้ใช้บริการ</p>}
          </div>
        </div>

        {/* รายละเอียด / รับชำระ */}
        <div>
          {!sel && <div className="flex h-full min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-slate-200 text-sm text-slate-400">เลือกผู้ใช้บริการเพื่อรับชำระ</div>}

          {sel && !receipt && (
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-slate-800">{sel.name}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400"><span className="font-mono">{sel.code}</span> · {mooName(sel.moo)}</p>
                  <div className="mt-1"><TypeBadge type={sel.type} /></div>
                </div>
                <span className="text-right text-xs text-slate-400">ค่าธรรมเนียม<br /><span className="text-sm font-semibold text-slate-700">{fmtMoney(sel.rate)} บาท/เดือน</span></span>
              </div>

              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold text-slate-500">งวดที่ค้างชำระ ({unpaid.length} งวด)</p>
                {unpaid.length === 0
                  ? <p className="rounded-xl bg-emerald-50 py-6 text-center text-sm font-medium text-emerald-700">✓ ไม่มีงวดค้างชำระ</p>
                  : (
                    <div className="space-y-1.5">
                      {unpaid.map((b) => (
                        <label key={b.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-100 px-3 py-2 text-sm hover:bg-slate-50">
                          <input type="checkbox" checked={checked.has(b.id)} onChange={() => toggle(b.id)} className="h-4 w-4 accent-emerald-600" />
                          <span className="flex-1 text-slate-700">ค่าธรรมเนียมขยะ {thMonth(b.month)} {b.year}</span>
                          <span className="tabular-nums font-medium text-slate-700">{fmtMoney(b.amount)}</span>
                        </label>
                      ))}
                    </div>
                  )}
              </div>

              {unpaid.length > 0 && (
                <>
                  <div className="mt-4 flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3">
                    <span className="text-sm font-semibold text-emerald-800">รวมรับชำระ ({chosen.length} งวด)</span>
                    <span className="text-xl font-bold tabular-nums text-emerald-700">{fmtMoney(total)} บาท</span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex rounded-full bg-slate-100 p-0.5 text-sm">
                      {(['เงินสด', 'โอน'] as const).map((m) => (
                        <button key={m} onClick={() => setMethod(m)}
                          className={`rounded-full px-3 py-1.5 font-medium transition ${method === m ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}>{m}</button>
                      ))}
                    </div>
                    <button onClick={pay} disabled={chosen.length === 0}
                      className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-40">
                      <Banknote className="h-4 w-4" /> รับชำระ
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ใบเสร็จ */}
          {receipt && (
            <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
                <span className="text-sm font-bold">รับชำระเรียบร้อย</span>
                <button onClick={() => setReceipt(null)} className="ml-auto rounded-lg p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-500"><X className="h-4 w-4" /></button>
              </div>
              <div className="rounded-xl border border-dashed border-slate-200 p-4">
                <div className="text-center">
                  <p className="flex items-center justify-center gap-1.5 text-sm font-bold text-slate-800"><Receipt className="h-4 w-4 text-emerald-500" /> ใบเสร็จรับเงิน</p>
                  <p className="text-[11px] text-slate-400">ค่าธรรมเนียมเก็บขนขยะมูลฝอย</p>
                </div>
                <div className="mt-3 flex justify-between text-xs text-slate-500">
                  <span>เลขที่ {receipt.no}</span><span>{receipt.date}</span>
                </div>
                <div className="mt-1 text-xs text-slate-500">ผู้ชำระ: <span className="font-medium text-slate-700">{receipt.name}</span> ({receipt.code})</div>
                <div className="mt-3 space-y-1 border-t border-slate-100 pt-2 text-sm">
                  {receipt.lines.map((l, i) => (
                    <div key={i} className="flex justify-between"><span className="text-slate-600">{l.label}</span><span className="tabular-nums text-slate-700">{fmtMoney(l.amount)}</span></div>
                  ))}
                </div>
                <div className="mt-2 flex justify-between border-t border-slate-100 pt-2 text-sm font-bold">
                  <span className="text-slate-800">รวมทั้งสิ้น ({receipt.method})</span>
                  <span className="tabular-nums text-emerald-700">{fmtMoney(receipt.total)} บาท</span>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-900"><Printer className="h-4 w-4" /> พิมพ์ใบเสร็จ</button>
                <button onClick={() => { setReceipt(null); setSelId(null); setQ(''); }} className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">รับรายถัดไป</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
