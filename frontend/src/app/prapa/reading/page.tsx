'use client';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/water-api';
import { toast } from '@/hooks/use-toast';
import { MONTH_TH } from '@/lib/baht-text';
import { THAI_MONTHS_SHORT } from '@/lib/utils';
import { Search, Gauge, Check, X, Banknote, QrCode, Undo2, Printer, FileText, MapPin, Camera, WifiOff, RefreshCw, Phone, Home, Pencil, ChevronLeft } from 'lucide-react';
import { useCanManage } from '../use-can-manage';
import { printBill as printBillShared } from '@/lib/water-print';
import { QrPanel } from '../qr-panel';
import { SlipVerifyGate } from '../slip-verify-gate';
import { Pagination, usePaged } from '@/components/shared/pagination';
import { TableCard, Table, THead, Th, Td, Tr, Dash, CodeChip, StatusPill } from '@/components/shared/table';
import { cacheMembers, getCachedMembers, getQueue, queueReading, flushQueue } from '@/lib/water-offline';

const money = (n: any) => Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ISSUES: Record<string, string> = {
  normal: 'มาตรปกติ', broken: 'มาตรชำรุด', leak: 'น้ำรั่วภายใน',
  unreadable: 'หน้าปัดมองไม่เห็น', blocked: 'มีสิ่งกีดขวาง', other: 'อื่นๆ',
};
// ชื่อจากระบบเดิมมีเว้นวรรคซ้อน ("นางวีรยา  ดีแล้ว") → ยุบช่องว่างก่อนเทียบ
const norm = (s: any) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
/** บ้านเลขที่ = คำแรกของที่อยู่ ("219 ม.1" → "219") */
const houseNo = (address: any) => norm(address).split(' ')[0] || '';
type Filter = 'all' | 'unread' | 'read';

export default function PrapaReadingPage() {
  const qc = useQueryClient();
  const nowBE = new Date().getFullYear() + 543;
  const [year, setYear] = useState(nowBE);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [village, setVillageState] = useState<number | ''>('');
  // จำหมู่ที่จดค้างไว้ — ปิดแอป/ล็อกจอแล้วเปิดใหม่กลางทางไม่ต้องเลือกใหม่
  useEffect(() => { const v = Number(localStorage.getItem('prapa-reading-village')); if (v) setVillageState(v); }, []);
  const setVillage = (v: number | '') => {
    setVillageState(v);
    if (v) localStorage.setItem('prapa-reading-village', String(v)); else localStorage.removeItem('prapa-reading-village');
  };
  const [periodOpen, setPeriodOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  // ไม่เลือกหมู่ = ค้นจากทุกหมู่ที่เซิร์ฟเวอร์ (รอพิมพ์เสร็จก่อนค่อยค้น)
  const [globalTerm, setGlobalTerm] = useState('');
  useEffect(() => { const t = setTimeout(() => setGlobalTerm(norm(search)), 350); return () => clearTimeout(t); }, [search]);
  const globalMode = village === '' && globalTerm.length >= (/^[0-9/-]+$/.test(globalTerm) ? 1 : 2);
  const [active, setActive] = useState<any | null>(null);

  // ตั้งค่าเริ่มต้นงวดตาม "รอบบิลปัจจุบัน" ที่ admin ตั้งไว้ (ครั้งเดียว ไม่ทับหลังผู้ใช้เปลี่ยนเอง)
  const roundApplied = useRef(false);
  const { data: round } = useQuery({
    queryKey: ['water-round'],
    queryFn: async () => (await api.get('/water/billing/round')).data.data as { periodYear: number; periodMonth: number },
  });
  useEffect(() => {
    if (round && !roundApplied.current) {
      roundApplied.current = true;
      setYear(round.periodYear);
      setMonth(round.periodMonth);
    }
  }, [round]);

  const { data: routes } = useQuery({
    queryKey: ['prapa-routes', year, month],
    queryFn: async () => (await api.get('/water/billing/routes', { params: { year, month } })).data.data as any[],
  });
  const { data: rate } = useQuery({
    queryKey: ['water-rate'],
    queryFn: async () => (await api.get('/water/billing/rate')).data.data as any,
  });
  // ── ออฟไลน์ (พื้นที่สัญญาณไม่แน่นอน)
  const [online, setOnline] = useState(true);
  const [queueVer, setQueueVer] = useState(0); // bump เพื่อ recompute หลัง enqueue/sync
  useEffect(() => {
    const upd = () => setOnline(navigator.onLine);
    upd(); window.addEventListener('online', upd); window.addEventListener('offline', upd);
    return () => { window.removeEventListener('online', upd); window.removeEventListener('offline', upd); };
  }, []);

  const { data: membersRaw, isLoading } = useQuery({
    queryKey: ['prapa-members', village, year, month, globalMode ? globalTerm : ''],
    enabled: village !== '' || globalMode,
    queryFn: async () => {
      if (village === '') return (await api.get('/water/billing/members', { params: { year, month, search: globalTerm } })).data.data as any[];
      try {
        const d = (await api.get('/water/billing/members', { params: { year, month, villageNo: village } })).data.data as any[];
        cacheMembers(village as number, year, month, d); // เก็บ cache ไว้ใช้ตอนออฟไลน์
        return d;
      } catch (e) {
        const cached = getCachedMembers(village as number, year, month);
        if (cached) return cached; // ออฟไลน์ → ใช้ cache
        throw e;
      }
    },
    placeholderData: (p) => p,
  });

  // ซ้อนคิวที่จดออฟไลน์ (ยังไม่ sync) → มาร์กว่าจดแล้ว (รอ sync) กันจดซ้ำ
  const members = useMemo(() => {
    const q = getQueue();
    const byKey = new Map(q.map((x) => [`${x.customerId}-${x.year}-${x.month}`, x]));
    return (membersRaw || []).map((m) => {
      const qr = byKey.get(`${m.customerId}-${year}-${month}`);
      return qr && !m.readAt ? { ...m, readAt: new Date(qr.queuedAt).toISOString(), currReading: qr.currReading, _pending: true } : m;
    });
  }, [membersRaw, year, month, queueVer]);
  const pendingCount = useMemo(() => getQueue().filter((x) => x.year === year && x.month === month).length, [queueVer, year, month]);

  const doSync = async () => {
    if (!getQueue().length) return;
    const { ok, fail } = await flushQueue(async (r) => {
      await api.post('/water/billing/reading', { customerId: r.customerId, periodYear: r.year, periodMonth: r.month, currReading: r.currReading, issueType: r.issueType, phone: r.phone, gps: r.gps, note: r.note });
    });
    setQueueVer((v) => v + 1);
    qc.invalidateQueries({ queryKey: ['prapa-members'] }); qc.invalidateQueries({ queryKey: ['prapa-routes'] });
    if (ok) toast.success(`ซิงค์สำเร็จ ${ok} รายการ`);
    if (fail) toast.error(`ซิงค์ไม่สำเร็จ ${fail} รายการ — ลองใหม่`);
  };
  useEffect(() => { if (online) doSync(); /* auto-sync ตอนกลับมามีเน็ต */ }, [online]); // eslint-disable-line

  // ค้นหา = หาจากทุกสถานะ (ไม่ถูกปุ่มกรองบัง) · กติกาเดียวกับฝั่งเซิร์ฟเวอร์ (routeMembers)
  //   พิมพ์ตัวเลข → บ้านเลขที่ตรงตัว (8 ไม่ดึง 18/108 มา · 8/1 นับเป็นบ้าน 8) หรือรหัสตรงตัว หรือเบอร์ (4 หลักขึ้นไป)
  //   พิมพ์ตัวอักษร → ชื่อ/รหัสที่มีคำนั้น
  const matchRank = (m: any): number => {
    const s = norm(search);
    if (!s) return 1;
    if (/^[0-9/-]+$/.test(s)) {
      const house = houseNo(m.address);
      if (house === s) return 3;
      if (house.startsWith(s + '/')) return 2;
      const z = s.replace(/^0+/, '');
      if (z && String(m.customerCode || '').replace(/^0+/, '') === z) return 2;
      if (s.length >= 4 && String(m.phone || '').replace(/\D/g, '').includes(s)) return 1;
      return 0;
    }
    return norm(m.fullName).includes(s) || norm(m.customerCode).includes(s) ? 1 : 0;
  };
  const list = useMemo(() => {
    if (globalMode) return members || [];
    if (search.trim()) {
      return (members || []).map((m) => [m, matchRank(m)] as const).filter(([, r]) => r > 0)
        .sort((a, b) => b[1] - a[1]).map(([m]) => m);
    }
    return (members || []).filter((m) => filter === 'all' || (filter === 'read' ? !!m.readAt : !m.readAt));
  }, [members, filter, search, globalMode]); // eslint-disable-line
  // แบ่งหน้าละ 50 ราย (ทั้งการ์ดมือถือและตารางจอคอม) — เปลี่ยนหมู่/กรอง/ค้นหา = กลับหน้า 1
  const { rows, pager } = usePaged(list, 50, `${village}|${filter}|${search}|${year}|${month}`);
  const doneCount = (members || []).filter((m) => m.readAt).length;
  const collected = (members || []).filter((m) => m.status === 'paid').reduce((s, m) => s + Number(m.totalAmount || 0), 0);
  const outstanding = (members || []).filter((m) => m.readAt && m.status !== 'paid').reduce((s, m) => s + Number(m.totalAmount || 0), 0);
  const allRead = (members?.length ?? 0) > 0 && doneCount === members!.length;
  // เปิดบ้านถัดไปที่ยังไม่จด (จดรัวๆ ไม่ต้องปิด-เปิดทุกหลัง)
  const goNext = (current: any) => {
    const next = (members || []).find((m) => m.customerId !== current.customerId && !m.readAt);
    setActive(next || null);
    if (!next) toast.success('จดครบทุกรายในหมู่นี้แล้ว 🎉');
  };

  return (
    <div className="-mt-1 space-y-3">
      {/* แถบควบคุม ติดบนจอตอนเลื่อน — เดินจดมือเดียว ไม่ต้องเลื่อนกลับขึ้นไปค้น/กรอง */}
      <div className="sticky top-16 z-30 -mx-4 space-y-2 border-b border-slate-200/70 bg-slate-50/95 px-4 pb-2.5 pt-2 backdrop-blur lg:-mx-6 lg:flex lg:flex-wrap lg:items-center lg:gap-2 lg:space-y-0 lg:px-6 lg:py-3">
        <div className="flex items-center gap-2 lg:w-96">
          <select value={village} onChange={(e) => { setVillage(e.target.value ? Number(e.target.value) : ''); setSearch(''); }}
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-3 text-base font-semibold text-slate-800 lg:py-2 lg:text-sm">
            <option value="">เลือกหมู่ที่จะจด</option>
            {routes?.map((r) => <option key={r.villageNo} value={r.villageNo}>หมู่ {r.villageNo} · จดแล้ว {r.read}/{r.customers}</option>)}
          </select>
          <button onClick={() => setPeriodOpen((v) => !v)}
            className={`shrink-0 rounded-xl border px-3 py-3 text-sm font-medium lg:py-2 ${periodOpen ? 'border-sky-400 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-600'}`}>
            {THAI_MONTHS_SHORT[month]} {String(year).slice(2)}
          </button>
        </div>
        {periodOpen && (
          <div className="flex gap-2 lg:w-72">
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base">
              {Object.entries(MONTH_TH).map(([m, name]) => <option key={m} value={m}>{name}</option>)}
            </select>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base">
              {[nowBE + 1, nowBE, nowBE - 1].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}
        <div className="relative lg:min-w-64 lg:flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          {/* text-base (16px) — ต่ำกว่านี้ iPhone จะซูมหน้าจอตอนแตะช่อง */}
          <input type="text" inputMode="search" enterKeyHint="search" placeholder={village === '' ? 'ค้นทุกหมู่: ชื่อ / บ้านเลขที่ / รหัส / เบอร์' : 'ค้นชื่อ / บ้านเลขที่ / รหัส / เบอร์'}
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-10 text-base focus:border-sky-400 lg:py-2 lg:text-sm focus:outline-none" />
          {search && <button onClick={() => setSearch('')} aria-label="ล้างคำค้น" className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 text-slate-400"><X className="h-5 w-5" /></button>}
        </div>
        {village !== '' && !search.trim() && (
          <div className="grid grid-cols-3 gap-1.5 lg:flex">
            {([['all', 'ทั้งหมด', members?.length ?? 0], ['unread', 'ยังไม่จด', (members?.length ?? 0) - doneCount], ['read', 'จดแล้ว', doneCount]] as const).map(([k, label, n]) => (
              <button key={k} onClick={() => setFilter(k)}
                className={`rounded-xl border px-1 py-2.5 text-sm font-semibold transition lg:px-4 lg:py-2 ${filter === k ? 'border-sky-500 bg-sky-600 text-white' : 'border-slate-200 bg-white text-slate-600'}`}>
                {label} <span className="font-normal opacity-80">{n}</span>
              </button>
            ))}
          </div>
        )}
        {(!online || pendingCount > 0) && (
          <div className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium lg:w-full ${online ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-700'}`}>
            {online ? <RefreshCw className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            <span className="flex-1">{!online && 'ออฟไลน์ — จดต่อได้ ระบบเก็บไว้ในเครื่อง'}{!online && pendingCount > 0 && ' · '}{pendingCount > 0 && `รอส่ง ${pendingCount} รายการ`}</span>
            {online && pendingCount > 0 && <button onClick={doSync} className="rounded-lg bg-amber-600 px-3 py-1.5 text-white">ส่งเลย</button>}
          </div>
        )}
      </div>

      {village === '' && !globalMode ? (
        <div className="py-12 text-center text-slate-400">
          <Gauge className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-2 text-base">เลือกหมู่ที่จะจดด้านบน</p>
          <p className="text-sm">หรือพิมพ์ชื่อ / บ้านเลขที่ เพื่อค้นจากทุกหมู่</p>
        </div>
      ) : (
        <>
          {globalMode ? (
            <p className="px-1 text-sm text-slate-500">ผลค้นหาจากทุกหมู่ · {list.length} ราย{list.length >= 50 && ' (แสดง 50 รายแรก พิมพ์ให้เจาะจงขึ้น)'}</p>
          ) : (
            /* สรุปหมู่ — แถบความคืบหน้า + เก็บได้/ค้าง */
            <div className={`rounded-xl px-3 py-2.5 text-sm ${allRead ? 'bg-emerald-50 text-emerald-700' : 'bg-white text-slate-600 shadow-sm'}`}>
              <div className="flex items-center justify-between">
                <span>จดแล้ว <b className="text-base">{doneCount}</b>/{members?.length ?? 0}{allRead && ' ✓ ครบทั้งหมู่'}</span>
                <span className="text-xs text-slate-500">
                  เก็บได้ <b className="text-emerald-600">{money(collected)}</b>
                  {outstanding > 0 && <> · ค้าง <b className="text-rose-600">{money(outstanding)}</b></>}
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${members?.length ? (doneCount / members.length) * 100 : 0}%` }} />
              </div>
              {search.trim() && <p className="mt-1 text-xs text-slate-400">ผลค้นหาในหมู่ {village} (ทุกสถานะ)</p>}
            </div>
          )}

          {isLoading ? (
            <p className="py-10 text-center text-sm text-slate-400">กำลังโหลด...</p>
          ) : list.length === 0 ? (
            <p className="py-10 text-center text-base text-slate-400">{filter === 'unread' && !search.trim() && !globalMode ? 'จดครบทุกรายแล้ว 🎉' : 'ไม่พบผู้ใช้น้ำ'}</p>
          ) : (
            <>
            <div className="space-y-2 lg:hidden">
              {rows.map((m) => {
                const read = !!m.readAt, paid = m.status === 'paid';
                // ค้างเดือนก่อน ๆ (ไม่นับบิลเดือนนี้ที่แสดงฝั่งขวาแล้ว)
                const thisUnpaid = read && !paid ? 1 : 0;
                const oldCount = Math.max(0, (m.unpaidCount || 0) - thisUnpaid);
                const oldAmt = Math.max(0, Number(m.unpaidTotal || 0) - (thisUnpaid ? Number(m.totalAmount || 0) : 0));
                // บ้านเลขที่ตัวโตด้านซ้าย — เดินจดดูเลขหน้าบ้านแล้วจับคู่ได้ทันที ("219 ม.1" → "219")
                const hn = houseNo(m.address);
                return (
                  <button key={m.customerId} onClick={() => setActive(m)}
                    className={`flex w-full items-center gap-3 rounded-2xl border bg-white p-3 text-left shadow-sm transition active:scale-[.99] active:bg-slate-50 ${paid ? 'border-emerald-200' : read ? 'border-amber-200' : 'border-slate-100'}`}>
                    <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl ${paid ? 'bg-emerald-50 text-emerald-700' : read ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                      {hn ? (
                        <>
                          <span className="text-[10px] leading-none opacity-70">บ้านเลขที่</span>
                          <span className={`mt-0.5 max-w-13 truncate font-bold leading-tight ${hn.length > 5 ? 'text-xs' : 'text-base'}`}>{hn}</span>
                        </>
                      ) : paid ? <Check className="h-6 w-6" /> : <Gauge className="h-6 w-6" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold text-slate-900">{m.fullName}</p>
                      <p className="truncate text-sm text-slate-500">
                        <span className="font-mono">{m.customerCode}</span>
                        {globalMode && <> · หมู่ {m.villageNo}</>}
                        {' '}· มาตรก่อน <b className="font-medium text-slate-700">{m.prevReading}</b>
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                        {m.phone && <span className="inline-flex items-center gap-1 text-slate-500"><Phone className="h-3.5 w-3.5" />{m.phone}</span>}
                        {oldCount > 0 && <span className="rounded-full bg-rose-50 px-2 py-0.5 font-medium text-rose-600">ค้างเก่า {oldCount} เดือน · {money(oldAmt)}</span>}
                        {m.usageStatus && m.usageStatus !== '01' && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">ยกเลิกใช้น้ำ</span>}
                        {read && !paid && m.slipStatus === 'pending' && <span className="rounded-full bg-indigo-100 px-2 py-0.5 font-medium text-indigo-700">สลิปรอตรวจ</span>}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      {!read ? <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">ยังไม่จด</span>
                        : paid ? <span className="rounded-lg bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">จ่ายแล้ว</span>
                        : <span className="rounded-lg bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">ยังไม่จ่าย</span>}
                      {read && <p className="mt-1 text-sm font-semibold text-slate-700">{money(m.totalAmount)}</p>}
                      {read && <p className="text-[11px] text-slate-400">{m.units} หน่วย</p>}
                    </div>
                  </button>
                );
              })}
              <Pagination {...pager} unit="ราย" className="flex items-center justify-center gap-3 pt-2 text-sm" />
            </div>

            {/* จอคอม — ตารางกลาง (components/shared/table) หน้าตาเดียวกับทะเบียนผู้ใช้น้ำ */}
            <TableCard className="hidden lg:block">
              <Table>
                <THead>
                  <Th>บ้านเลขที่</Th><Th>รหัส</Th><Th>ชื่อ-สกุล</Th>{globalMode && <Th>หมู่</Th>}<Th>เบอร์โทร</Th>
                  <Th align="right">มาตรก่อน</Th><Th align="right">หน่วย</Th><Th align="right">ยอดเดือนนี้</Th><Th>สถานะ</Th><Th align="right">ค้างเก่า</Th>
                </THead>
                <tbody>
                  {rows.map((m) => {
                    const read = !!m.readAt, paid = m.status === 'paid';
                    const thisUnpaid = read && !paid ? 1 : 0;
                    const oldCount = Math.max(0, (m.unpaidCount || 0) - thisUnpaid);
                    const oldAmt = Math.max(0, Number(m.unpaidTotal || 0) - (thisUnpaid ? Number(m.totalAmount || 0) : 0));
                    const hn = houseNo(m.address);
                    return (
                      <Tr key={m.customerId} onClick={() => setActive(m)}>
                        <Td>{hn ? <span className={`inline-flex min-w-10 justify-center rounded-lg px-2 py-1 text-sm font-bold ${paid ? 'bg-emerald-50 text-emerald-700' : read ? 'bg-amber-50 text-amber-700' : 'bg-sky-50 text-sky-700'}`}>{hn}</span> : <Dash />}</Td>
                        <Td><CodeChip>{m.customerCode}</CodeChip></Td>
                        <Td className="font-medium text-slate-900">
                          {m.fullName}
                          {m.usageStatus && m.usageStatus !== '01' && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-normal text-slate-500">ยกเลิกใช้น้ำ</span>}
                          {read && !paid && m.slipStatus === 'pending' && <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-normal text-indigo-700">สลิปรอตรวจ</span>}
                        </Td>
                        {globalMode && <Td className="text-slate-500">หมู่ {m.villageNo}</Td>}
                        <Td className="text-slate-500">{m.phone || <Dash />}</Td>
                        <Td align="right" className="font-mono text-slate-600">{m.prevReading}</Td>
                        <Td align="right" className="font-mono text-slate-600">{read ? m.units : <Dash />}</Td>
                        <Td align="right" className="font-mono font-semibold text-slate-800">{read ? money(m.totalAmount) : <Dash />}</Td>
                        <Td><StatusPill tone={paid ? 'emerald' : read ? 'amber' : 'slate'}>{paid ? 'จ่ายแล้ว' : read ? 'ยังไม่จ่าย' : 'ยังไม่จด'}</StatusPill></Td>
                        <Td align="right">
                          {oldCount > 0
                            ? <span className="inline-flex rounded-md bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-600">{oldCount} เดือน · {money(oldAmt)}</span>
                            : <Dash />}
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
              <Pagination {...pager} unit="ราย" />
            </TableCard>
            </>
          )}
        </>
      )}

      {active && (
        <ReadingSheet key={active.customerId} member={active} year={year} month={month} rate={rate} online={online}
          onQueued={(r: any) => { queueReading(r); setQueueVer((v) => v + 1); }}
          onClose={() => setActive(null)} onNext={() => goNext(active)} />
      )}
    </div>
  );
}

const BIG = 'flex items-center justify-center gap-1.5 rounded-xl py-3.5 text-base font-semibold';   // ปุ่มหลัก
const LINK = 'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm';                        // งานรอง (ลิงก์เล็ก)

/** ปุ่มคู่พิมพ์เอกสาร: [พิมพ์ PT-210 | PDF] · ไม่มี onPrint = ปุ่ม PDF ปุ่มเดียว */
function DocButtons({ label, onPrint, onPdf }: { label: string; onPrint?: () => void; onPdf: () => void }) {
  if (!onPrint) return <button onClick={onPdf} className={`${BIG} w-full bg-sky-600 text-white hover:bg-sky-700`}><FileText className="h-4 w-4" /> {label}</button>;
  return (
    <div className="flex overflow-hidden rounded-xl border border-sky-600">
      <button onClick={onPrint} className={`${BIG} flex-1 rounded-none bg-sky-600 text-white hover:bg-sky-700`}><Printer className="h-4 w-4" /> {label}</button>
      <button onClick={onPdf} className="flex w-24 items-center justify-center gap-1 bg-white text-base font-medium text-sky-700 hover:bg-sky-50"><FileText className="h-4 w-4" /> PDF</button>
    </div>
  );
}

/** แผ่นจดมิเตอร์ → บันทึก → พิมพ์ใบแจ้งหนี้ → รับเงิน → ใบเสร็จ (bottom sheet, flow ตาม vendor jot5/jot7) */
function ReadingSheet({ member, year, month, rate, onClose, onNext, online = true, onQueued }: any) {
  const doSave = () => {
    if (online) { save.mutate(); return; }
    // ออฟไลน์: เข้าคิว + ข้ามไปหลังถัดไป (พิมพ์/เก็บเงินต้องออนไลน์)
    onQueued?.({ customerId: member.customerId, customerCode: member.customerCode, fullName: member.fullName, villageNo: member.villageNo, year, month, currReading: Number(curr), issueType: issue, phone: phone.trim() || undefined, gps: gps.trim() || undefined });
    toast.success('บันทึกออฟไลน์แล้ว (รอ sync ตอนมีเน็ต)');
    onNext?.();
  };
  const qc = useQueryClient();
  const canManage = useCanManage();
  const [curr, setCurr] = useState<string>(member.currReading != null && member.readAt ? String(member.currReading) : '');
  const [issue, setIssue] = useState('normal');
  const [phone, setPhone] = useState<string>(member.phone || '');
  const [gps, setGps] = useState<string>(member.gps || '');
  const [locating, setLocating] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [saved, setSaved] = useState<any | null>(null);   // บิลหลังบันทึก → เข้าขั้นพิมพ์ใบแจ้งหนี้
  const [payOpen, setPayOpen] = useState(false);
  const [justPaid, setJustPaid] = useState(false);
  const [method, setMethod] = useState('cash');
  const [receiptNo, setReceiptNo] = useState('');
  const [payChecked, setPayChecked] = useState<Record<string, boolean>>({});   // เลือกเดือนที่จะจ่าย
  const [verifyId, setVerifyId] = useState<string | null>(null);
  const autoVerify = !!rate?.slipVerifyConfigured;

  const unitPrice = Number(rate?.unitPrice ?? 4), serviceFee = Number(rate?.serviceFee ?? 5);
  const prev = member.prevReading ?? 0;
  const preview = useMemo(() => {
    if (curr === '') return null;
    const c = Number(curr), units = c >= prev ? c - prev : c;
    // ให้ตรงสูตรฝั่ง backend (computeCharges): tiered/ค่าธรรมเนียม/ภาษี ระดับเรต
    let water: number;
    const tiers = rate?.tiers as { from: number; to: number; price: number }[] | undefined;
    if (rate?.rateMode === 'tiered' && Array.isArray(tiers) && tiers.length) {
      water = 0;
      const sorted = [...tiers].sort((a, b) => Number(a.from) - Number(b.from));
      sorted.forEach((t, i) => {
        const to = i === sorted.length - 1 ? Infinity : Number(t.to);   // ขั้นสุดท้ายไม่มีเพดาน (ตรง backend)
        if (units >= t.from) water += (Math.min(units, to) - t.from + 1) * Number(t.price);
      });
    } else water = units * unitPrice;
    const taxable = water + serviceFee + Number(rate?.garbageFee ?? 0) + Number(rate?.wastewaterFee ?? 0);
    const total = taxable + taxable * Number(rate?.taxRate ?? 0) / 100;
    return { units, total };
  }, [curr, prev, unitPrice, serviceFee, rate]);

  const billId = member.billId || saved?.id;
  const paid = justPaid || member.status === 'paid';
  const [photoUp, setPhotoUp] = useState(false);
  const [hasPhoto, setHasPhoto] = useState<boolean>(!!member.meterPhotoUrl);
  const uploadPhoto = async (file: File) => {
    if (!billId) return;
    setPhotoUp(true);
    try { const fd = new FormData(); fd.append('file', file); await api.post(`/water/billing/${billId}/meter-photo`, fd); setHasPhoto(true); toast.success('บันทึกรูปมาตรแล้ว'); }
    catch (e) { toast.error(getErrorMessage(e, 'อัปโหลดรูปไม่สำเร็จ')); }
    finally { setPhotoUp(false); }
  };
  // จดแล้วแต่ยังไม่จ่าย → เปิดมาเจอขั้นพิมพ์ใบแจ้งหนี้/รับเงินเลย (กด "แก้เลขมิเตอร์" ถึงกลับไปกรอกใหม่)
  const [reEdit, setReEdit] = useState(false);
  const recorded = !!saved || (!!member.readAt && !!member.billId && !reEdit);
  const editing = !recorded && !paid && canManage;        // ยังกรอกเลขมิเตอร์อยู่ (ต้องมีสิทธิ์เขียน)
  const units = saved?.units ?? preview?.units ?? member.units ?? 0;
  const total = money(saved?.totalAmount ?? member.totalAmount ?? preview?.total ?? 0);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['prapa-members'] }); qc.invalidateQueries({ queryKey: ['prapa-routes'] }); qc.invalidateQueries({ queryKey: ['prapa-dash-mini'] }); };
  // บิลค้างของลูกค้ารายนี้ (ให้เลือกจ่ายหลายเดือน) — บังคับเลือกบิลที่จดวันนี้เสมอ
  const { data: custBills } = useQuery({
    queryKey: ['reading-unpaid', member.customerId, payOpen],
    enabled: !!member.customerId && payOpen,
    queryFn: async () => (await api.get(`/water/customers/${member.customerId}`)).data.data as any,
  });
  const unpaidBills = ((custBills?.bills) || []).filter((b: any) => b.status === 'unpaid');
  useEffect(() => { if (payOpen && billId) setPayChecked((p) => (billId in p ? p : { ...p, [billId]: true })); }, [payOpen, billId, unpaidBills.length]);
  const paySel = unpaidBills.filter((b: any) => payChecked[b.id] || b.id === billId);
  const payTotal = paySel.length
    ? paySel.reduce((s: number, b: any) => s + Number(b.totalAmount), 0)
    : Number(saved?.totalAmount ?? member.totalAmount ?? preview?.total ?? 0);
  useEffect(() => { setVerifyId(null); }, [payTotal, method]);   // ยอด/ช่องทางเปลี่ยน = ต้องตรวจสลิปใหม่

  const { data: qrData } = useQuery({
    queryKey: ['reading-qr-amount', payTotal],
    enabled: payOpen && method === 'qr' && payTotal > 0,
    queryFn: async () => (await api.get('/water/billing/qr-amount', { params: { amount: payTotal } })).data.data as any,
  });

  const save = useMutation({
    mutationFn: () => api.post('/water/billing/reading', { customerId: member.customerId, periodYear: year, periodMonth: month, currReading: Number(curr), issueType: issue, phone: phone.trim() || undefined, gps: gps.trim() || undefined }),
    onSuccess: (res) => { toast.success('บันทึกมิเตอร์แล้ว'); setSaved(res.data.data); refresh(); },
    onError: (e) => toast.error(getErrorMessage(e, 'บันทึกไม่สำเร็จ')),
  });
  // #3 จดไม่ได้วันนี้ (บ้านล็อก/มองไม่เห็น/มีของบัง) — บันทึกปัญหาโดยใช้เลขเดิม (0 หน่วย) แล้วข้ามไปหลังถัดไป
  const cantRead = useMutation({
    mutationFn: () => api.post('/water/billing/reading', {
      customerId: member.customerId, periodYear: year, periodMonth: month, currReading: prev,
      issueType: issue !== 'normal' ? issue : 'unreadable', phone: phone.trim() || undefined, gps: gps.trim() || undefined,
      note: `จดไม่ได้หน้างาน (${new Date().toLocaleDateString('th-TH')})`,
    }),
    onSuccess: () => { toast.success('บันทึก "จดไม่ได้" แล้ว — ข้ามไปหลังถัดไป'); refresh(); onNext?.(); },
    onError: (e) => toast.error(getErrorMessage(e, 'บันทึกไม่สำเร็จ')),
  });
  const pay = useMutation({
    mutationFn: () => api.post('/water/billing/pay-bills', {
      customerId: member.customerId, billIds: paySel.map((b: any) => b.id),
      payMethod: method, receiptNo: receiptNo || undefined, slipVerifyId: verifyId || undefined,
    }),
    onSuccess: () => { toast.success('รับชำระเงินแล้ว'); setJustPaid(true); setPayOpen(false); setVerifyId(null); refresh(); },
    onError: (e) => toast.error(getErrorMessage(e, 'รับชำระไม่สำเร็จ')),
  });
  const cancelPay = useMutation({
    mutationFn: (reason: string) => api.post(`/water/billing/${billId}/cancel-pay`, { reason }),
    onSuccess: () => { toast.success('ยกเลิกการรับชำระแล้ว'); refresh(); onClose(); },
    onError: (e) => toast.error(getErrorMessage(e, 'ยกเลิกไม่สำเร็จ')),
  });
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const openPdf = (kind: 'invoice' | 'receipt') => printBillShared(billId, kind, 'pdf');
  // พิมพ์ผ่าน RawBT → เครื่องพิมพ์ความร้อน 58mm (ตั้งค่า/แก้ปัญหาที่หน้า "ตั้งค่าเครื่องพิมพ์")
  const printRawBT = (kind: 'invoice' | 'receipt') => printBillShared(billId, kind, 'thermal');

  const btn = (on: boolean) => on ? 'border-sky-400 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-500';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="max-h-[95dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-3xl bg-white p-5 shadow-xl sm:max-h-[95dvh] sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200 sm:hidden" />
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-slate-900">{member.fullName}</h3>
            <p className="text-xs text-slate-400"><span className="font-mono">{member.customerCode}</span> · หมู่ {member.villageNo} · {MONTH_TH[month]} {year}</p>
            {(member.address || member.phone) && (
              <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
                {member.address && <span className="inline-flex items-center gap-1"><Home className="h-3.5 w-3.5" /> บ้านเลขที่ {member.address}</span>}
                {member.phone && <a href={`tel:${String(member.phone).replace(/[^0-9+]/g, '')}`} className="inline-flex items-center gap-1 text-sky-600"><Phone className="h-3.5 w-3.5" /> {member.phone}</a>}
              </p>
            )}
            {Number(member.unpaidCount) > 0 && member.status !== 'paid' && (
              <p className="mt-1 text-xs font-medium text-rose-600">ค้างชำระรวม {member.unpaidCount} เดือน · {money(member.unpaidTotal)} บาท</p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>

        {!payOpen && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-slate-50 p-3 text-center">
              <p className="text-xs text-slate-400">เลขมิเตอร์ครั้งก่อน</p>
              <p className="mt-1 text-4xl font-bold text-slate-400">{prev}</p>
            </div>
            <div className="rounded-2xl border-2 border-sky-200 bg-sky-50/40 p-3 text-center">
              <p className="text-xs text-sky-700">เลขมิเตอร์ครั้งนี้</p>
              <input type="number" inputMode="numeric" min={0} value={curr} autoFocus={editing} disabled={!editing}
                onChange={(e) => setCurr(e.target.value)} placeholder="0"
                className="mt-1 w-full bg-transparent text-center text-4xl font-bold text-sky-700 outline-none disabled:opacity-70" />
            </div>
          </div>
        )}

        {!payOpen && (preview || !editing) && (
          <div className={`mt-3 flex items-center justify-between rounded-2xl border px-4 py-3 ${paid ? 'border-emerald-200 bg-emerald-50' : 'border-sky-100 bg-sky-50'}`}>
            <span className="text-sm text-slate-600">ใช้ไป <b className="text-slate-900">{units}</b> หน่วย</span>
            <span className="flex items-center gap-2">
              {paid && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white"><Check className="h-3 w-3" /> จ่ายแล้ว</span>}
              <span className={`text-xl font-bold ${paid ? 'text-emerald-700' : 'text-sky-700'}`}>{total} บาท</span>
            </span>
          </div>
        )}
        {editing && curr !== '' && Number(curr) < prev && (
          <p className="mt-1.5 text-xs text-amber-600">⚠ เลขใหม่น้อยกว่าเลขเดิม — คิดเป็นมาตรวนกลับ/เปลี่ยนมาตร</p>
        )}
        {/* #2 เตือนค่าน้ำผิดปกติตอนกรอก — กันจดผิดตั้งแต่ต้นทาง */}
        {editing && curr !== '' && Number(curr) >= prev && (() => {
          const u = units;
          const pu = Number(member.prevUnits) || 0;
          let warn = '';
          if (u === 0) warn = 'มิเตอร์ไม่เดิน (0 หน่วย) — ตรวจว่ามาตรเสีย/บ้านร้างหรือไม่';
          else if (u > 100) warn = `ใช้น้ำสูงผิดปกติ (${u} หน่วย) — ตรวจเลขมิเตอร์อีกครั้ง`;
          else if (pu > 0 && Math.abs(u - pu) / pu >= 0.5) warn = `ต่างจากเดือนก่อนมาก (เดือนก่อน ${pu} หน่วย · เดือนนี้ ${u}) — ตรวจอีกครั้ง`;
          return warn ? <p className="mt-1.5 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs text-rose-600">⚠ {warn}</p> : null;
        })()}

        {editing && (
          <div className="mt-3">
            <label className="mb-1 block text-xs text-slate-500">สภาพมาตร</label>
            <select value={issue} onChange={(e) => setIssue(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-base">
              {Object.entries(ISSUES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        )}

        {/* เบอร์โทร + พิกัด — พับไว้ (ไม่ได้แก้ทุกบ้าน) จอมือถือจะได้เหลือแค่ช่องเลขมิเตอร์กับปุ่มบันทึก */}
        {editing && (
          <button type="button" onClick={() => setMoreOpen((v) => !v)}
            className="mt-2 flex w-full items-center justify-between rounded-xl border border-dashed border-slate-200 px-3 py-2.5 text-left text-sm text-slate-500">
            <span className="flex min-w-0 items-center gap-2">
              <Phone className="h-4 w-4 shrink-0" /><span className="truncate">{phone || 'ไม่มีเบอร์'}</span>
              <MapPin className="ml-1 h-4 w-4 shrink-0" /><span className="truncate">{gps ? 'มีพิกัด' : 'ไม่มีพิกัด'}</span>
            </span>
            <span className="shrink-0 text-sky-600">{moreOpen ? 'ซ่อน' : 'แก้ไข'}</span>
          </button>
        )}
        {editing && moreOpen && (
          <div className="mt-2">
            <label className="mb-1 block text-xs text-slate-500">เบอร์โทรเจ้าของบ้าน</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="08x-xxxxxxx"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-base focus:border-sky-400 focus:outline-none" />
          </div>
        )}

        {/* พิกัดมาตร GPS — ปักตอนจดหน้างาน (สะสมทำแผนที่ภายหลัง) */}
        {editing && moreOpen && (
          <div className="mt-2">
            <label className="mb-1 block text-xs text-slate-500">พิกัดมาตรวัดน้ำ (GPS)</label>
            <div className="flex gap-2">
              <input value={gps} onChange={(e) => setGps(e.target.value)} placeholder="lat,lng — เว้นว่างได้"
                className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-base focus:border-sky-400 focus:outline-none" />
              <button type="button" disabled={locating}
                onClick={() => {
                  if (!navigator.geolocation) { toast.error('อุปกรณ์ไม่รองรับ GPS'); return; }
                  setLocating(true);
                  navigator.geolocation.getCurrentPosition(
                    (p) => { setGps(`${p.coords.latitude.toFixed(6)},${p.coords.longitude.toFixed(6)}`); setLocating(false); toast.success('ปักพิกัดแล้ว'); },
                    () => { setLocating(false); toast.error('ดึงพิกัดไม่สำเร็จ — เปิดสิทธิ์ตำแหน่ง'); },
                    { enableHighAccuracy: true, timeout: 10000 },
                  );
                }}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-base font-medium text-sky-600 disabled:opacity-50">
                <MapPin className="h-4 w-4" /> {locating ? 'กำลังหา...' : 'ปักพิกัด'}
              </button>
            </div>
            {gps && <a href={`https://www.google.com/maps?q=${encodeURIComponent(gps)}`} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-sky-500 underline">ดูบนแผนที่</a>}
          </div>
        )}

        {/* ปุ่มจัดเป็น 3 ชั้น: งานหลักของขั้นนั้น (ปุ่มใหญ่) → พิมพ์เอกสาร (ปุ่มคู่) → งานรองเป็นลิงก์เล็กด้านล่าง */}
        {!canManage ? (
          <div className="mt-4 space-y-2">
            {paid && <DocButtons label="พิมพ์ใบเสร็จ" onPdf={() => openPdf('receipt')} />}
            {member.billId && !paid && <DocButtons label="พิมพ์ใบแจ้งหนี้" onPdf={() => openPdf('invoice')} />}
            <p className="text-center text-xs text-slate-400">โหมดดูอย่างเดียว — ไม่มีสิทธิ์บันทึก/รับเงิน</p>
          </div>
        ) : paid ? (
          <div className="mt-4 space-y-3">
            <DocButtons label="พิมพ์ใบเสร็จ" onPrint={() => printRawBT('receipt')} onPdf={() => openPdf('receipt')} />
            <button onClick={() => onNext?.()} className={`${BIG} w-full bg-emerald-600 text-white hover:bg-emerald-700`}>บ้านถัดไป →</button>
            {/* ยกเลิกการรับชำระ (กดรับผิดบ้าน/ยอดผิด) — ต้องใส่เหตุผล บันทึกไว้ตรวจสอบ */}
            {!cancelOpen ? (
              <div className="flex justify-center border-t border-slate-100 pt-2">
                <button onClick={() => setCancelOpen(true)} className={`${LINK} text-rose-600 hover:bg-rose-50`}>
                  <Undo2 className="h-4 w-4" /> ยกเลิกการรับชำระ
                </button>
              </div>
            ) : (
              <div className="space-y-2 rounded-2xl border border-rose-200 bg-rose-50 p-3">
                <p className="text-sm font-medium text-rose-700">ยกเลิกการรับชำระ {total} บาท?</p>
                <p className="text-xs text-rose-600">บิลนี้จะกลับเป็น &quot;ยังไม่จ่าย&quot; · เลขใบเสร็จเดิมจะไม่ถูกนำกลับมาใช้</p>
                <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} autoFocus
                  placeholder="เหตุผล เช่น กดรับเงินผิดบ้าน (จำเป็น)"
                  className="w-full rounded-xl border border-rose-200 bg-white px-3 py-2.5 text-base focus:border-rose-400 focus:outline-none" />
                <div className="flex gap-2">
                  <button onClick={() => cancelPay.mutate(cancelReason.trim())} disabled={!cancelReason.trim() || cancelPay.isPending}
                    className="flex-1 rounded-xl bg-rose-600 py-3 text-base font-semibold text-white disabled:opacity-50">
                    {cancelPay.isPending ? 'กำลังยกเลิก…' : 'ยืนยันยกเลิก'}
                  </button>
                  <button onClick={() => { setCancelOpen(false); setCancelReason(''); }} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">ไม่ยกเลิก</button>
                </div>
              </div>
            )}
          </div>
        ) : payOpen ? (
          <div className="mt-4 space-y-3">
            <button onClick={() => setPayOpen(false)} className={`${LINK} -ml-2 text-slate-500 hover:bg-slate-50`}><ChevronLeft className="h-4 w-4" /> กลับ</button>
            {/* เลือกเดือนที่จะจ่าย — เดือนที่จดวันนี้บังคับติ๊กเสมอ · เลือกเดือนค้างเพิ่มได้ */}
            {unpaidBills.length > 1 && (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-2.5">
                <p className="mb-1 px-1 text-xs font-medium text-slate-500">เลือกเดือนที่จะจ่าย</p>
                <div className="max-h-40 space-y-1 overflow-auto">
                  {unpaidBills.map((b: any) => {
                    const isCurrent = b.id === billId;
                    const on = payChecked[b.id] || isCurrent;
                    return (
                      <label key={b.id} className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm ${on ? 'bg-white' : ''}`}>
                        <input type="checkbox" checked={on} disabled={isCurrent} className="h-4 w-4"
                          onChange={(e) => setPayChecked((p) => ({ ...p, [b.id]: e.target.checked }))} />
                        <span className="flex-1 text-slate-700">{MONTH_TH[b.periodMonth]} {b.periodYear}{isCurrent && <span className="ml-1 text-[10px] text-sky-600">(จดวันนี้)</span>}</span>
                        <span className="font-mono text-slate-600">{money(b.totalAmount)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="flex items-baseline justify-between px-1">
              <span className="text-sm text-slate-500">ยอดรับชำระ{paySel.length > 1 ? ` (${paySel.length} เดือน)` : ''}</span>
              <span className="text-2xl font-bold text-slate-900">{money(payTotal)} <span className="text-base font-medium text-slate-500">บาท</span></span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setMethod('cash')} className={`flex items-center justify-center gap-1.5 rounded-xl border py-3 text-base ${btn(method === 'cash')}`}><Banknote className="h-4 w-4" /> เงินสด</button>
              <button onClick={() => setMethod('qr')} className={`flex items-center justify-center gap-1.5 rounded-xl border py-3 text-base ${btn(method === 'qr')}`}><QrCode className="h-4 w-4" /> QR/โอน</button>
            </div>
            {method === 'qr' && <QrPanel data={qrData} amount={payTotal} />}
            {/* จ่าย QR + เปิดตรวจสลิป → ต้องตรวจสลิปผ่านก่อนถึงกดยืนยันได้ */}
            {method === 'qr' && autoVerify && payTotal > 0 && (
              <SlipVerifyGate billIds={paySel.map((b: any) => b.id)} amount={payTotal} verifyId={verifyId}
                onVerified={(v) => setVerifyId(v?.verifyId || null)} />
            )}
            <input value={receiptNo} onChange={(e) => setReceiptNo(e.target.value)} placeholder="เลขที่ใบเสร็จ (ว่าง = รันอัตโนมัติ)"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-base focus:border-sky-400 focus:outline-none" />
            {(() => {
              const locked = method === 'qr' && autoVerify && !verifyId;
              return (
                <button onClick={() => pay.mutate()} disabled={pay.isPending || paySel.length === 0 || locked}
                  title={locked ? 'ต้องตรวจสลิปให้ผ่านก่อน' : ''}
                  className={`${BIG} w-full text-white disabled:opacity-60 ${locked ? 'cursor-not-allowed bg-slate-300' : 'bg-sky-600 hover:bg-sky-700'}`}>
                  <Check className="h-4 w-4" /> {locked ? 'รอตรวจสลิปก่อน' : `ยืนยันรับเงิน ${money(payTotal)} บาท`}
                </button>
              );
            })()}
          </div>
        ) : recorded ? (
          <div className="mt-4 space-y-3">
            <DocButtons label="พิมพ์ใบแจ้งหนี้" onPrint={() => printRawBT('invoice')} onPdf={() => openPdf('invoice')} />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setPayOpen(true)} className={`${BIG} border border-sky-300 bg-white text-sky-700 hover:bg-sky-50`}><Banknote className="h-4 w-4" /> รับเงิน</button>
              <button onClick={() => onNext?.()} className={`${BIG} bg-emerald-600 text-white hover:bg-emerald-700`}>บ้านถัดไป →</button>
            </div>
            <div className="flex flex-wrap justify-center gap-1 border-t border-slate-100 pt-2">
              <label className={`${LINK} cursor-pointer ${hasPhoto ? 'text-emerald-700 hover:bg-emerald-50' : 'text-slate-600 hover:bg-slate-50'}`}>
                <Camera className="h-4 w-4" /> {photoUp ? 'กำลังอัปโหลด…' : hasPhoto ? 'ถ่ายรูปมาตรแล้ว ✓' : 'ถ่ายรูปมาตร'}
                <input type="file" accept="image/*" capture="environment" className="hidden" disabled={photoUp}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = ''; }} />
              </label>
              <button onClick={() => { setSaved(null); setReEdit(true); }} className={`${LINK} text-slate-600 hover:bg-slate-50`}><Pencil className="h-4 w-4" /> แก้เลขมิเตอร์</button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <button onClick={doSave} disabled={curr === '' || Number(curr) < 0 || save.isPending}
              className={`${BIG} w-full bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-60`}>
              <Gauge className="h-4 w-4" /> {online ? (member.readAt ? 'บันทึกเลขใหม่' : 'บันทึกมิเตอร์') : 'บันทึกออฟไลน์'}
            </button>
            {(!member.readAt || reEdit) && (
              <div className="flex justify-center border-t border-slate-100 pt-2">
                {reEdit ? (
                  <button onClick={() => { setReEdit(false); setCurr(member.currReading != null ? String(member.currReading) : ''); }}
                    className={`${LINK} text-slate-600 hover:bg-slate-50`}><ChevronLeft className="h-4 w-4" /> ไม่แก้ ใช้เลขเดิม</button>
                ) : (
                  <button onClick={() => { if (confirm('บันทึกว่า "จดไม่ได้วันนี้" แล้วข้ามไปหลังถัดไป?\n(บ้านล็อก/มองไม่เห็น/มีของบัง — ใช้เลขเดิม 0 หน่วย ติดธงปัญหา)')) cantRead.mutate(); }}
                    disabled={cantRead.isPending} className={`${LINK} text-slate-500 hover:bg-slate-50`}>
                    จดไม่ได้วันนี้ (ข้ามบ้านนี้)
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
