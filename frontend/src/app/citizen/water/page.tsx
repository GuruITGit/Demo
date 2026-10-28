'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { MONTH_TH } from '@/lib/baht-text';
import { BackLink } from '../cz-ui';
import {
  Droplets, ArrowLeft, Download, ChevronRight, Home,
  ReceiptText, Gauge, AlertTriangle, Upload, Clock, RotateCcw, Search, Phone, Copy, Check,
} from 'lucide-react';

const money = (n: any) => Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const period = (y: number, m: number) => `${MONTH_TH[m]} ${String(y).slice(-2)}`;
// URL absolute ของ backend สำหรับเปิด PDF สาธารณะ — แนบ credential ที่มี (phone+house หรือ token)
const pdfUrl = (kind: 'invoice' | 'receipt', a: any, billId: string, phone: string, house: string, token?: string) =>
  `${api.defaults.baseURL}/water/member/${kind}?customerId=${a.customerId}&billId=${billId}&phone=${encodeURIComponent(phone)}&house=${encodeURIComponent(house)}${token ? `&token=${encodeURIComponent(token)}` : ''}`;

/**
 * ค่าน้ำประปา — บริการในพอร์ทัลประชาชน (/citizen) ดูยอด/จ่าย/ประวัติ (ข้อมูลจริง)
 * ล็อกอินหลัก = รหัสจากใบแจ้งหนี้ (สแกน QR หรือพิมพ์เอง) · สำรอง "จำรหัสไม่ได้" = เบอร์โทร + บ้านเลขที่ (ต้องตรงทั้งคู่)
 */

export default function CitizenWaterPage() {
  const [phone, setPhone] = useState('');   // credential เบอร์ (ทาง "จำรหัสไม่ได้")
  const [house, setHouse] = useState('');   // credential บ้านเลขที่ (คู่กับเบอร์)
  const [token, setToken] = useState('');   // credential รหัส 6 หลักจากใบแจ้งหนี้ (สแกน QR หรือพิมพ์เอง) — ทางหลัก
  const [tokenInput, setTokenInput] = useState(''); // ช่องกรอกรหัสจากใบแจ้งหนี้
  const [mode, setMode] = useState<'code' | 'phone'>('code');
  const [phoneInput, setPhoneInput] = useState('');
  const [houseInput, setHouseInput] = useState('');
  const [orgPhone, setOrgPhone] = useState('');
  const [accounts, setAccounts] = useState<any[] | null>(null);
  const [sel, setSel] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const onOk = (accts: any[], cred: { phone?: string; house?: string; token?: string }) => {
    setAccounts(accts);
    setPhone(cred.phone || '');
    setHouse(cred.house || '');
    setToken(cred.token || '');
    try { localStorage.setItem('checkbill-cred', JSON.stringify(cred)); } catch { /* ข้าม */ }
  };

  // รหัส 6 หลักชี้เฉพาะเจาะจง 1 บ้านเสมอ — ข้ามหน้าเลือกบ้านไปหน้าพร้อมจ่ายทันที ไม่ว่าจะมาจากสแกน QR / พิมพ์เอง / cache เดิม
  const lookupToken = async (t: string) => {
    setLoading(true);
    try {
      const { data } = await api.get('/water/member/lookup', { params: { token: t } });
      const accts: any[] = data.data.accounts;
      onOk(accts, { token: t });
      if (accts.length === 1) setSel(accts[0]);
    } catch (e) { toast.error(getErrorMessage(e, 'ไม่พบรหัสนี้ในระบบ')); setAccounts(null); }
    finally { setLoading(false); }
  };

  // จำรหัสไม่ได้ → เบอร์โทร + บ้านเลขที่ (backend บังคับตรงทั้งคู่ในบ้านเดียวกัน)
  const lookupPhone = async (p: string, h: string) => {
    setLoading(true);
    try {
      const { data } = await api.get('/water/member/lookup', { params: { phone: p, house: h } });
      const accts = data.data.accounts as NonNullable<typeof accounts>;
      onOk(accts, { phone: p, house: h });
      if (accts.length === 1) setSel(accts[0]);
    } catch (e) { toast.error(getErrorMessage(e, 'เบอร์โทรกับบ้านเลขที่ไม่ตรงกับข้อมูลในระบบ')); setAccounts(null); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    // สแกน QR จากใบแจ้งหนี้ (?t=รหัส) — เข้าหน้าพร้อมจ่ายทันที ไม่ต้องกรอกอะไรเลย ข้ามการอ่าน cache ด้านล่าง
    const fromQr = new URLSearchParams(window.location.search).get('t');
    if (fromQr?.trim()) { lookupToken(fromQr.trim()); return; }
    try {
      const saved = localStorage.getItem('checkbill-cred');
      if (saved?.trim()) {
        const c = JSON.parse(saved);
        if (c.token) { setTokenInput(c.token); lookupToken(c.token); }
        else if (c.phone && c.house) { setMode('phone'); setPhoneInput(c.phone); setHouseInput(c.house); lookupPhone(c.phone, c.house); }
      }
    } catch { /* ข้าม */ }
    api.get('/organizations/by-host').then((r) => { if (r.data?.data?.found) setOrgPhone(r.data.data.phone || ''); }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // หาบ้านอื่นของคนเดียวกัน (ชื่อเดียวกัน) — ใช้ได้เฉพาะหลังเข้าดูบ้านใดบ้านหนึ่งสำเร็จแล้ว (มี customerId ที่ verify แล้ว)
  // ใช้ที่อยู่ของบัญชีที่กำลังดูอยู่เป็น house cred เสมอ (ไม่ใช่ house ที่ค้นหาตอนแรก ซึ่งอาจเป็นคนละบ้าน)
  const findLinked = useMutation({
    mutationFn: async ({ customerId, accountHouse }: { customerId: string; accountHouse: string }) =>
      (await api.get('/water/member/linked', { params: { customerId, phone, house: accountHouse || house, token } })).data.data.accounts as any[],
    onSuccess: (found) => {
      let added = 0;
      setAccounts((prev) => {
        const base = prev || [];
        const ids = new Set(base.map((a: any) => a.customerId));
        const add = found.filter((a) => !ids.has(a.customerId));
        added = add.length;
        return add.length ? [...base, ...add] : base;
      });
      toast.success(added > 0 ? `พบเพิ่ม ${added} บ้าน` : 'ไม่พบบ้านอื่นเพิ่มเติม');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'ค้นหาไม่สำเร็จ')),
  });

  const logout = () => {
    setAccounts(null); setSel(null); setPhone(''); setHouse(''); setToken(''); setTokenInput('');
    setPhoneInput(''); setHouseInput(''); setMode('code');
    try { localStorage.removeItem('checkbill-cred'); } catch { /* ข้าม */ }
    // เคลียร์ ?t= ออกจาก URL ด้วย กันกดออกแล้วรีเฟรชหน้าวนกลับเข้าอัตโนมัติอีก
    try { window.history.replaceState(null, '', window.location.pathname); } catch { /* ข้าม */ }
  };

  return (
    <div className="cz-anim-in mx-auto max-w-3xl">
      <BackLink href="/citizen">กลับหน้าบริการ</BackLink>

      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-br from-cyan-500 to-sky-600 text-white shadow-sm">
          <Droplets className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">ค่าน้ำประปา</h1>
          <p className="text-xs text-slate-400">เช็คยอดค้าง · ประวัติใช้น้ำ · ชำระเงิน</p>
        </div>
      </div>

      {!accounts ? (
        <div className="cz-anim-up grid overflow-hidden rounded-2xl border border-cyan-100 bg-white shadow-sm lg:grid-cols-2">
          {/* แผงแบรนด์ + รูปชุมชน (จอใหญ่) */}
          <div className="relative hidden min-h-full flex-col justify-end overflow-hidden lg:flex">
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/login/citizen-bg.jpg')" }} aria-hidden="true" />
            <div className="absolute inset-0 bg-cyan-700/60" aria-hidden="true" />
            <div className="relative p-7 text-white">
              <p className="text-lg font-bold">บริการค่าน้ำ ออนไลน์</p>
              <p className="mt-1 text-sm leading-relaxed text-white/85">เช็คยอดค้าง · ดูประวัติใช้น้ำ · สแกน QR จ่าย — ทำเองได้ตลอด 24 ชม.</p>
            </div>
          </div>
          {/* ฟอร์มล็อกอิน — ทางหลัก: รหัสจากใบแจ้งหนี้ · สำรอง: เบอร์โทร + บ้านเลขที่ */}
          <div className="p-7 sm:p-8">
            {mode === 'code' ? (
              <form onSubmit={(e) => { e.preventDefault(); if (tokenInput.trim()) lookupToken(tokenInput.trim()); }} className="space-y-3">
                <p className="text-sm text-slate-500">กรอกรหัส 6 หลักที่พิมพ์ไว้บนใบแจ้งหนี้ (ใต้ QR โค้ด)</p>
                <div className="relative">
                  <ReceiptText className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input value={tokenInput} onChange={(e) => setTokenInput(e.target.value.toUpperCase())} autoFocus
                    placeholder="เช่น A3K9PX" maxLength={10}
                    className="h-12 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-center text-lg tracking-widest outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20" />
                </div>
                <button type="submit" disabled={loading || !tokenInput.trim()}
                  className="flex w-full items-center justify-center rounded-lg bg-cyan-600 py-3 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:opacity-60">
                  {loading ? 'กำลังตรวจสอบ...' : 'เข้าดูข้อมูล'}
                </button>
                <button type="button" onClick={() => setMode('phone')}
                  className="flex min-h-11 w-full items-center justify-center text-sm font-medium text-cyan-700 underline-offset-4 hover:underline">
                  จำรหัสไม่ได้? ใช้เบอร์โทรแทน
                </button>
              </form>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); if (phoneInput.trim() && houseInput.trim()) lookupPhone(phoneInput.trim(), houseInput.trim()); }} className="space-y-3">
                <p className="text-sm text-slate-500">กรอกเบอร์โทรที่แจ้งไว้กับ อบต. และบ้านเลขที่</p>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">เบอร์โทรศัพท์</span>
                  <span className="relative block">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input value={phoneInput} onChange={(e) => setPhoneInput(e.target.value.replace(/[^\d\s-]/g, '').slice(0, 15))} autoFocus
                      inputMode="tel" autoComplete="tel" placeholder="เช่น 0812345678"
                      className="h-12 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-base tracking-wide outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20" />
                  </span>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">บ้านเลขที่</span>
                  <span className="relative block">
                    <Home className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input value={houseInput} onChange={(e) => setHouseInput(e.target.value.slice(0, 30))}
                      placeholder="เช่น 18 หรือ 12/3"
                      className="h-12 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-base outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20" />
                  </span>
                </label>
                <button type="submit" disabled={loading || !phoneInput.trim() || !houseInput.trim()}
                  className="flex w-full items-center justify-center rounded-lg bg-cyan-600 py-3 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:opacity-60">
                  {loading ? 'กำลังตรวจสอบ...' : 'เข้าดูข้อมูล'}
                </button>
                <div className="rounded-lg bg-slate-50 px-3.5 py-3 text-xs leading-relaxed text-slate-500">
                  <p>ไม่ได้แจ้งเบอร์ไว้ หรือเปลี่ยนเบอร์แล้ว — ดูรหัสได้บนใบแจ้งหนี้/ใบเสร็จค่าน้ำ (ใต้ QR โค้ด){orgPhone ? ' หรือโทรสอบถาม อบต.' : ' หรือสอบถามที่ อบต.'}</p>
                  {orgPhone && <OrgPhone phone={orgPhone} />}
                </div>
                <button type="button" onClick={() => setMode('code')}
                  className="flex min-h-11 w-full items-center justify-center gap-1 text-sm font-medium text-cyan-700 underline-offset-4 hover:underline">
                  <ArrowLeft className="h-4 w-4" /> กลับไปกรอกรหัส
                </button>
              </form>
            )}
          </div>
        </div>
      ) : (
        <div className="cz-anim-up">
          <div className="mb-4 flex items-center justify-between rounded-2xl border border-cyan-100 bg-white px-4 py-2.5 shadow-sm">
            <span className="flex items-center gap-2 text-sm text-slate-600">
              {token
                ? <><ReceiptText className="h-4 w-4 text-cyan-600" /> เข้าถึงด้วยรหัสใบแจ้งหนี้</>
                : <><Phone className="h-4 w-4 text-cyan-600" /> เข้าถึงด้วยเบอร์โทร + บ้านเลขที่</>}
            </span>
            <button onClick={logout} className="flex items-center gap-1 rounded-full px-2 py-1 text-xs text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
              <RotateCcw className="h-3.5 w-3.5" /> ออก
            </button>
          </div>

          {!sel ? (
            <>
              <p className="mb-2 px-1 text-sm font-semibold text-slate-700">
                {accounts.length > 1 ? `เลือกบ้านที่จะจ่าย (${accounts.length} บ้าน)` : 'บ้าน/มิเตอร์ของคุณ'}
              </p>
              <div className="space-y-2">
                {accounts.map((a) => (
                  <AccountRow key={a.customerId} account={a} phone={phone} token={token} onSelect={() => setSel(a)} />
                ))}
              </div>
            </>
          ) : (
            <AccountDetail account={sel} phone={phone} house={house} token={token} onBack={() => setSel(null)}
              onFindLinked={() => findLinked.mutate({ customerId: sel.customerId, accountHouse: sel.address })} findingLinked={findLinked.isPending} />
          )}
        </div>
      )}
    </div>
  );
}

/** เบอร์ อบต. — แตะโทรได้ (มือถือ) + คัดลอก */
function OrgPhone({ phone }: { phone: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(phone); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { toast.error('คัดลอกไม่สำเร็จ'); }
  };
  return (
    <div className="mt-2 flex items-center gap-2">
      <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-1.5 font-semibold tabular-nums text-slate-700 hover:text-cyan-700">
        <Phone className="h-3.5 w-3.5" /> {phone}
      </a>
      <button type="button" onClick={copy} aria-label="คัดลอกเบอร์ อบต."
        className={`inline-flex h-8 items-center gap-1 rounded-full border px-2.5 font-medium transition ${copied ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600 hover:border-cyan-500 hover:text-cyan-700'}`}>
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'คัดลอกแล้ว' : 'คัดลอก'}
      </button>
    </div>
  );
}

const TABS = [
  { key: 'outstanding', label: 'ค้างชำระ' },
  { key: 'payments', label: 'ประวัติการชำระ' },
  { key: 'usage', label: 'ประวัติการใช้' },
] as const;

function AccountDetail({ account, phone, house, token, onBack, onFindLinked, findingLinked }: {
  account: any; phone: string; house: string; token: string; onBack: () => void; onFindLinked: () => void; findingLinked: boolean;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('outstanding');
  const h = account.address || house;
  return (
    <div>
      <button onClick={onBack} className="-ml-1 mb-2 flex items-center gap-1 rounded-lg px-1 py-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> กลับไปเลือกบ้าน
      </button>

      <div className="rounded-2xl border border-cyan-100 bg-white p-4 shadow-sm">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-slate-400">บ้านเลขที่</p>
            <p className="truncate text-2xl font-bold leading-tight text-slate-900">{account.address || '—'}</p>
          </div>
          {account.villageNo ? (
            <span className="shrink-0 rounded-full bg-cyan-50 px-3 py-1 text-sm font-semibold text-cyan-700">หมู่ {account.villageNo}</span>
          ) : null}
        </div>
        <p className="mt-2 truncate text-sm text-slate-600">
          {account.fullName} <span className="text-slate-300">·</span> <span className="font-mono text-xs text-slate-400">{account.customerCode}</span>
        </p>
      </div>

      <div className="mt-3 grid grid-cols-3 rounded-xl bg-slate-100 p-1 text-sm">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`rounded-lg py-2 transition ${tab === t.key ? 'bg-white font-semibold text-cyan-700 shadow-sm' : 'text-slate-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === 'outstanding' && <Outstanding account={account} phone={phone} house={h} token={token} />}
        {tab === 'payments' && <Payments account={account} phone={phone} house={h} token={token} />}
        {tab === 'usage' && <Usage account={account} phone={phone} house={h} token={token} />}
      </div>

      <button onClick={onFindLinked} disabled={findingLinked}
        className="mx-auto mt-6 flex items-center gap-1 text-xs text-slate-400 underline underline-offset-2 hover:text-cyan-600 disabled:opacity-50">
        <Search className="h-3.5 w-3.5" /> {findingLinked ? 'กำลังค้นหา...' : 'มีบ้านอื่นในชื่อเดียวกันไหม?'}
      </button>
    </div>
  );
}

function SummaryCards({ left, right }: { left: [string, string]; right: [string, string] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-2xl border border-slate-100 bg-white p-3 text-center shadow-sm">
        <p className="text-xs text-slate-400">{left[0]}</p>
        <p className="mt-1 text-2xl font-bold text-slate-800">{left[1]}</p>
      </div>
      <div className="rounded-2xl border border-slate-100 bg-white p-3 text-center shadow-sm">
        <p className="text-xs text-slate-400">{right[0]}</p>
        <p className="mt-1 text-2xl font-bold text-cyan-600">{right[1]}</p>
      </div>
    </div>
  );
}

function Loading() { return <p className="py-8 text-center text-sm text-slate-400">กำลังโหลด...</p>; }

/** การ์ดบ้านในลิสต์เลือกบ้าน — โชว์ยอดค้างของบ้านนั้นให้เห็นเลยว่าบ้านไหนต้องจ่าย ไม่ต้องคลิกเข้าไปเช็คทีละบ้าน */
function AccountRow({ account: a, phone, token, onSelect }: { account: any; phone: string; token?: string; onSelect: () => void }) {
  // ยืนยันตัวตนด้วยที่อยู่ของบ้านนั้นๆ เอง (ไม่ใช่ house ที่ใช้ค้นหาตอนแรก) — เพราะบ้านที่เจอเพิ่มจาก
  // "หาบ้านอื่นในชื่อเดียวกัน" มีที่อยู่คนละอันกับบ้านที่ค้นหาตอนแรก ถ้าใช้ house เดิมจะ assertOwner ไม่ผ่าน
  const { data } = useQuery({
    queryKey: ['cb-out-mini', a.customerId, phone, a.address, token],
    queryFn: async () => (await api.get('/water/member/outstanding', { params: { customerId: a.customerId, phone, house: a.address, token } })).data.data,
  });
  const total = data ? Number(data.total) : null;
  return (
    <button onClick={onSelect}
      className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-sm transition hover:border-cyan-300 active:scale-[.99]">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600"><Home className="h-5 w-5" /></div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-bold leading-tight text-slate-900">
          {a.address || '—'}{a.villageNo ? <span className="ml-2 text-sm font-semibold text-cyan-700">หมู่ {a.villageNo}</span> : null}
        </p>
        <p className="truncate text-sm text-slate-500">
          {a.fullName} <span className="text-slate-300">·</span> <span className="font-mono text-xs text-slate-400">{a.customerCode}</span>
        </p>
      </div>
      <div className="shrink-0 text-right">
        {total == null ? <span className="text-xs text-slate-300">…</span>
          : total > 0 ? <><p className="text-sm font-bold text-rose-600">{money(total)}</p><p className="text-[10px] text-rose-400">ค้างชำระ</p></>
          : <p className="text-xs font-medium text-emerald-600">ไม่ค้างชำระ</p>}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
    </button>
  );
}

function Outstanding({ account, phone, house, token }: any) {
  const { data, isLoading } = useQuery({
    queryKey: ['cb-out', account.customerId, phone, house, token],
    queryFn: async () => (await api.get('/water/member/outstanding', { params: { customerId: account.customerId, phone, house, token } })).data.data,
  });
  const d = data || {};
  const bills: any[] = d.bills || [];
  // เลือกเดือนที่จะจ่าย — ค่าเริ่มต้น: เลือกทุกเดือน (จ่ายทีเดียวได้ / ปลดออกเพื่อจ่ายทีละเดือน)
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [initDone, setInitDone] = useState(false);
  useEffect(() => {
    if (!initDone && bills.length) { const m: Record<string, boolean> = {}; bills.forEach((b) => (m[b.billId] = true)); setChecked(m); setInitDone(true); }
  }, [bills, initDone]);
  const sel = bills.filter((b) => checked[b.billId]);
  const selTotal = sel.reduce((s, b) => s + Number(b.totalAmount), 0);
  const allChecked = bills.length > 0 && bills.every((b) => checked[b.billId]);
  const toggleAll = () => {
    const next: Record<string, boolean> = {};
    bills.forEach((b) => (next[b.billId] = !allChecked));
    setChecked(next);
  };
  // QR ตามยอดที่เลือก (อัปเดตเมื่อยอดเปลี่ยน)
  const { data: qr } = useQuery({
    queryKey: ['cb-qr', account.customerId, phone, house, selTotal, token],
    enabled: selTotal > 0,
    queryFn: async () => (await api.get('/water/member/qr', { params: { customerId: account.customerId, phone, house, amount: selTotal, token } })).data.data,
  });

  if (isLoading) return <Loading />;
  return (
    <div className="space-y-3">
      <SummaryCards left={['ค้างชำระ', `${d.count || 0} บิล`]} right={['เลือกจ่าย', `${money(selTotal)}`]} />
      {d.count === 0 ? (
        <p className="py-8 text-center text-sm text-emerald-600">ไม่มีค้างชำระ 🎉</p>
      ) : (
        <>
          {/* เลือกบิลที่จะจ่าย */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <p className="text-sm font-semibold text-slate-600">เลือกบิลที่จะจ่าย</p>
              {bills.length > 1 && (
                <button onClick={toggleAll} className="text-xs font-medium text-cyan-600 underline underline-offset-2">
                  {allChecked ? 'ไม่เลือกเลย' : 'เลือกทั้งหมด'}
                </button>
              )}
            </div>
            {bills.map((b: any) => (
              <div key={b.billId} className={`rounded-2xl border p-3.5 transition ${checked[b.billId] ? 'border-cyan-300 bg-cyan-50/50' : 'border-slate-100 bg-white'}`}>
                <label className="flex cursor-pointer items-center gap-3">
                  <input type="checkbox" checked={!!checked[b.billId]} onChange={(e) => setChecked((p) => ({ ...p, [b.billId]: e.target.checked }))}
                    className="h-5 w-5 shrink-0 accent-cyan-600" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">ประจำเดือน {period(b.periodYear, b.periodMonth)}</p>
                    <p className="text-xs text-slate-400">มิเตอร์ {b.prevReading} → {b.currReading} · ใช้ {b.units} หน่วย</p>
                  </div>
                  <p className="text-lg font-bold text-cyan-600">{money(b.totalAmount)}</p>
                </label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <a href={pdfUrl('invoice', account, b.billId, phone, house, token)} target="_blank" rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-cyan-200 py-2 text-sm font-medium text-cyan-700">
                    <Download className="h-4 w-4" /> ใบแจ้งหนี้
                  </a>
                  <SlipStatusBadge bill={b} />
                </div>
                {b.slipStatus === 'rejected' && b.slipNote && (
                  <p className="mt-1.5 text-xs text-rose-600">สลิปถูกปฏิเสธ: {b.slipNote} — ติ๊กเลือกแล้วแนบใหม่ด้านล่าง</p>
                )}
              </div>
            ))}
          </div>

          {/* การ์ดจ่ายเงิน — ข้อความบรรทัดแรกบอกตรงๆ ว่า "โอนครั้งเดียว" ครอบคลุมทุกบิลที่ติ๊กไว้ กันงงว่าทำไมแนบสลิปใบเดียวได้ */}
          {selTotal > 0 && (
            <div className="rounded-2xl border border-cyan-200 bg-white p-5 text-center">
              <p className="text-sm text-slate-500">
                {sel.length > 1 ? `รวม ${sel.length} บิล — โอนครั้งเดียวจบ` : 'สแกนจ่ายผ่านแอปธนาคาร'}
              </p>
              <p className="mt-1 text-3xl font-bold text-cyan-700">{money(selTotal)} <span className="text-base font-normal text-slate-400">บาท</span></p>
              {qr?.qr ? (
                <>
                  <img src={qr.qr} alt="QR พร้อมเพย์" className="mx-auto my-3 h-48 w-48" />
                  <p className="text-xs text-slate-400">โอนเข้า {qr.payeeName || 'พร้อมเพย์ อบต.'}</p>
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <p className="mb-2 text-xs text-slate-500">
                      {sel.length > 1
                        ? `โอนเสร็จแล้วแนบรูปสลิปแค่ 1 ใบ — ใช้ยืนยันได้ทั้ง ${sel.length} บิลที่เลือกไว้`
                        : 'โอนเสร็จแล้วแนบรูปสลิปเพื่อยืนยัน'}
                    </p>
                    <GroupSlipUpload account={account} phone={phone} house={house} token={token} billIds={sel.map((b: any) => b.billId)} />
                  </div>
                </>
              ) : <p className="mt-3 text-xs text-slate-400">กำลังสร้าง QR...</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** badge สถานะสลิปต่อบิล (อ่านอย่างเดียว) — ปุ่มอัปโหลดย้ายไปรวมจุดเดียวที่ GroupSlipUpload ใกล้ QR แล้ว
 *  เพราะจ่ายหลายบิลพร้อมกันด้วย QR รวม ต้องแนบสลิปใบเดียวสำหรับทั้งกลุ่ม ไม่ใช่แนบทีละบิล (เคยพังตรงนี้) */
function SlipStatusBadge({ bill }: any) {
  if (bill.slipStatus === 'verified') {
    return (
      <div className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 py-2 text-sm font-medium text-emerald-700">
        <Clock className="h-4 w-4" /> ตรวจสลิปผ่านแล้ว รอออกใบเสร็จ
      </div>
    );
  }
  if (bill.slipStatus === 'pending') {
    return (
      <div className="flex items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 py-2 text-sm font-medium text-amber-700">
        <Clock className="h-4 w-4" /> รอตรวจสลิป
      </div>
    );
  }
  return null;
}

/** ปุ่มแนบสลิป 1 ใบสำหรับทุกบิลที่ติ๊กเลือกไว้ตอนนี้ (จ่ายรวมด้วย QR เดียวกัน) — label ครอบ input กันบางเบราว์เซอร์กดไม่ติด */
function GroupSlipUpload({ account, phone, house, token, billIds }: { account: any; phone: string; house: string; token?: string; billIds: string[] }) {
  const qc = useQueryClient();
  const upload = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.post('/water/member/slip', fd, { params: { customerId: account.customerId, billIds: billIds.join(','), phone, house, token } });
    },
    onSuccess: (res: any) => {
      const st = res?.data?.data?.status;
      if (st === 'verified') toast.success('ตรวจสอบสลิปผ่านแล้ว รอเจ้าหน้าที่ออกใบเสร็จ');
      else toast.success('ส่งสลิปแล้ว รอเจ้าหน้าที่ตรวจสอบ');
      qc.invalidateQueries({ queryKey: ['cb-out'] });
    },
    onError: (e) => toast.error(getErrorMessage(e, 'อัปโหลดสลิปไม่สำเร็จ')),
  });
  if (!billIds.length) return null;
  return (
    <label className={`flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm font-medium ${upload.isPending ? 'border-slate-200 text-slate-400' : 'border-emerald-300 text-emerald-700'}`}>
      <Upload className="h-4 w-4" /> {upload.isPending ? 'กำลังส่ง...' : 'แนบสลิปยืนยันการโอน'}
      <input type="file" accept="image/*" className="hidden" disabled={upload.isPending}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ''; }} />
    </label>
  );
}

function Payments({ account, phone, house, token }: any) {
  const { data, isLoading } = useQuery({
    queryKey: ['cb-pay', account.customerId, phone, house, token],
    queryFn: async () => (await api.get('/water/member/payments', { params: { customerId: account.customerId, phone, house, token } })).data.data,
  });
  if (isLoading) return <Loading />;
  const d = data || {};
  return (
    <div className="space-y-3">
      <SummaryCards left={['จำนวน', `${d.count || 0} บิล`]} right={['รวมเป็นเงิน', `${money(d.total)}`]} />
      {d.count === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">ยังไม่มีประวัติการชำระ</p>
      ) : (
        <div className="space-y-2">
          {d.bills?.map((b: any) => (
            <div key={b.billId} className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">ประจำเดือน {period(b.periodYear, b.periodMonth)}</p>
                  <p className="text-xs text-slate-400">
                    {b.paidAt ? new Date(b.paidAt).toLocaleDateString('th-TH') : ''}{b.receiptNo ? ` · ใบเสร็จ ${b.receiptNo}` : ''}
                  </p>
                </div>
                <p className="text-lg font-bold text-emerald-600">{money(b.totalAmount)}</p>
              </div>
              <a href={pdfUrl('receipt', account, b.billId, phone, house, token)} target="_blank" rel="noreferrer"
                className="mt-2 flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 py-2 text-sm font-medium text-emerald-700">
                <ReceiptText className="h-4 w-4" /> ใบเสร็จรับเงิน
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Usage({ account, phone, house, token }: any) {
  const { data, isLoading } = useQuery({
    queryKey: ['cb-use', account.customerId, phone, house, token],
    queryFn: async () => (await api.get('/water/member/usage', { params: { customerId: account.customerId, phone, house, token } })).data.data,
  });
  if (isLoading) return <Loading />;
  const d = data || {};
  const rows: any[] = d.rows || [];                       // ใหม่→เก่า
  const units = rows.map((r) => Number(r.units));
  const avg = units.length ? units.reduce((s, u) => s + u, 0) / units.length : 0;
  // "สูงผิดปกติ" = มากกว่าค่าเฉลี่ยตัวเอง 1.5 เท่า และ >= 25 หน่วย (กันเตือนพร่ำเพรื่อ)
  const isHigh = (u: number) => avg > 0 && u >= 25 && u > avg * 1.5;
  const latestHigh = rows[0] && isHigh(Number(rows[0].units));
  const graph = rows.slice(0, 12).reverse();              // เก่า→ใหม่ สำหรับกราฟ
  const maxU = Math.max(1, ...graph.map((r) => Number(r.units)));

  return (
    <div className="space-y-3">
      <SummaryCards left={['จำนวน', `${d.count || 0} บิล`]} right={['รวมหน่วย', `${d.totalUnits || 0}`]} />

      {latestHigh && (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50/70 p-3.5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
          <div>
            <p className="text-sm font-semibold text-rose-700">เดือนล่าสุดใช้น้ำสูงกว่าปกติ</p>
            <p className="text-xs text-rose-600">ใช้ {rows[0].units} หน่วย (เฉลี่ยของคุณ ~{avg.toFixed(0)} หน่วย) — อาจมีท่อรั่ว/ก๊อกปิดไม่สนิท แนะนำตรวจสอบมิเตอร์และท่อภายในบ้าน</p>
          </div>
        </div>
      )}

      {graph.length > 1 && (
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-medium text-slate-700">การใช้น้ำย้อนหลัง {graph.length} เดือน (หน่วย)</p>
          <div className="flex items-end gap-1.5" style={{ minHeight: 100 }}>
            {graph.map((r) => {
              const u = Number(r.units), high = isHigh(u);
              return (
                <div key={r.billId} className="flex flex-1 flex-col items-center gap-1">
                  <span className={`text-[10px] font-medium ${high ? 'text-rose-500' : 'text-slate-400'}`}>{u}</span>
                  <div className={`w-full rounded-t ${high ? 'bg-rose-400' : 'bg-cyan-400'}`} style={{ height: `${Math.max(4, (u / maxU) * 80)}px` }} />
                  <span className="text-[9px] text-slate-400">{MONTH_TH[r.periodMonth].slice(0, 3)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {d.count === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">ยังไม่มีประวัติการใช้น้ำ</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r: any) => {
            const high = isHigh(Number(r.units));
            return (
              <div key={r.billId} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${high ? 'bg-rose-50 text-rose-500' : 'bg-cyan-50 text-cyan-600'}`}><Gauge className="h-4 w-4" /></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900">เดือน {period(r.periodYear, r.periodMonth)}</p>
                  <p className="text-xs text-slate-400">จดก่อน {r.prevReading} · จดหลัง {r.currReading}</p>
                </div>
                <p className={`text-sm font-semibold ${high ? 'text-rose-600' : 'text-cyan-600'}`}>ใช้ {r.units} หน่วย{high ? ' ⚠' : ''}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
