'use client';
import { useRef, useState } from 'react';
import { api, getErrorMessage } from '@/lib/water-api';
import { toast } from '@/hooks/use-toast';
import { Landmark, Upload, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { TableCard, Table, THead, Th, Td, Tr, CodeChip, Dash } from '@/components/shared/table';
import { PageHeader } from '../ui';

type Parsed = { headers: string[]; rows: string[][] };
type Mapping = { ref1: number; ref2: number; amount: number; date: number };
type Result = {
  dryRun: boolean;
  summary: { total: number; settled: number; alreadyPaid: number; mismatch: number; unmatched: number; settledTotal: number };
  settled: any[]; alreadyPaid: any[]; mismatch: any[]; unmatched: any[];
};

const money = (n: any) => Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** กระทบยอดค่าน้ำจากไฟล์ธนาคาร (KTB Bill Payment) — อัปโหลด → จับคู่ Ref → ตัดชำระ+ออกใบเสร็จอัตโนมัติ */
export default function ReconcilePage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [map, setMap] = useState<Mapping>({ ref1: -1, ref2: -1, amount: -1, date: -1 });
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Result | null>(null);
  const [committed, setCommitted] = useState<Result | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const buildRows = () => (parsed?.rows || []).map((r) => ({
    ref1: r[map.ref1] ?? '',
    ref2: map.ref2 >= 0 ? (r[map.ref2] ?? '') : undefined,
    amount: Number(String(r[map.amount] ?? '').replace(/[^0-9.]/g, '')) || 0,
    paidAt: map.date >= 0 ? (r[map.date] ?? undefined) : undefined,
  })).filter((r) => r.ref1 || r.amount);

  const upload = async (file: File) => {
    setBusy(true); setPreview(null); setCommitted(null);
    try {
      const fd = new FormData(); fd.append('file', file);
      const { data } = await api.post('/water/billing/reconcile/parse', fd);
      const p: Parsed = data.data;
      setParsed(p);
      // เดาคอลัมน์อัตโนมัติจากชื่อหัวตาราง
      const find = (kw: RegExp) => p.headers.findIndex((h) => kw.test(String(h)));
      setMap({
        ref1: find(/ref\s*1|อ้างอิง\s*1|รหัส|customer|ผู้ใช้/i),
        ref2: find(/ref\s*2|อ้างอิง\s*2|งวด|period/i),
        amount: find(/amount|จำนวน|ยอด|เงิน/i),
        date: find(/date|วันที่|เวลา|paid/i),
      });
      setStep(2);
    } catch (e) { toast.error(getErrorMessage(e, 'อ่านไฟล์ไม่สำเร็จ')); }
    finally { setBusy(false); }
  };

  const run = async (dryRun: boolean) => {
    if (map.ref1 < 0 || map.amount < 0) { toast.error('เลือกคอลัมน์ Ref1 (รหัสผู้ใช้น้ำ) และยอดเงินก่อน'); return; }
    setBusy(true);
    try {
      const { data } = await api.post('/water/billing/reconcile', { rows: buildRows(), dryRun });
      const res: Result = data.data;
      if (dryRun) { setPreview(res); setStep(3); }
      else { setCommitted(res); toast.success(`ตัดชำระสำเร็จ ${res.summary.settled} รายการ`); }
    } catch (e) { toast.error(getErrorMessage(e, 'ประมวลผลไม่สำเร็จ')); }
    finally { setBusy(false); }
  };

  const reset = () => { setStep(1); setParsed(null); setPreview(null); setCommitted(null); setMap({ ref1: -1, ref2: -1, amount: -1, date: -1 }); };

  const STEPS = ['อัปโหลดไฟล์', 'จับคู่คอลัมน์', 'ตรวจ & ยืนยัน'];
  const curStep = committed ? 4 : step;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <PageHeader icon={Landmark} title="กระทบยอดจากธนาคาร" badge={<span className="text-sm font-medium text-slate-400">KTB</span>}
        desc="อัปโหลดไฟล์จากธนาคาร → ระบบจับคู่บิลและตัดชำระให้อัตโนมัติ" />

      {/* ขั้นตอน — มือถือแสดงชื่อเฉพาะขั้นปัจจุบัน กันล้นจอ */}
      <ol className="flex items-center gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2.5 text-xs font-medium text-slate-400 sm:gap-3 sm:px-4">
        {STEPS.map((s, i) => {
          const n = i + 1; const done = curStep > n; const on = curStep === n;
          return (
            <li key={s} className={`flex items-center gap-2 ${on || done ? 'text-sky-600' : ''} ${i < 2 ? 'flex-1' : ''}`}>
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${done ? 'bg-sky-100 text-sky-600' : on ? 'bg-sky-500 text-white' : 'bg-slate-100'}`}>
                {done ? <CheckCircle2 className="h-4 w-4" /> : n}
              </span>
              <span className={`whitespace-nowrap ${on ? '' : 'hidden sm:inline'}`}>{s}</span>
              {i < 2 && <span className={`h-px flex-1 ${done ? 'bg-sky-300' : 'bg-slate-200'}`} />}
            </li>
          );
        })}
      </ol>

      {committed ? (
        <ResultView res={committed} committed onReset={reset} />
      ) : step === 1 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white px-5 py-8 text-center sm:p-10">
          <Upload className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm text-slate-600">เลือกไฟล์รายการชำระจากธนาคาร</p>
          <p className="text-xs text-slate-400">.xlsx / .csv</p>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
          <button onClick={() => fileRef.current?.click()} disabled={busy}
            className="mt-4 w-full rounded-xl bg-sky-500 px-5 py-3 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50 sm:w-auto sm:py-2.5">
            {busy ? 'กำลังอ่านไฟล์…' : 'เลือกไฟล์'}
          </button>
        </div>
      ) : step === 2 && parsed ? (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <p className="text-sm font-semibold text-slate-700">จับคู่คอลัมน์ <span className="font-normal text-slate-400">({parsed.rows.length.toLocaleString()} แถว)</span></p>
          <div className="grid gap-3 sm:grid-cols-2">
            <ColSelect label="รหัสผู้ใช้น้ำ (Ref1) *" headers={parsed.headers} value={map.ref1} onChange={(v) => setMap((m) => ({ ...m, ref1: v }))} />
            <ColSelect label="งวด (Ref2) · ถ้ามี" headers={parsed.headers} value={map.ref2} onChange={(v) => setMap((m) => ({ ...m, ref2: v }))} optional />
            <ColSelect label="ยอดเงิน *" headers={parsed.headers} value={map.amount} onChange={(v) => setMap((m) => ({ ...m, amount: v }))} />
            <ColSelect label="วันที่ชำระ · ถ้ามี" headers={parsed.headers} value={map.date} onChange={(v) => setMap((m) => ({ ...m, date: v }))} optional />
          </div>
          {/* ตัวอย่างข้อมูล 5 แถวแรก — คอลัมน์ที่เลือกแล้วไฮไลต์สีฟ้า */}
          <div>
            <p className="mb-1.5 text-xs text-slate-400">ตัวอย่าง 5 แถวแรก</p>
            <TableCard className="shadow-none">
              <Table className="text-xs">
                <THead>{parsed.headers.map((h, i) => (
                  <Th key={i} className={`whitespace-nowrap px-3 py-2 normal-case ${[map.ref1, map.ref2, map.amount, map.date].includes(i) ? 'bg-sky-50 text-sky-700' : ''}`}>{h || `คอลัมน์ ${i + 1}`}</Th>
                ))}</THead>
                <tbody>{parsed.rows.slice(0, 5).map((r, ri) => (
                  <Tr key={ri}>{parsed.headers.map((_, ci) => <Td key={ci} className="whitespace-nowrap px-3 py-2 text-slate-600">{r[ci]}</Td>)}</Tr>
                ))}</tbody>
              </Table>
            </TableCard>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button onClick={reset} className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-500 hover:bg-slate-50 sm:order-2 sm:py-2.5">เริ่มใหม่</button>
            <button onClick={() => run(true)} disabled={busy} className="rounded-xl bg-sky-500 px-5 py-3 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50 sm:order-1 sm:py-2.5">
              {busy ? 'กำลังตรวจ…' : 'ตรวจสอบก่อน (พรีวิว)'}
            </button>
          </div>
        </div>
      ) : step === 3 && preview ? (
        <div className="space-y-4">
          <ResultView res={preview} onReset={reset} />
          <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              <p className="text-sm text-amber-800">
                ยังไม่ตัดชำระจริง — จะตัด <b>{preview.summary.settled}</b> รายการ · <b>{money(preview.summary.settledTotal)}</b> บาท และออกใบเสร็จให้อัตโนมัติ
              </p>
            </div>
            <button onClick={() => run(false)} disabled={busy || preview.summary.settled === 0}
              className="w-full shrink-0 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 sm:w-auto sm:py-2.5">
              {busy ? 'กำลังตัดชำระ…' : 'ยืนยันตัดชำระ'}
            </button>
          </div>
          <button onClick={() => setStep(2)} className="py-1 text-sm text-slate-500 hover:text-slate-700">← แก้การจับคู่</button>
        </div>
      ) : null}
    </div>
  );
}

function ColSelect({ label, headers, value, onChange, optional }: { label: string; headers: string[]; value: number; onChange: (v: number) => void; optional?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}
        className={`h-11 w-full rounded-lg border bg-white px-2.5 text-base outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 sm:h-10 sm:text-sm ${value >= 0 ? 'border-sky-300 text-slate-800' : 'border-slate-300 text-slate-500'}`}>
        <option value={-1}>{optional ? '— ไม่ใช้ —' : '— เลือกคอลัมน์ —'}</option>
        {headers.map((h, i) => <option key={i} value={i}>{h || `คอลัมน์ ${i + 1}`}</option>)}
      </select>
    </label>
  );
}

function ResultView({ res, committed, onReset }: { res: Result; committed?: boolean; onReset: () => void }) {
  const s = res.summary;
  const stats = [
    { label: committed ? 'ตัดชำระแล้ว' : 'จะตัดชำระ', value: s.settled, tone: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'จ่ายแล้ว (ข้าม)', value: s.alreadyPaid, tone: 'text-slate-500', bg: 'bg-slate-50' },
    { label: 'ยอดไม่ตรง', value: s.mismatch, tone: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'จับคู่ไม่ได้', value: s.unmatched, tone: 'text-rose-600', bg: 'bg-rose-50' },
  ];
  const problems = [...res.mismatch, ...res.unmatched].slice(0, 200);
  return (
    <div className="space-y-4">
      {committed && (
        <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 sm:flex-row sm:items-center">
          <span className="flex flex-1 items-start gap-2"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /> <span className="font-semibold">ตัดชำระแล้ว {s.settled} รายการ · {money(s.settledTotal)} บาท · ออกใบเสร็จแล้ว</span></span>
          <button onClick={onReset} className="flex items-center justify-center gap-1 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm text-emerald-700 hover:bg-emerald-100 sm:border-0 sm:bg-transparent sm:p-0 sm:hover:bg-transparent sm:hover:underline"><RefreshCw className="h-4 w-4" /> กระทบยอดไฟล์ใหม่</button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((st) => (
          <div key={st.label} className={`rounded-xl border border-slate-100 ${st.bg} p-3 sm:p-4`}>
            <p className="text-xs text-slate-500">{st.label}</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${st.tone}`}>{st.value.toLocaleString()}</p>
          </div>
        ))}
      </div>
      {problems.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-700">รายการที่ต้องตรวจเอง <span className="font-normal text-slate-400">({res.mismatch.length + res.unmatched.length})</span></p>
          {/* มือถือ: การ์ด · จอใหญ่: ตารางกลาง */}
          <div className="max-h-96 divide-y divide-slate-100 overflow-auto rounded-xl border border-slate-100 bg-white sm:hidden">
            {problems.map((r, i) => (
              <div key={i} className="px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm"><CodeChip>{r.ref1 || '—'}</CodeChip> {r.fullName && <span className="text-slate-600">{r.fullName}</span>}</span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-700">{money(r.amount)}</span>
                </div>
                <p className="mt-1 text-xs text-rose-600">{r.reason}</p>
              </div>
            ))}
          </div>
          <TableCard className="hidden sm:block">
            <div className="max-h-96 overflow-auto">
              <Table>
                <THead><Th>รหัส</Th><Th>ชื่อ</Th><Th align="right">ยอดจ่าย</Th><Th>สาเหตุ</Th></THead>
                <tbody>
                  {problems.map((r, i) => (
                    <Tr key={i}>
                      <Td><CodeChip>{r.ref1 || '—'}</CodeChip></Td>
                      <Td className="text-slate-600">{r.fullName || <Dash />}</Td>
                      <Td align="right" className="tabular-nums text-slate-700">{money(r.amount)}</Td>
                      <Td className="text-rose-600">{r.reason}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </TableCard>
        </div>
      )}
    </div>
  );
}
