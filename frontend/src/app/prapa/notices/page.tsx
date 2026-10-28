'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/water-api';
import { toast } from '@/hooks/use-toast';
import { MONTH_TH } from '@/lib/baht-text';
import { FileWarning, Plus, Printer, Mail } from 'lucide-react';
import { Pagination } from '@/components/shared/pagination';
import { TableCard, Table, THead, Th, Td, Tr, TableMessage } from '@/components/shared/table';
import { PageHeader, Card, SectionTitle, Field, SearchInput, Sheet, controlBase, inputCls, btn, MobileList } from '../ui';
import { useCanNotice } from '../use-can-manage';

const money = (n: any) => Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PrapaNoticesPage() {
  const canNotice = useCanNotice();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [periodMonth, setPeriodMonth] = useState('');
  const [creating, setCreating] = useState(false);
  // ทวงยกล็อต
  const [bulkVillage, setBulkVillage] = useState('');
  const [bulkMonths, setBulkMonths] = useState(3);
  const [bulkDate, setBulkDate] = useState(new Date().toISOString().slice(0, 10));

  const { data, isLoading } = useQuery({
    queryKey: ['prapa-notices', page, search, periodMonth],
    queryFn: async () => (await api.get('/water/notices', { params: { page, limit: 20, search: search || undefined, periodMonth: periodMonth || undefined } })).data,
    placeholderData: (p) => p,
  });
  const { data: villages } = useQuery({
    queryKey: ['water-villages'],
    queryFn: async () => (await api.get('/water/customers/villages')).data.data as any[],
  });
  const { data: debtors } = useQuery({
    queryKey: ['prapa-debtors', bulkVillage, bulkMonths],
    enabled: canNotice,
    queryFn: async () => (await api.get('/water/notices/debtors', { params: { villageNo: bulkVillage || undefined, minMonths: bulkMonths } })).data.data as any[],
  });
  const openBulk = async (kind: 'bulk-pdf' | 'bulk-envelope') => {
    try {
      const res = await api.get(`/water/notices/${kind}`, { params: { villageNo: bulkVillage || undefined, minMonths: bulkMonths, noticeDate: bulkDate }, responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob); window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { toast.error(getErrorMessage(e, 'พิมพ์ยกล็อตไม่สำเร็จ')); }
  };
  const rows = data?.data || [];
  const meta = data?.meta || { page: 1, totalPages: 1 };

  const openDoc = async (id: string, kind: 'pdf' | 'envelope') => {
    try {
      const res = await api.get(`/water/notices/${id}/${kind}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { toast.error(getErrorMessage(e, 'เปิดเอกสารไม่สำเร็จ')); }
  };
  const openPdf = (id: string) => openDoc(id, 'pdf');

  return (
    <div className="space-y-4">
      <PageHeader icon={FileWarning} iconClass="text-rose-500" title="หนังสือแจ้งค้างชำระ" desc="ออกรายคน หรือพิมพ์ยกล็อตตามหมู่"
        actions={canNotice && <button onClick={() => setCreating(true)} className={btn('primary')}><Plus className="h-4 w-4" /> ออกหนังสือ</button>} />

      {/* ทวงหนี้ยกล็อต — กรองหมู่ + จำนวนเดือนค้าง → พิมพ์ใบเตือน/ซองรวด (ไม่ต้องออกทีละฉบับ) */}
      {canNotice && (
        <Card>
          <SectionTitle title="ทวงหนี้ยกล็อต" desc="เลือกหมู่และจำนวนเดือนที่ค้าง แล้วพิมพ์ทั้งชุดในครั้งเดียว" />
          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
            <Field label="หมู่" className="sm:w-36">
              <select value={bulkVillage} onChange={(e) => setBulkVillage(e.target.value)} className={inputCls}>
                <option value="">ทุกหมู่</option>
                {villages?.map((v) => <option key={v.villageNo} value={v.villageNo}>หมู่ {v.villageNo}</option>)}
              </select></Field>
            <Field label="ค้างตั้งแต่ (เดือน)" className="sm:w-32">
              <input type="number" inputMode="numeric" min={1} value={bulkMonths} onChange={(e) => setBulkMonths(Math.max(1, Number(e.target.value) || 1))} className={inputCls} /></Field>
            <Field label="ลงวันที่หนังสือ" className="col-span-2 sm:w-44">
              <input type="date" value={bulkDate} onChange={(e) => setBulkDate(e.target.value)} className={inputCls} /></Field>
          </div>
          <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center">
            <p className="text-sm text-slate-500">เข้าเงื่อนไข <b className="text-base text-rose-600">{debtors?.length ?? 0}</b> ราย</p>
            <div className="grid grid-cols-2 gap-2 sm:ml-auto sm:flex">
              <button onClick={() => openBulk('bulk-pdf')} disabled={!debtors?.length} className={btn('danger')}><Printer className="h-4 w-4" /> พิมพ์ใบเตือน</button>
              <button onClick={() => openBulk('bulk-envelope')} disabled={!debtors?.length} className={btn('secondary')}><Mail className="h-4 w-4" /> พิมพ์หน้าซอง</button>
            </div>
          </div>
        </Card>
      )}

      {/* ค้นหา + กรองเดือน */}
      <div className="flex items-center gap-2">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="ค้นหา ชื่อ / รหัส..." className="flex-1" />
        <select value={periodMonth} onChange={(e) => { setPeriodMonth(e.target.value); setPage(1); }} className={`${controlBase} w-32 shrink-0 px-3 sm:w-40`}>
          <option value="">ทุกเดือน</option>
          {Object.entries(MONTH_TH).map(([m, name]) => <option key={m} value={m}>{name}</option>)}
        </select>
      </div>

      {/* มือถือ: รายการกระชับ — ข้อมูลซ้าย · ยอด + ปุ่มเล็กขวา */}
      <div className="sm:hidden">
        {isLoading ? <p className="py-10 text-center text-sm text-slate-400">กำลังโหลด...</p>
        : rows.length === 0 ? <p className="rounded-2xl border border-slate-100 bg-white py-10 text-center text-sm text-slate-400">ยังไม่มีหนังสือ — กด &quot;ออกหนังสือ&quot; เพื่อเริ่ม</p>
        : (
          <MobileList>
            {rows.map((r: any) => (
              <div key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{r.fullName}</p>
                  <p className="truncate text-xs text-slate-400"><span className="font-mono">{r.customerCode}</span>{r.villageNo ? ` · หมู่ ${r.villageNo}` : ''} · {MONTH_TH[r.periodMonth]} {r.periodYear}</p>
                  <p className="text-[11px]">{r.docNumber ? <span className="font-mono text-sky-600">เลขที่ {r.docNumber}/{r.docYear}</span> : <span className="text-slate-400">ยังไม่ลงเลข</span>}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <p className="text-sm font-bold tabular-nums text-rose-600">{money(r.amount)}</p>
                  <div className="flex gap-1.5">
                    <button onClick={() => openPdf(r.id)} title="ดู/พิมพ์" aria-label="ดู/พิมพ์" className="flex h-8 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 active:bg-slate-50"><Printer className="h-4 w-4" /></button>
                    <button onClick={() => openDoc(r.id, 'envelope')} title="ซอง" aria-label="พิมพ์ซอง" className="flex h-8 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 active:bg-slate-50"><Mail className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>
            ))}
          </MobileList>
        )}
      </div>

      {/* จอใหญ่: ตารางกลาง */}
      <TableCard className="hidden sm:block">
        <Table>
          <THead><Th>เลขที่</Th><Th>เรียน</Th><Th>ประจำเดือน</Th><Th align="right">ยอดค้าง</Th><Th /></THead>
          <tbody>
            {isLoading ? <TableMessage colSpan={5}>กำลังโหลด...</TableMessage>
            : rows.length === 0 ? <TableMessage colSpan={5}>ยังไม่มีหนังสือ — กด &quot;ออกหนังสือ&quot; เพื่อเริ่ม</TableMessage>
            : rows.map((r: any) => (
              <Tr key={r.id}>
                <Td>{r.docNumber ? <span className="font-mono text-sky-600">{r.docNumber}/{r.docYear}</span> : <span className="text-xs text-slate-400">ยังไม่ลงเลข</span>}</Td>
                <Td><p className="text-slate-900">{r.fullName}</p><p className="text-xs text-slate-400"><span className="font-mono">{r.customerCode}</span>{r.villageNo ? ` · หมู่ ${r.villageNo}` : ''}</p></Td>
                <Td className="text-slate-500">{MONTH_TH[r.periodMonth]} {r.periodYear}</Td>
                <Td align="right" className="font-mono text-slate-900">{money(r.amount)}</Td>
                <Td align="right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button onClick={() => openPdf(r.id)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:border-sky-300 hover:text-sky-600"><Printer className="h-3.5 w-3.5" /> ดู/พิมพ์</button>
                    <button onClick={() => openDoc(r.id, 'envelope')} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:border-amber-300 hover:text-amber-600"><Mail className="h-3.5 w-3.5" /> ซอง</button>
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </TableCard>

      <Pagination page={meta.page} totalPages={meta.totalPages} onChange={setPage} />

      {creating && <CreateNotice onClose={() => setCreating(false)} onOpenPdf={openPdf} />}
    </div>
  );
}

function CreateNotice({ onClose, onOpenPdf }: { onClose: () => void; onOpenPdf: (id: string) => void }) {
  const qc = useQueryClient();
  const nowBE = new Date().getFullYear() + 543;
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<any | null>(null);
  const [noticeDate, setNoticeDate] = useState(new Date().toISOString().slice(0, 10));
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(nowBE);
  const [amount, setAmount] = useState('');
  const [docNumber, setDocNumber] = useState('');

  const { data: results } = useQuery({
    queryKey: ['prapa-notice-cust', q],
    enabled: !picked && q.trim().length >= 1,
    queryFn: async () => (await api.get('/water/customers', { params: { page: 1, limit: 8, search: q.trim() } })).data.data as any[],
  });

  const create = useMutation({
    mutationFn: () => api.post('/water/notices', {
      noticeDate, customerId: picked.id, customerCode: picked.customerCode, fullName: picked.fullName,
      villageNo: picked.villageNo || undefined, periodMonth: month, periodYear: year, amount: Number(amount),
      docNumber: docNumber ? Number(docNumber) : undefined,
    }),
    onSuccess: (res) => {
      toast.success('ออกหนังสือแล้ว');
      qc.invalidateQueries({ queryKey: ['prapa-notices'] });
      onClose();
      const id = res.data.data?.id; if (id) onOpenPdf(id);
    },
    onError: (e) => toast.error(getErrorMessage(e, 'ออกหนังสือไม่สำเร็จ')),
  });

  return (
    <Sheet title="ออกหนังสือแจ้งค้างชำระ" onClose={onClose}
      footer={picked && (
        <button onClick={() => create.mutate()} disabled={create.isPending || !amount || Number(amount) <= 0}
          className={`${btn('primary')} h-12 w-full text-base sm:h-11 sm:text-sm`}>ออกหนังสือ + พิมพ์</button>
      )}>
      {!picked ? (
        <div>
          <span className="mb-1 block text-xs font-medium text-slate-500">เลือกผู้ใช้น้ำ (ค้นหา ชื่อ/รหัส)</span>
          <SearchInput value={q} onChange={setQ} placeholder="พิมพ์เพื่อค้นหา..." autoFocus />
          <div className="mt-2 min-h-32 space-y-1.5">
            {results?.map((c) => (
              <button key={c.id} onClick={() => { setPicked(c); }} className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-3 text-left text-sm hover:border-sky-300 active:bg-sky-50">
                <span className="min-w-0 truncate text-slate-800">{c.fullName}</span>
                <span className="shrink-0 text-xs text-slate-400"><span className="font-mono">{c.customerCode}</span>{c.villageNo ? ` · ม.${c.villageNo}` : ''}</span>
              </button>
            ))}
            {q.trim().length >= 1 && results?.length === 0 && <p className="py-3 text-center text-xs text-slate-400">ไม่พบผู้ใช้น้ำ</p>}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-xl bg-sky-50 px-3 py-2.5">
            <div className="min-w-0 text-sm"><p className="truncate font-medium text-slate-800">{picked.fullName}</p><p className="text-xs text-slate-400"><span className="font-mono">{picked.customerCode}</span>{picked.villageNo ? ` · หมู่ ${picked.villageNo}` : ''}</p></div>
            <button onClick={() => setPicked(null)} className="shrink-0 rounded-lg px-2 py-1.5 text-sm text-sky-600 hover:bg-sky-100">เปลี่ยน</button>
          </div>
          <Field label="ลงวันที่หนังสือ"><input type="date" value={noticeDate} onChange={(e) => setNoticeDate(e.target.value)} className={inputCls} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="ประจำเดือน">
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={inputCls}>{Object.entries(MONTH_TH).map(([m, name]) => <option key={m} value={m}>{name}</option>)}</select>
            </Field>
            <Field label="ปี (พ.ศ.)"><input type="number" inputMode="numeric" value={year} onChange={(e) => setYear(Number(e.target.value))} className={inputCls} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="ยอดค้างชำระ (บาท)"><input type="number" inputMode="decimal" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className={inputCls} /></Field>
            <Field label="เลขที่หนังสือ"><input type="number" inputMode="numeric" value={docNumber} onChange={(e) => setDocNumber(e.target.value)} placeholder="เว้นว่าง = อัตโนมัติ" className={inputCls} /></Field>
          </div>
        </div>
      )}
    </Sheet>
  );
}
