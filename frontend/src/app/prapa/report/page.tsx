'use client';
import { useState, useMemo, useEffect, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/water-api';
import { MONTH_TH } from '@/lib/baht-text';
import { ClipboardList, FileSpreadsheet, Printer, Users2 } from 'lucide-react';
import { PageHeader, StatCard, Tabs, controlBase, btn } from '../ui';

const money = (n: any) => Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const int = (n: any) => Number(n || 0).toLocaleString('th-TH');

async function fetchBlob(url: string, params: any) {
  const res = await api.get(url, { params, responseType: 'blob' });
  return res.data as Blob;
}
async function openPdf(url: string, params: any) {
  const u = URL.createObjectURL(await fetchBlob(url, params));
  window.open(u, '_blank');
  setTimeout(() => URL.revokeObjectURL(u), 60000);
}
async function downloadXlsx(url: string, params: any, name: string) {
  const u = URL.createObjectURL(await fetchBlob(url, params));
  const a = document.createElement('a');
  a.href = u; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(u), 60000);
}

const TABS = [
  { key: 'overview', label: 'ภาพรวมการเก็บเงิน' },
  { key: 'ar', label: 'บัญชีลูกหนี้ (ป.17)' },
  { key: 'p31', label: 'อ่านมาตร (ป.31)' },
  { key: 'p32', label: 'เงินรายรับ (ป.32)' },
  { key: 'vat', label: 'ภาษีขาย (VAT)' },
  { key: 'usage', label: 'การใช้น้ำ' },
] as const;
type TabKey = typeof TABS[number]['key'];

export default function PrapaReportPage() {
  const nowBE = new Date().getFullYear() + 543;
  const [tab, setTab] = useState<TabKey>('overview');
  // เปิดแท็บจากลิงก์ได้ เช่น /prapa/report?tab=p32 (ปุ่ม "เปิดรายงาน ป.32" ในหน้ารอบบิล)
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t && TABS.some((x) => x.key === t)) setTab(t as TabKey);
  }, []);
  const [year, setYear] = useState(nowBE);
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader icon={ClipboardList} iconClass="text-amber-500" title="รายงานกองการประปา" desc="เลือกงวด แล้วเลือกรายงานที่ต้องการ" />
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={`${controlBase} px-3 sm:w-36`}>
            {Object.entries(MONTH_TH).map(([m, name]) => <option key={m} value={m}>{name}</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={`${controlBase} px-3 sm:w-28`}>
            {[nowBE + 1, nowBE, nowBE - 1, nowBE - 2].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="-mx-4 flex gap-1 overflow-x-auto border-b border-slate-100 px-4 sm:mx-0 sm:px-0">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition sm:py-2 ${tab === t.key ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab year={year} month={month} />}
      {tab === 'ar' && <ArTab year={year} month={month} />}
      {tab === 'p31' && <P31Tab year={year} month={month} />}
      {tab === 'p32' && <P32Tab year={year} month={month} />}
      {tab === 'vat' && <VatTab year={year} month={month} />}
      {tab === 'usage' && <UsageTab year={year} month={month} />}
    </div>
  );
}

// ─────────────────────────────── ภาพรวมการเก็บเงิน (เดิม)
function OverviewTab({ year, month }: { year: number; month: number }) {
  const { data: routes, isLoading } = useQuery({
    queryKey: ['prapa-routes', year, month],
    queryFn: async () => (await api.get('/water/billing/routes', { params: { year, month } })).data.data as any[],
  });
  const sum = useMemo(() => {
    const r = routes || [];
    return {
      customers: r.reduce((s, x) => s + Number(x.customers || 0), 0),
      read: r.reduce((s, x) => s + Number(x.read || 0), 0),
      paid: r.reduce((s, x) => s + Number(x.paid || 0), 0),
      collected: r.reduce((s, x) => s + Number(x.collected || 0), 0),
    };
  }, [routes]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">งวด <span className="font-medium text-slate-800">{MONTH_TH[month]} {year}</span></p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="เก็บได้ทั้งงวด" value={money(sum.collected)} unit="บาท" tone="text-emerald-600" />
        <StatCard label="รับชำระแล้ว" value={String(sum.paid)} unit="ราย" tone="text-slate-900" />
        <StatCard label="จดแล้ว" value={String(sum.read)} unit="ราย" tone="text-sky-600" />
        <StatCard label="ยังไม่จ่าย" value={String(sum.read - sum.paid)} unit="ราย" tone="text-amber-600" />
      </div>
      <Card title="แยกรายหมู่">
        {isLoading ? <Loading /> : (
          <Table head={['หมู่', 'ผู้ใช้น้ำ', 'จด', 'เก็บแล้ว', 'เก็บได้ (บาท)']} align={['l', 'l', 'r', 'r', 'r']}>
            {(routes || []).map((r) => (
              <tr key={r.villageNo}>
                <td className="py-2 pr-3 font-medium text-slate-700">หมู่ {r.villageNo}</td>
                <td className="py-2 pr-3 text-slate-500">{r.customers}</td>
                <td className="py-2 pr-3 text-right text-sky-600">{r.read}</td>
                <td className="py-2 pr-3 text-right text-emerald-600">{r.paid}</td>
                <td className="py-2 pl-3 text-right font-mono text-slate-800">{money(r.collected)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-100 font-semibold">
              <td className="py-2 pr-3 text-slate-700">รวม</td>
              <td className="py-2 pr-3 text-slate-500">{sum.customers}</td>
              <td className="py-2 pr-3 text-right text-sky-600">{sum.read}</td>
              <td className="py-2 pr-3 text-right text-emerald-600">{sum.paid}</td>
              <td className="py-2 pl-3 text-right font-mono text-emerald-700">{money(sum.collected)}</td>
            </tr>
          </Table>
        )}
      </Card>
    </div>
  );
}

// ─────────────────────────────── ป.17 บัญชีลูกหนี้
function ArTab({ year, month }: { year: number; month: number }) {
  const [mode, setMode] = useState<'period' | 'outstanding'>('period');
  const [villageNo, setVillageNo] = useState('');
  const [busy, setBusy] = useState('');
  const params = { year, month, mode, villageNo: villageNo || undefined };

  const { data: villages } = useQuery({
    queryKey: ['water-villages'],
    queryFn: async () => (await api.get('/water/customers/villages')).data.data as any[],
  });
  const { data, isLoading } = useQuery({
    queryKey: ['prapa-ar', year, month, mode, villageNo],
    queryFn: async () => (await api.get('/water/report/ar', { params })).data.data as any,
  });
  const t = data?.totals;

  const run = async (kind: 'excel' | 'pdf') => {
    setBusy(kind);
    try {
      if (kind === 'excel') await downloadXlsx('/water/report/ar/excel', params, `บัญชีลูกหนี้ค่าน้ำ-ป17-${month}-${year}.xlsx`);
      else await openPdf('/water/report/ar/pdf', params);
    } finally { setBusy(''); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs items={[{ key: 'period', label: 'งวดนี้' }, { key: 'outstanding', label: 'ค้างสะสม' }]} value={mode} onChange={setMode} />
        <select value={villageNo} onChange={(e) => setVillageNo(e.target.value)} className={`${controlBase} px-3`}>
          <option value="">ทุกหมู่</option>
          {villages?.map((v) => <option key={v.villageNo} value={v.villageNo}>หมู่ {v.villageNo}</option>)}
        </select>
        <div className="ml-auto flex gap-2">
          <ExportBtn onClick={() => run('excel')} busy={busy === 'excel'} icon={FileSpreadsheet} label="Excel" />
          <ExportBtn onClick={() => run('pdf')} busy={busy === 'pdf'} icon={Printer} label="PDF" />
        </div>
      </div>
      <p className="text-sm text-slate-500">
        {mode === 'outstanding' ? 'ยอดค้างชำระสะสม ณ งวด' : 'ประจำงวด'} <span className="font-medium text-slate-800">{MONTH_TH[month]} {year}</span>
      </p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="ลูกหนี้" value={int(t?.debtors)} unit="ราย" tone="text-rose-600" />
        <StatCard label="ค้างชำระรวม" value={money(t?.outstanding)} unit="บาท" tone="text-rose-600" />
        {mode === 'period' && <StatCard label="ตั้งเก็บ" value={money(t?.billed)} unit="บาท" tone="text-slate-900" />}
        {mode === 'period' && <StatCard label="เก็บได้" value={money(t?.collected)} unit="บาท" tone="text-emerald-600" />}
      </div>

      <Card title="สรุปรายหมู่">
        {isLoading ? <Loading /> : (
          <Table head={mode === 'period' ? ['หมู่', 'ลูกหนี้', 'ยอดยกมา', 'ตั้งเก็บ', 'เก็บได้', 'คงค้าง'] : ['หมู่', 'ลูกหนี้', 'ค้างชำระ']}
            align={mode === 'period' ? ['l', 'r', 'r', 'r', 'r', 'r'] : ['l', 'r', 'r']}>
            {(data?.byVillage || []).map((v: any) => (
              <tr key={v.villageNo ?? 'x'}>
                <td className="py-2 pr-3 font-medium text-slate-700">หมู่ {v.villageNo ?? '-'}</td>
                <td className="py-2 pr-3 text-right text-slate-600">{v.debtors}</td>
                {mode === 'period' && <td className="py-2 pr-3 text-right font-mono text-amber-600">{money(v.carry)}</td>}
                {mode === 'period' && <td className="py-2 pr-3 text-right font-mono text-slate-800">{money(v.billed)}</td>}
                {mode === 'period' && <td className="py-2 pr-3 text-right font-mono text-emerald-600">{money(v.collected)}</td>}
                <td className="py-2 pl-3 text-right font-mono text-rose-600">{money(mode === 'period' ? v.balance : v.outstanding)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-100 font-semibold">
              <td className="py-2 pr-3 text-slate-700">รวม</td>
              <td className="py-2 pr-3 text-right text-slate-600">{t?.debtors ?? 0}</td>
              {mode === 'period' && <td className="py-2 pr-3 text-right font-mono text-amber-600">{money(t?.carry)}</td>}
              {mode === 'period' && <td className="py-2 pr-3 text-right font-mono text-slate-800">{money(t?.billed)}</td>}
              {mode === 'period' && <td className="py-2 pr-3 text-right font-mono text-emerald-600">{money(t?.collected)}</td>}
              <td className="py-2 pl-3 text-right font-mono text-rose-700">{money(mode === 'period' ? t?.balance : t?.outstanding)}</td>
            </tr>
          </Table>
        )}
      </Card>

      <Card title={`รายลูกหนี้ค้างชำระ ${data?.customers?.length ? `(${data.customers.length} ราย)` : ''}`} icon={Users2}>
        {isLoading ? <Loading /> : !data?.customers?.length ? (
          <p className="py-8 text-center text-sm text-slate-400">ไม่มีลูกหนี้ค้างชำระในเงื่อนไขนี้</p>
        ) : (
          <div className="max-h-112 overflow-auto">
            <Table head={['รหัส', 'ชื่อ-สกุล', 'หมู่', 'งวด', 'ค่าน้ำ', 'บริการ', 'บำบัด', 'ขยะ', 'ภาษี', 'รวมค้าง']}
              align={['l', 'l', 'c', 'c', 'r', 'r', 'r', 'r', 'r', 'r']} sticky>
              {data.customers.map((r: any) => (
                <tr key={r.customerCode} className="hover:bg-slate-50/50">
                  <td className="py-1.5 pr-3 font-mono text-sky-600">{r.customerCode}</td>
                  <td className="py-1.5 pr-3 text-slate-800">{r.fullName}</td>
                  <td className="py-1.5 pr-3 text-center text-slate-500">{r.villageNo ?? '-'}</td>
                  <td className="py-1.5 pr-3 text-center text-slate-500">{r.unpaidCount}</td>
                  <td className="py-1.5 pr-3 text-right font-mono text-slate-600">{money(r.water)}</td>
                  <td className="py-1.5 pr-3 text-right font-mono text-slate-600">{money(r.service)}</td>
                  <td className="py-1.5 pr-3 text-right font-mono text-slate-600">{r.wastewater ? money(r.wastewater) : '—'}</td>
                  <td className="py-1.5 pr-3 text-right font-mono text-slate-600">{r.garbage ? money(r.garbage) : '—'}</td>
                  <td className="py-1.5 pr-3 text-right font-mono text-slate-600">{r.tax ? money(r.tax) : '—'}</td>
                  <td className="py-1.5 pl-3 text-right font-mono font-semibold text-rose-600">{money(r.outstanding)}</td>
                </tr>
              ))}
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─────────────────────────────── ป.32 เงินรายรับ (สรุป + ทะเบียนรายใบเสร็จ)
const P32_SORTS = [
  { key: 'receipt', label: 'เลขที่ใบเสร็จ' },
  { key: 'date', label: 'วันที่รับเงิน' },
  { key: 'collector', label: 'ผู้รับเงิน' },
] as const;

function P32Tab({ year, month }: { year: number; month: number }) {
  const [view, setView] = useState<'summary' | 'register'>('summary');
  const [sort, setSort] = useState<'receipt' | 'date' | 'collector'>('receipt');
  const [busy, setBusy] = useState('');
  const params = { year, month };

  const { data, isLoading } = useQuery({
    queryKey: ['prapa-p32', year, month],
    queryFn: async () => (await api.get('/water/report/p32', { params })).data.data as any,
    enabled: view === 'summary',
  });
  const { data: reg, isLoading: regLoading } = useQuery({
    queryKey: ['prapa-p32reg', year, month, sort],
    queryFn: async () => (await api.get('/water/report/p32/register', { params: { year, month, sort } })).data.data as any,
    enabled: view === 'register',
  });
  const t = data?.totals; const rt = reg?.totals;

  const run = async (kind: 'excel' | 'pdf') => {
    setBusy(kind);
    try {
      const p = view === 'register' ? { year, month, sort } : params;
      const base = view === 'register' ? '/water/report/p32/register' : '/water/report/p32';
      if (kind === 'excel') await downloadXlsx(`${base}/excel`, p, `${view === 'register' ? 'ทะเบียนรายรับ' : 'รายงานเงินรายรับ'}ค่าน้ำ-ป32-${month}-${year}.xlsx`);
      else await openPdf(`${base}/pdf`, p);
    } finally { setBusy(''); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs items={[{ key: 'summary', label: 'สรุป (วัน×ผู้รับเงิน)' }, { key: 'register', label: 'ทะเบียนรายใบเสร็จ' }]} value={view} onChange={setView} />
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {view === 'register' && (
            <select value={sort} onChange={(e) => setSort(e.target.value as any)} className={`${controlBase} min-w-0 flex-1 px-3 sm:flex-none`}>
              {P32_SORTS.map((s) => <option key={s.key} value={s.key}>เรียงตาม{s.label}</option>)}
            </select>
          )}
          <ExportBtn onClick={() => run('excel')} busy={busy === 'excel'} icon={FileSpreadsheet} label="Excel" />
          <ExportBtn onClick={() => run('pdf')} busy={busy === 'pdf'} icon={Printer} label="PDF" />
        </div>
      </div>

      {view === 'summary' ? (
        <>
          <p className="text-sm text-slate-500">เงินรายรับประจำเดือน <span className="font-medium text-slate-800">{MONTH_TH[month]} {year}</span> · นับตามวันที่รับเงิน (รวมบิลค้างงวดก่อน)</p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="รวมรับทั้งเดือน" value={money(t?.total)} unit="บาท" tone="text-emerald-600" />
            <StatCard label="จำนวนใบเสร็จ" value={int(t?.count)} unit="ราย" tone="text-slate-900" />
            <StatCard label="ค่าน้ำ" value={money(t?.water)} unit="บาท" tone="text-sky-600" />
            <StatCard label="ค่าบริการ" value={money(t?.service)} unit="บาท" tone="text-slate-600" />
          </div>
          <Card title="เงินรับแยกวัน × ผู้รับเงิน">
            {isLoading ? <Loading /> : !data?.rows?.length ? (
              <p className="py-8 text-center text-sm text-slate-400">ยังไม่มีรายการรับเงินในเดือนนี้</p>
            ) : (
              <div className="overflow-x-auto">
                <Table head={['วันที่', 'ผู้รับเงิน', 'ราย', 'ค่าน้ำ', 'บริการ', 'บำบัด', 'ขยะ', 'ภาษี', 'รวมรับ']}
                  align={['l', 'l', 'c', 'r', 'r', 'r', 'r', 'r', 'r']}>
                  {data.rows.map((r: any, i: number) => (
                    <tr key={i}>
                      <td className="py-1.5 pr-3 text-slate-700">{new Date(r.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}</td>
                      <td className="py-1.5 pr-3 text-slate-600">{r.collector}</td>
                      <td className="py-1.5 pr-3 text-center text-slate-500">{r.count}</td>
                      <td className="py-1.5 pr-3 text-right font-mono text-slate-600">{money(r.water)}</td>
                      <td className="py-1.5 pr-3 text-right font-mono text-slate-600">{money(r.service)}</td>
                      <td className="py-1.5 pr-3 text-right font-mono text-slate-600">{r.wastewater ? money(r.wastewater) : '—'}</td>
                      <td className="py-1.5 pr-3 text-right font-mono text-slate-600">{r.garbage ? money(r.garbage) : '—'}</td>
                      <td className="py-1.5 pr-3 text-right font-mono text-slate-600">{r.tax ? money(r.tax) : '—'}</td>
                      <td className="py-1.5 pl-3 text-right font-mono font-semibold text-emerald-600">{money(r.total)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-100 font-semibold">
                    <td className="py-2 pr-3 text-slate-700" colSpan={2}>รวมทั้งสิ้น</td>
                    <td className="py-2 pr-3 text-center text-slate-600">{t?.count}</td>
                    <td className="py-2 pr-3 text-right font-mono text-slate-700">{money(t?.water)}</td>
                    <td className="py-2 pr-3 text-right font-mono text-slate-700">{money(t?.service)}</td>
                    <td className="py-2 pr-3 text-right font-mono text-slate-700">{money(t?.wastewater)}</td>
                    <td className="py-2 pr-3 text-right font-mono text-slate-700">{money(t?.garbage)}</td>
                    <td className="py-2 pr-3 text-right font-mono text-slate-700">{money(t?.tax)}</td>
                    <td className="py-2 pl-3 text-right font-mono text-emerald-700">{money(t?.total)}</td>
                  </tr>
                </Table>
              </div>
            )}
          </Card>
        </>
      ) : (
        <>
          <p className="text-sm text-slate-500">ทะเบียนคุมเงินรายรับ (รายใบเสร็จ) ประจำเดือน <span className="font-medium text-slate-800">{MONTH_TH[month]} {year}</span> · นับตามวันที่รับเงิน</p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="รวมรับทั้งเดือน" value={money(rt?.total)} unit="บาท" tone="text-emerald-600" />
            <StatCard label="จำนวนใบเสร็จ" value={int(rt?.count)} unit="ฉบับ" tone="text-slate-900" />
            <StatCard label="ค่าน้ำ" value={money(rt?.water)} unit="บาท" tone="text-sky-600" />
            <StatCard label="ค่าบริการ" value={money(rt?.service)} unit="บาท" tone="text-slate-600" />
          </div>
          <Card title="รายการใบเสร็จ">
            {regLoading ? <Loading /> : !reg?.rows?.length ? (
              <p className="py-8 text-center text-sm text-slate-400">ยังไม่มีรายการรับเงินในเดือนนี้</p>
            ) : (
              <div className="max-h-128 overflow-auto">
                <Table head={['เลขที่ใบเสร็จ', 'วันที่', 'รหัส', 'ชื่อ-สกุล', 'หมู่', 'ค่าน้ำ', 'บริการ', 'รวม', 'ผู้รับเงิน']}
                  align={['l', 'l', 'l', 'l', 'c', 'r', 'r', 'r', 'l']} sticky>
                  {reg.rows.map((r: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50/50">
                      <td className="py-1.5 pr-3 font-mono text-sky-600">{r.receiptNo || '—'}</td>
                      <td className="py-1.5 pr-3 text-slate-500">{r.paidAt ? new Date(r.paidAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}</td>
                      <td className="py-1.5 pr-3 font-mono text-slate-500">{r.customerCode}</td>
                      <td className="py-1.5 pr-3 text-slate-800">{r.fullName}</td>
                      <td className="py-1.5 pr-3 text-center text-slate-500">{r.villageNo ?? '-'}</td>
                      <td className="py-1.5 pr-3 text-right font-mono text-slate-600">{money(r.water)}</td>
                      <td className="py-1.5 pr-3 text-right font-mono text-slate-600">{money(r.service)}</td>
                      <td className="py-1.5 pr-3 text-right font-mono font-semibold text-emerald-600">{money(r.total)}</td>
                      <td className="py-1.5 pl-3 text-slate-600">{r.collector}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-100 font-semibold">
                    <td className="py-2 pr-3 text-slate-700" colSpan={5}>รวม {int(rt?.count)} ฉบับ</td>
                    <td className="py-2 pr-3 text-right font-mono text-slate-700">{money(rt?.water)}</td>
                    <td className="py-2 pr-3 text-right font-mono text-slate-700">{money(rt?.service)}</td>
                    <td className="py-2 pr-3 text-right font-mono text-emerald-700">{money(rt?.total)}</td>
                    <td></td>
                  </tr>
                </Table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────── การใช้น้ำ (use_water_user)
// ─────────────────────────────── ป.31 ทะเบียนการอ่านมาตรวัดน้ำ
function P31Tab({ year, month }: { year: number; month: number }) {
  const [busy, setBusy] = useState('');
  const params = { year, month };
  const { data, isLoading } = useQuery({
    queryKey: ['prapa-p31', year, month],
    queryFn: async () => (await api.get('/water/report/p31', { params })).data.data as any,
  });
  const run = async (kind: 'excel' | 'pdf') => {
    setBusy(kind);
    try {
      if (kind === 'excel') await downloadXlsx('/water/report/p31/excel', params, `ทะเบียนอ่านมาตร-ป31-${month}-${year}.xlsx`);
      else await openPdf('/water/report/p31/pdf', params);
    } finally { setBusy(''); }
  };
  const rows = data?.rows || [];
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">การอ่านมาตรวัดน้ำ <span className="font-medium text-slate-800">{MONTH_TH[month]} {year}</span> · {int(rows.length)} ราย · รวม {int(data?.totalUnits)} หน่วย</p>
        <div className="flex gap-2">
          <ExportBtn onClick={() => run('excel')} busy={busy === 'excel'} icon={FileSpreadsheet} label="Excel" />
          <ExportBtn onClick={() => run('pdf')} busy={busy === 'pdf'} icon={Printer} label="PDF" />
        </div>
      </div>
      <Card title="ทะเบียนการอ่านมาตรวัดน้ำ (ป.31)">
        {isLoading ? <Loading /> : !rows.length ? <p className="py-8 text-center text-sm text-slate-400">ยังไม่มีข้อมูลการอ่านมาตรในงวดนี้</p> : (
          <div className="max-h-[36rem] overflow-auto">
            <Table head={['รหัส', 'ชื่อผู้ใช้น้ำ', 'หมู่', 'ครั้งก่อน', 'ครั้งนี้', 'หน่วย', 'วันที่จด', 'ผู้จดมาตร']} align={['l', 'l', 'c', 'r', 'r', 'r', 'c', 'l']} sticky>
              {rows.slice(0, 500).map((r: any) => (
                <tr key={r.customerCode} className="hover:bg-slate-50/50">
                  <td className="py-1.5 pr-3 font-mono text-sky-600">{r.customerCode}</td>
                  <td className="py-1.5 pr-3 text-slate-800">{r.fullName}</td>
                  <td className="py-1.5 pr-3 text-center text-slate-500">{r.villageNo ?? '-'}</td>
                  <td className="py-1.5 pr-3 text-right font-mono text-slate-400">{int(r.prevReading)}</td>
                  <td className="py-1.5 pr-3 text-right font-mono text-slate-800">{int(r.currReading)}</td>
                  <td className="py-1.5 pr-3 text-right font-mono font-semibold text-slate-900">{int(r.units)}</td>
                  <td className="py-1.5 pr-3 text-center text-slate-500">{r.readAt || '—'}</td>
                  <td className="py-1.5 pl-3 text-slate-500">{r.readerName || '—'}</td>
                </tr>
              ))}
            </Table>
            {rows.length > 500 && <p className="pt-2 text-center text-xs text-slate-400">แสดง 500 แถวแรก · ดาวน์โหลด Excel/PDF เพื่อดูทั้งหมด</p>}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─────────────────────────────── รายงานภาษีขาย (VAT)
function VatTab({ year, month }: { year: number; month: number }) {
  const [busy, setBusy] = useState('');
  const params = { year, month };
  const { data, isLoading } = useQuery({
    queryKey: ['prapa-vat', year, month],
    queryFn: async () => (await api.get('/water/report/vat', { params })).data.data as any,
  });
  const run = async (kind: 'excel' | 'pdf') => {
    setBusy(kind);
    try {
      if (kind === 'excel') await downloadXlsx('/water/report/vat/excel', params, `รายงานภาษีขาย-VAT-${month}-${year}.xlsx`);
      else await openPdf('/water/report/vat/pdf', params);
    } finally { setBusy(''); }
  };
  const rows = data?.rows || [];
  const t = data?.totals;
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">รายงานภาษีขาย <span className="font-medium text-slate-800">{MONTH_TH[month]} {year}</span> · นับตามวันที่รับเงิน</p>
        <div className="flex gap-2">
          <ExportBtn onClick={() => run('excel')} busy={busy === 'excel'} icon={FileSpreadsheet} label="Excel" />
          <ExportBtn onClick={() => run('pdf')} busy={busy === 'pdf'} icon={Printer} label="PDF" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="มูลค่าก่อนภาษี" value={money(t?.base)} unit="บาท" tone="text-slate-900" />
        <StatCard label="ภาษีมูลค่าเพิ่ม" value={money(t?.tax)} unit="บาท" tone="text-amber-600" />
        <StatCard label="รวมเงิน" value={money(t?.total)} unit="บาท" tone="text-emerald-600" />
      </div>
      {t && Number(t.tax) === 0 && rows.length > 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">เดือนนี้ไม่มียอดภาษีมูลค่าเพิ่ม (หน่วยงานไม่ได้ตั้งอัตรา VAT) — รายงานยังแสดงยอดขายเพื่อใช้เป็นทะเบียนคุมได้</p>
      )}
      <Card title="รายงานภาษีขาย (ภาษีมูลค่าเพิ่ม)">
        {isLoading ? <Loading /> : !rows.length ? <p className="py-8 text-center text-sm text-slate-400">ยังไม่มีรายการรับเงินในเดือนนี้</p> : (
          <div className="max-h-[36rem] overflow-auto">
            <Table head={['วันที่', 'เลขที่ใบเสร็จ', 'ชื่อผู้ซื้อ', 'ก่อนภาษี', 'ภาษี', 'รวม']} align={['c', 'l', 'l', 'r', 'r', 'r']} sticky>
              {rows.slice(0, 500).map((r: any, i: number) => (
                <tr key={i} className="hover:bg-slate-50/50">
                  <td className="py-1.5 pr-3 text-center text-slate-500">{r.paidAt}</td>
                  <td className="py-1.5 pr-3 font-mono text-sky-600">{r.receiptNo || '—'}</td>
                  <td className="py-1.5 pr-3 text-slate-800">{r.fullName}</td>
                  <td className="py-1.5 pr-3 text-right font-mono text-slate-700">{money(r.base)}</td>
                  <td className="py-1.5 pr-3 text-right font-mono text-amber-600">{money(r.tax)}</td>
                  <td className="py-1.5 pl-3 text-right font-mono font-semibold text-emerald-700">{money(r.total)}</td>
                </tr>
              ))}
            </Table>
            {rows.length > 500 && <p className="pt-2 text-center text-xs text-slate-400">แสดง 500 แถวแรก · ดาวน์โหลด Excel/PDF เพื่อดูทั้งหมด</p>}
          </div>
        )}
      </Card>
    </div>
  );
}

function UsageTab({ year, month }: { year: number; month: number }) {
  const [busy, setBusy] = useState('');
  const params = { year, month };
  const { data, isLoading } = useQuery({
    queryKey: ['prapa-usage', year, month],
    queryFn: async () => (await api.get('/water/report/usage', { params })).data.data as any,
  });
  const t = data?.totals;
  const run = async () => { setBusy('x'); try { await downloadXlsx('/water/report/usage/excel', params, `รายงานการใช้น้ำ-${month}-${year}.xlsx`); } finally { setBusy(''); } };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">การใช้น้ำประจำงวด <span className="font-medium text-slate-800">{MONTH_TH[month]} {year}</span></p>
        <ExportBtn onClick={run} busy={!!busy} icon={FileSpreadsheet} label="Excel" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="จดแล้ว" value={int(t?.readCount)} unit="ราย" tone="text-sky-600" />
        <StatCard label="รวมหน่วยใช้" value={int(t?.totalUnits)} unit="หน่วย" tone="text-slate-900" />
        <StatCard label="เฉลี่ย/ราย" value={String(t?.avgUnits ?? 0)} unit="หน่วย" tone="text-violet-600" />
        <StatCard label="ค่าน้ำรวม" value={money(t?.waterAmount)} unit="บาท" tone="text-emerald-600" />
      </div>
      <Card title="หน่วยการใช้น้ำ แยกรายหมู่">
        {isLoading ? <Loading /> : (
          <Table head={['หมู่', 'จดแล้ว', 'รวมหน่วย', 'เฉลี่ย/ราย', 'ค่าน้ำ']} align={['l', 'r', 'r', 'r', 'r']}>
            {(data?.byVillage || []).map((v: any) => (
              <tr key={v.villageNo ?? 'x'}>
                <td className="py-2 pr-3 font-medium text-slate-700">หมู่ {v.villageNo ?? '-'}</td>
                <td className="py-2 pr-3 text-right text-slate-500">{v.readCount}</td>
                <td className="py-2 pr-3 text-right font-mono text-slate-800">{int(v.totalUnits)}</td>
                <td className="py-2 pr-3 text-right font-mono text-violet-600">{v.avgUnits}</td>
                <td className="py-2 pl-3 text-right font-mono text-emerald-600">{money(v.waterAmount)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-100 font-semibold">
              <td className="py-2 pr-3 text-slate-700">รวม</td>
              <td className="py-2 pr-3 text-right text-slate-500">{t?.readCount}</td>
              <td className="py-2 pr-3 text-right font-mono text-slate-800">{int(t?.totalUnits)}</td>
              <td className="py-2 pr-3 text-right font-mono text-violet-600">{t?.avgUnits}</td>
              <td className="py-2 pl-3 text-right font-mono text-emerald-700">{money(t?.waterAmount)}</td>
            </tr>
          </Table>
        )}
      </Card>
      <Card title="ผู้ใช้น้ำมากสุด (เทียบเดือนก่อน)">
        {isLoading ? <Loading /> : !data?.customers?.length ? <p className="py-8 text-center text-sm text-slate-400">ยังไม่มีข้อมูลการจดในงวดนี้</p> : (
          <div className="max-h-112 overflow-auto">
            <Table head={['รหัส', 'ชื่อ-สกุล', 'หมู่', 'มิเตอร์', 'หน่วยนี้', 'เดือนก่อน']} align={['l', 'l', 'c', 'c', 'r', 'r']} sticky>
              {data.customers.slice(0, 200).map((r: any) => {
                const jump = r.prevUnits != null && r.units > r.prevUnits * 2 && r.units > 30;
                return (
                  <tr key={r.customerCode} className="hover:bg-slate-50/50">
                    <td className="py-1.5 pr-3 font-mono text-sky-600">{r.customerCode}</td>
                    <td className="py-1.5 pr-3 text-slate-800">{r.fullName}</td>
                    <td className="py-1.5 pr-3 text-center text-slate-500">{r.villageNo ?? '-'}</td>
                    <td className="py-1.5 pr-3 text-center font-mono text-slate-400">{r.prevReading}→{r.currReading}</td>
                    <td className={`py-1.5 pr-3 text-right font-mono font-semibold ${jump ? 'text-rose-600' : 'text-slate-800'}`}>{r.units}</td>
                    <td className="py-1.5 pl-3 text-right font-mono text-slate-400">{r.prevUnits ?? '—'}</td>
                  </tr>
                );
              })}
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─────────────────────────────── ชิ้นส่วน UI ร่วม
function Card({ title, icon: Icon, children }: { title: string; icon?: any; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
      <p className="mb-3 flex items-center gap-1.5 text-sm font-medium text-slate-700">{Icon && <Icon className="h-4 w-4 text-slate-400" />}{title}</p>
      {children}
    </div>
  );
}
function Loading() { return <p className="py-8 text-center text-sm text-slate-400">กำลังโหลด...</p>; }
function Table({ head, align, sticky, children }: { head: string[]; align: ('l' | 'r' | 'c')[]; sticky?: boolean; children: ReactNode }) {
  const cls = (a: string) => (a === 'r' ? 'text-right' : a === 'c' ? 'text-center' : 'text-left');
  const table = (
    <table className="w-full text-sm">
      <thead>
        <tr className={`border-b border-slate-100 text-xs text-slate-400 ${sticky ? 'sticky top-0 bg-white' : ''}`}>
          {head.map((h, i) => <th key={i} className={`whitespace-nowrap py-2 ${i === 0 ? 'pr-3' : i === head.length - 1 ? 'pl-3' : 'px-3'} font-medium ${cls(align[i])}`}>{h}</th>)}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">{children}</tbody>
    </table>
  );
  // ตารางรายงานกว้าง — มือถือเลื่อนซ้ายขวาได้ (แบบ sticky อยู่ในกล่องที่เลื่อนได้อยู่แล้ว ห้ามห่อซ้ำ ไม่งั้นหัวตารางไม่ติด)
  return sticky ? table : <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">{table}</div>;
}
function ExportBtn({ onClick, busy, icon: Icon, label }: { onClick: () => void; busy: boolean; icon: any; label: string }) {
  return (
    <button onClick={onClick} disabled={busy} className={btn('secondary')}>
      <Icon className="h-4 w-4" /> {busy ? 'กำลังสร้าง...' : label}
    </button>
  );
}
