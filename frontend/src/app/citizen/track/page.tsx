'use client';
import { Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, getErrorMessage } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Search, Clock, Smartphone } from 'lucide-react';
import { parseMyReports, readMyReportsRaw, subscribeMyReports } from '../my-reports';
import { BackLink } from '../cz-ui';

const STATUS: Record<string, { label: string; cls: string }> = {
  new: { label: 'รับเรื่องแล้ว (รอตรวจสอบ)', cls: 'bg-rose-100 text-rose-700' },
  in_progress: { label: 'กำลังดำเนินการ', cls: 'bg-blue-100 text-blue-700' },
  done: { label: 'ดำเนินการเสร็จสิ้น', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'ไม่รับพิจารณา', cls: 'bg-slate-200 text-slate-600' },
};

type Result = { refNo: string; category: string; status: string; staffNote?: string | null; createdAt: string };

const field = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100';
const dt = (d: string) => new Date(d).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });

export default function TrackPage() {
  return (
    <Suspense fallback={null}>
      <TrackForm />
    </Suspense>
  );
}

function TrackForm() {
  const searchParams = useSearchParams();
  const [refNo, setRefNo] = useState(''); // มาจากลิงก์ค้นด่วนที่หน้าแรกเท่านั้น (ไม่มีช่องให้พิมพ์เองแล้ว)
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);

  // แนะนำชื่อแบบเรียลไทม์ — พิมพ์แล้วรอ 1 วิค่อยยิง API กันถี่เกินไป
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (name.trim().length < 2) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get('/citizen/report/suggest-names', { params: { q: name.trim() } });
        setSuggestions(data.data || []);
      } catch { /* เดาไม่ได้ก็ไม่เป็นไร พิมพ์เองต่อได้ */ }
    }, 1000);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [name]);

  // เรื่องที่ส่งจากเครื่องนี้ (จำไว้ใน localStorage ตอนส่งสำเร็จ) — ไม่ต้องจำเลขอ้างอิงเอง กลับมาดูที่นี่ได้เลย
  const rawMine = useSyncExternalStore(subscribeMyReports, readMyReportsRaw, () => '');
  const mine = useMemo(() => parseMyReports(rawMine), [rawMine]);

  const run = async (fn: () => Promise<Result[]>) => {
    setLoading(true); setResults(null);
    try { setResults(await fn()); }
    catch (err) { toast.error(getErrorMessage(err, 'ไม่พบเรื่องนี้')); }
    finally { setLoading(false); }
  };

  const byRef = (r: string, p: string) => run(async () => {
    const { data } = await api.get('/citizen/report/status', { params: { refNo: r.trim(), phone: p.trim() } });
    return [data.data as Result];
  });

  // มาจาก widget ค้นด่วนที่หน้าแรก (/citizen/track?ref=...) — เติมเลขให้แล้วค้นให้เลย
  useEffect(() => {
    const r = searchParams.get('ref');
    if (r?.trim()) { setRefNo(r.trim()); void byRef(r.trim(), ''); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitName = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggest(false);
    if (!phone.trim() || !name.trim()) { toast.error('กรุณากรอกเบอร์โทรและชื่อ-สกุลให้ครบ'); return; }
    void run(async () => (await api.get('/citizen/report/mine', { params: { phone: phone.trim(), name: name.trim() } })).data.data as Result[]);
  };

  return (
    <div className="cz-anim-in mx-auto max-w-lg">
      <BackLink href="/citizen">กลับหน้าบริการ</BackLink>
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-br from-cyan-500 to-sky-600 text-white shadow-sm"><Search className="h-6 w-6" /></div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">ติดตามสถานะคำร้อง</h1>
          <p className="text-xs text-slate-500">ดูว่าเรื่องที่แจ้งไว้ดำเนินการถึงไหนแล้ว</p>
        </div>
      </div>

      {mine.length > 0 && (
        <section className="cz-anim-up mb-4 rounded-3xl border border-cyan-100 bg-white p-5 shadow-sm">
          <h2 className="mb-1 flex items-center gap-2 text-base font-bold text-slate-800"><Smartphone className="h-4 w-4 text-cyan-500" /> เรื่องที่ส่งจากเครื่องนี้</h2>
          <p className="mb-3 text-xs text-slate-400">แตะเรื่องที่ต้องการเพื่อดูสถานะล่าสุด</p>
          <div className="space-y-2">
            {mine.map((r) => (
              <button key={r.refNo} type="button" onClick={() => byRef(r.refNo, r.phone)} disabled={loading}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-100 px-4 py-3 text-left transition hover:border-cyan-300 disabled:opacity-60">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-700">{r.title}</span>
                </span>
                <span className="shrink-0 text-xs text-slate-400">{dt(r.at)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="cz-anim-up rounded-3xl border border-cyan-100 bg-white p-6 shadow-sm">
        <form onSubmit={submitName} className="space-y-3">
          <p className="text-xs text-slate-500">กรอกชื่อ-สกุลและเบอร์โทรให้ตรงกับที่แจ้งไว้ตอนยื่นเรื่อง จะแสดงทุกเรื่องที่ท่านเคยแจ้ง ไม่ต้องจำเลขอ้างอิง</p>
          <label className="relative block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">ชื่อ-สกุล</span>
            <input value={name}
              onChange={(e) => { setName(e.target.value); setShowSuggest(true); }}
              onFocus={() => setShowSuggest(true)}
              onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
              placeholder="เช่น สมชาย ใจดี" autoComplete="off" className={field} />
            {showSuggest && suggestions.length > 0 && (
              <div className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                {suggestions.map((s) => (
                  <button key={s} type="button" onMouseDown={() => { setName(s); setShowSuggest(false); }}
                    className="block w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-cyan-50">{s}</button>
                ))}
              </div>
            )}
          </label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">เบอร์โทรที่แจ้งไว้</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="เบอร์โทร" className={field} /></label>
          <button type="submit" disabled={loading} className="w-full rounded-xl bg-linear-to-r from-cyan-600 to-sky-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60">
            {loading ? 'กำลังค้นหา…' : 'ค้นหาเรื่องของฉัน'}
          </button>
        </form>
      </div>

      {results && (
        <div className="mt-4 space-y-3">
          {results.length > 1 && <p className="px-1 text-sm text-slate-500">พบ {results.length} เรื่อง</p>}
          {results.map((r) => (
            <div key={r.refNo} className="cz-anim-up rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-bold text-slate-900">{r.category}</h3>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS[r.status]?.cls || ''}`}>{STATUS[r.status]?.label || r.status}</span>
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400"><Clock className="h-3.5 w-3.5" /> ยื่นเมื่อ {dt(r.createdAt)}</p>
              {r.staffNote && <div className="mt-3 rounded-xl bg-cyan-50 p-3 text-sm text-slate-700"><b className="text-cyan-700">หมายเหตุจากเจ้าหน้าที่:</b> {r.staffNote}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
