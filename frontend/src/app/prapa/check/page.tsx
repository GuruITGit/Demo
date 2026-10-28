'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/water-api';
import { toast } from '@/hooks/use-toast';
import { MONTH_TH } from '@/lib/baht-text';
import { ClipboardCheck, Search, Printer } from 'lucide-react';
import { TableCard, Table, THead, Th, Td, Tr, TableMessage, CodeChip } from '@/components/shared/table';
import { PageHeader, Card, Field, inputCls, btn, MobileList, EmptyState } from '../ui';

const money = (n: any) => Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const methodLabel: Record<string, string> = { cash: 'เงินสด', qr: 'QR/โอน', transfer: 'โอน' };

/** responseType blob → ข้อความ error จาก backend อยู่ใน Blob ต้องอ่านเองก่อน */
async function blobError(e: unknown): Promise<string> {
  const d = (e as { response?: { data?: unknown } })?.response?.data;
  if (d instanceof Blob) {
    try { const j = JSON.parse(await d.text()); const m = j?.error?.message ?? j?.message; return (Array.isArray(m) ? m[0] : m) || 'พิมพ์ไม่สำเร็จ'; } catch { /* ไม่ใช่ JSON */ }
  }
  return getErrorMessage(e, 'พิมพ์ไม่สำเร็จ');
}

export default function PrapaCheckPage() {
  const [search, setSearch] = useState('');
  const [receiptNo, setReceiptNo] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState({ search: '', receiptNo: '', from: '', to: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['pay-history', q],
    queryFn: async () => (await api.get('/water/billing/payments/history', { params: {
      search: q.search || undefined, receiptNo: q.receiptNo || undefined, from: q.from || undefined, to: q.to || undefined,
    } })).data.data as any,
    enabled: !!(q.search || q.receiptNo || q.from || q.to),
  });
  const rows: any[] = data?.rows || [];

  const openPdf = async (url: string, params?: Record<string, string | undefined>) => {
    try {
      const res = await api.get(url, { params, responseType: 'blob' });
      const u = URL.createObjectURL(res.data as Blob);
      window.open(u, '_blank'); setTimeout(() => URL.revokeObjectURL(u), 60000);
    } catch (e) { toast.error(await blobError(e)); }
  };
  const printReceipt = (billId: string) => openPdf(`/water/billing/${billId}/receipt`);
  // ใบเสร็จสีฟ้า (กระดาษต่อเนื่อง) — รายใบ / ทั้งหมดตามเงื่อนไขที่ค้น (หน้าละ 3 ใบ เรียงรหัสผู้ใช้น้ำ)
  const printBlue = (billId: string) => openPdf(`/water/billing/${billId}/blue-receipt`);
  const [blueBusy, setBlueBusy] = useState(false);
  const printBlueAll = async () => {
    setBlueBusy(true);
    await openPdf('/water/billing/payments/blue-receipts', {
      search: q.search || undefined, receiptNo: q.receiptNo || undefined, from: q.from || undefined, to: q.to || undefined,
    });
    setBlueBusy(false);
  };
  const paidAt = (d: string) => d ? new Date(d).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
  const doSearch = () => setQ({ search, receiptNo, from, to });

  const searched = !!(q.search || q.receiptNo || q.from || q.to);
  const onEnter = (e: React.KeyboardEvent) => { if (e.key === 'Enter') doSearch(); };

  return (
    <div className="space-y-4">
      <PageHeader icon={ClipboardCheck} title="ตรวจสอบการชำระเงิน" desc="ค้นประวัติการจ่ายด้วยชื่อ รหัส เลขใบเสร็จ หรือช่วงวัน" />

      <Card>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-[1fr_12rem_10rem_10rem_auto] lg:items-end">
          <Field label="ชื่อ / รหัสผู้ใช้น้ำ" className="col-span-2 lg:col-span-1">
            <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={onEnter} className={inputCls} />
          </Field>
          <Field label="เลขที่ใบเสร็จ" className="col-span-2 lg:col-span-1">
            <input value={receiptNo} onChange={(e) => setReceiptNo(e.target.value)} onKeyDown={onEnter} className={inputCls} />
          </Field>
          <Field label="ตั้งแต่วันที่"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} /></Field>
          <Field label="ถึงวันที่"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} /></Field>
          <button onClick={doSearch} className={`${btn('primary')} col-span-2 lg:col-span-1`}><Search className="h-4 w-4" /> ค้นหา</button>
        </div>
      </Card>

      {data && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-500">พบ {data.count} รายการ · รวม <span className="font-semibold text-emerald-600">{money(data.total)}</span> บาท</p>
          {data.count > 0 && (
            <button onClick={printBlueAll} disabled={blueBusy} className={btn('secondary', 'sm')}>
              <Printer className="h-3.5 w-3.5" /> {blueBusy ? 'กำลังสร้าง…' : 'พิมพ์ใบเสร็จสีฟ้าทั้งหมด'}
            </button>
          )}
        </div>
      )}

      {/* มือถือ: รายการกระชับ */}
      <div className="sm:hidden">
        {!searched ? <EmptyState icon={Search} title="กรอกเงื่อนไขแล้วกดค้นหา" />
        : isLoading ? <p className="py-10 text-center text-sm text-slate-400">กำลังโหลด...</p>
        : rows.length === 0 ? <EmptyState title="ไม่พบรายการชำระ" />
        : (
          <MobileList>
            {rows.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{r.fullName}</p>
                  <p className="truncate text-xs text-slate-400"><span className="font-mono">{r.customerCode}</span> · {MONTH_TH[r.periodMonth]?.slice(0, 3)} {String(r.periodYear).slice(-2)} · {methodLabel[r.payMethod] || r.payMethod || '—'}</p>
                  <p className="truncate text-xs text-slate-400">{paidAt(r.paidAt)}{r.receiptNo && <> · <span className="font-mono">{r.receiptNo}</span></>}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <p className="text-sm font-bold tabular-nums text-emerald-600">{money(r.paidAmount)}</p>
                  <div className="flex gap-1.5">
                    <button onClick={() => printBlue(r.id)} aria-label="พิมพ์ใบเสร็จสีฟ้า" className="flex h-8 items-center justify-center rounded-lg border border-sky-200 px-2 text-xs font-medium text-sky-700 active:bg-sky-50">สีฟ้า</button>
                    <button onClick={() => printReceipt(r.id)} aria-label="พิมพ์ใบเสร็จ" className="flex h-8 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 active:bg-slate-50"><Printer className="h-4 w-4" /></button>
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
          <THead>
            <Th>รหัส</Th><Th>ชื่อ-สกุล</Th><Th>งวด</Th><Th align="right">ยอด</Th><Th>วันจ่าย</Th><Th>ใบเสร็จ</Th><Th>ช่องทาง</Th><Th>ผู้รับเงิน</Th><Th />
          </THead>
          <tbody>
            {!searched ? <TableMessage colSpan={9}>กรอกเงื่อนไขแล้วกดค้นหา</TableMessage>
            : isLoading ? <TableMessage colSpan={9}>กำลังโหลด...</TableMessage>
            : rows.length === 0 ? <TableMessage colSpan={9}>ไม่พบรายการชำระ</TableMessage>
            : rows.map((r) => (
              <Tr key={r.id}>
                <Td><CodeChip>{r.customerCode}</CodeChip></Td>
                <Td className="text-slate-800">{r.fullName}</Td>
                <Td className="whitespace-nowrap text-slate-500">{MONTH_TH[r.periodMonth]?.slice(0, 3)} {String(r.periodYear).slice(-2)}</Td>
                <Td align="right" className="font-mono font-medium text-slate-800">{money(r.paidAmount)}</Td>
                <Td className="whitespace-nowrap text-slate-500">{paidAt(r.paidAt)}</Td>
                <Td className="font-mono text-slate-600">{r.receiptNo || '—'}</Td>
                <Td className="text-slate-500">{methodLabel[r.payMethod] || r.payMethod || '—'}</Td>
                <Td className="text-slate-500">{r.collector || '—'}</Td>
                <Td align="right">
                  <div className="flex justify-end gap-1.5">
                    <button onClick={() => printBlue(r.id)} className={btn('secondary', 'sm')} title="ใบเสร็จสีฟ้า (กระดาษต่อเนื่อง)">สีฟ้า</button>
                    <button onClick={() => printReceipt(r.id)} className={btn('secondary', 'sm')}><Printer className="h-3.5 w-3.5" /> ใบเสร็จ</button>
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </TableCard>
    </div>
  );
}
