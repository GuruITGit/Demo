'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/water-api';
import { toast } from '@/hooks/use-toast';
import { MONTH_TH } from '@/lib/baht-text';
import { Banknote, Search, Check, Printer, FileText, QrCode, Monitor, Download, User, Phone, MapPin, Gauge } from 'lucide-react';
import { useCanManage } from '../use-can-manage';
import { printBill as printBillShared } from '@/lib/water-print';
import { SlipVerifyGate } from '../slip-verify-gate';
import { TableCard, Table, THead, Th, Td, Tr, CodeChip } from '@/components/shared/table';

const money = (n: any) => Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const DKEY = 'prapa-display';
// สถานะการใช้น้ำ (รหัสตามระบบเดิม) → คำที่อ่านออก
const USAGE_LABEL: Record<string, string> = { '01': 'ใช้น้ำ', '02': 'ยกเลิก (มีหนี้)', '03': 'ยกเลิก' };

type Customer = { id: string; customerCode: string; fullName: string; villageNo: number | null };
type Bill = {
  id: string; periodYear: number; periodMonth: number; periodRound?: string; billNo?: string; totalAmount: string; status: string;
  waterAmount?: string; serviceFee?: string; garbageFee?: string; wastewaterFee?: string; tax?: string;
};

export default function PrapaCashierPage() {
  const canManage = useCanManage();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Customer | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [method, setMethod] = useState('cash');
  const [receiptNo, setReceiptNo] = useState('');
  const [done, setDone] = useState<any | null>(null);
  const [verifyId, setVerifyId] = useState<string | null>(null);
  const [village, setVillage] = useState<number | ''>('');   // กรองตามหมู่ (แบบภาคสนาม)
  const { data: rate } = useQuery({
    queryKey: ['prapa-rate-slip'],
    queryFn: async () => (await api.get('/water/billing/rate')).data.data as any,
  });
  const autoVerify = !!rate?.slipVerifyConfigured;

  // ค้นหาแบบพิมพ์ชื่อ/รหัส (สำนักงาน) หรือเลือกหมู่แล้วไล่รายชื่อ (ภาคสนาม) — รวมเป็นตัวเดียว
  const browsing = search.trim().length >= 2 || village !== '';
  const { data: results } = useQuery({
    queryKey: ['cashier-search', search, village],
    queryFn: async () => (await api.get('/water/customers', {
      params: { search: search.trim() || undefined, villageNo: village || undefined, limit: village !== '' && !search.trim() ? 100 : 8 },
    })).data.data as Customer[],
    enabled: browsing,
  });
  const { data: detail } = useQuery({
    queryKey: ['cashier-cust', selected?.id],
    queryFn: async () => (await api.get(`/water/customers/${selected!.id}`)).data.data as any,
    enabled: !!selected,
  });
  const unpaid: Bill[] = (detail?.bills || []).filter((b: Bill) => b.status === 'unpaid');
  const selectedBills = unpaid.filter((b) => checked[b.id]);
  const total = selectedBills.reduce((s, b) => s + Number(b.totalAmount), 0);

  // QR ยอดรวม (เมื่อเลือกช่องทาง QR)
  const { data: qrData } = useQuery({
    queryKey: ['cashier-qr', total],
    queryFn: async () => (await api.get('/water/billing/qr-amount', { params: { amount: total } })).data.data as any,
    enabled: method === 'qr' && total > 0 && !done,
  });

  const billLabel = selectedBills.length === 1
    ? `${MONTH_TH[selectedBills[0].periodMonth]}/${String(selectedBills[0].periodYear).slice(-2)} — ${money(selectedBills[0].totalAmount)} บาท`
    : selectedBills.length > 1 ? `${selectedBills.length} งวด` : '';
  const addrHasVillage = /ม\.|หมู่/.test(detail?.address || '');
  const custAddr = [detail?.address, !addrHasVillage && detail?.villageNo && `หมู่ ${detail.villageNo}`, detail?.soi, detail?.road,
    detail?.subDistrict && `ต.${detail.subDistrict}`].filter(Boolean).join(' ');

  // ส่งข้อมูลไปจอลูกค้า (localStorage → storage event)
  useEffect(() => {
    try {
      if (method === 'qr' && qrData?.qr && total > 0 && !done) {
        localStorage.setItem(DKEY, JSON.stringify({
          qr: qrData.qr, amount: total, payee: qrData.payeeName, name: selected?.fullName, code: selected?.customerCode,
          meterSerial: detail?.meterSerial, address: custAddr, billLabel, ts: Date.now(),
        }));
      } else {
        localStorage.setItem(DKEY, 'null');
      }
    } catch {}
  }, [method, qrData, total, done, selected, detail, billLabel, custAddr]);

  // เปลี่ยนบิลที่เลือก/ช่องทาง → ผลตรวจสลิปเดิมใช้ไม่ได้ (ยอดเปลี่ยน) ต้องตรวจใหม่
  useEffect(() => { setVerifyId(null); }, [total, method, selected?.id]);

  // รายหมู่ (ไว้ไล่รายชื่อแบบภาคสนาม) — ดึงจากรอบบิลปัจจุบัน
  const { data: round } = useQuery({ queryKey: ['prapa-round-cashier'], queryFn: async () => (await api.get('/water/billing/round')).data.data as any });
  const rYear = round?.periodYear, rMonth = round?.periodMonth;
  const { data: routes } = useQuery({
    queryKey: ['prapa-routes-cashier', rYear, rMonth],
    enabled: !!rYear && !!rMonth,
    queryFn: async () => (await api.get('/water/billing/routes', { params: { year: rYear, month: rMonth } })).data.data as any[],
  });

  const pick = (c: Customer) => { setSelected(c); setSearch(''); setDone(null); setReceiptNo(''); setChecked({}); setMethod('cash'); setVerifyId(null); };
  const allChecked = unpaid.length > 0 && unpaid.every((b) => checked[b.id]);
  const toggleAll = () => { const v = !allChecked; const m: Record<string, boolean> = {}; unpaid.forEach((b) => (m[b.id] = v)); setChecked(m); };
  const openDisplay = () => window.open('/prapa/display', 'prapa_display', 'width=1100,height=720');

  const pay = useMutation({
    mutationFn: () => api.post('/water/billing/pay-bills', {
      customerId: selected!.id, billIds: selectedBills.map((b) => b.id),
      payMethod: method, receiptNo: receiptNo.trim() || undefined,
      slipVerifyId: verifyId || undefined,
    }),
    onSuccess: (res) => { toast.success('รับชำระเรียบร้อย'); setDone(res.data.data); setChecked({}); setVerifyId(null); try { localStorage.setItem(DKEY, 'null'); } catch {} },
    onError: (e) => toast.error(getErrorMessage(e, 'รับชำระไม่สำเร็จ')),
  });

  const printBill = (billId: string, kind: 'receipt', mode: 'escpos' | 'pdf') =>
    printBillShared(billId, kind, mode === 'escpos' ? 'thermal' : 'pdf');
  const saveQr = () => {
    if (!qrData?.qr) return;
    const a = document.createElement('a'); a.href = qrData.qr; a.download = `QR-${selected?.customerCode}-${total}.png`; a.click();
  };
  const clearAll = () => { setSelected(null); setDone(null); setChecked({}); setSearch(''); setReceiptNo(''); setMethod('cash'); try { localStorage.setItem(DKEY, 'null'); } catch {} };
  const genReceiptNo = async () => {
    try { const { receiptNo } = (await api.get('/water/billing/next-receipt-no')).data.data as { receiptNo: string }; setReceiptNo(receiptNo); }
    catch (e) { toast.error(getErrorMessage(e, 'ดึงเลขใบเสร็จไม่สำเร็จ')); }
  };

  // text-base บนมือถือ — ต่ำกว่า 16px iPhone จะซูมจอตอนแตะช่อง
  const field = 'w-full rounded-xl border border-slate-200 px-3 py-3 text-base focus:border-sky-400 focus:outline-none sm:py-2.5 sm:text-sm';
  const info = (icon: any, label: string, val: any) => {
    const Icon = icon;
    return (<div className="flex items-start gap-2 text-sm"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><span className="shrink-0 text-slate-400">{label}</span><span className="min-w-0 flex-1 break-words text-slate-700">{val || '—'}</span></div>);
  };
  const methodBtn = (on: boolean) => `flex items-center justify-center gap-1.5 rounded-xl border py-3 text-base font-medium sm:py-2.5 sm:text-sm ${on ? 'border-sky-400 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-500'}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-lg font-bold text-slate-800"><Banknote className="h-5 w-5 text-emerald-500" /> รับชำระเงิน</h1>
        {/* จอลูกค้า = จอที่สองของเครื่องสำนักงาน — มือถือไม่ใช้ */}
        <button onClick={openDisplay} className="hidden items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-100 sm:inline-flex">
          <Monitor className="h-4 w-4" /> เปิดจอลูกค้า
        </button>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm sm:p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 sm:h-4 sm:w-4" />
          <input type="text" inputMode="search" placeholder="ค้นหา ชื่อ / รหัส / บ้านเลขที่ / เบอร์..." value={search}
            onChange={(e) => setSearch(e.target.value)} className={`${field} pl-10 sm:pl-9`} />
        </div>
        {/* ไล่ตามหมู่ (แบบภาคสนาม) — ไม่ต้องพิมพ์ค้นหา · มือถือเป็นช่องเลือก จอใหญ่เป็นปุ่ม */}
        {!!routes?.length && (
          <>
            <select value={village} onChange={(e) => { setVillage(e.target.value ? Number(e.target.value) : ''); setSearch(''); }}
              className={`${field} mt-2 sm:hidden`}>
              <option value="">หรือเลือกหมู่เพื่อไล่รายชื่อ</option>
              {routes.map((r: any) => <option key={r.villageNo} value={r.villageNo}>หมู่ {r.villageNo}</option>)}
            </select>
            <div className="mt-2 hidden flex-wrap items-center gap-1.5 sm:flex">
              <span className="text-xs text-slate-400">หรือเลือกหมู่:</span>
              <button onClick={() => setVillage('')}
                className={`rounded-lg border px-2.5 py-1 text-xs ${village === '' ? 'border-sky-400 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-500'}`}>ทั้งหมด</button>
              {routes.map((r: any) => (
                <button key={r.villageNo} onClick={() => { setVillage(r.villageNo); setSearch(''); }}
                  className={`rounded-lg border px-2.5 py-1 text-xs ${village === r.villageNo ? 'border-sky-400 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-500'}`}>
                  หมู่ {r.villageNo}
                </button>
              ))}
            </div>
          </>
        )}
        {browsing && (
          <div className="mt-2 max-h-[60vh] divide-y divide-slate-50 overflow-y-auto rounded-xl border border-slate-100">
            {(results || []).length === 0 ? <p className="p-3 text-center text-sm text-slate-400">ไม่พบผู้ใช้น้ำ</p>
              : results!.map((c) => (
                <button key={c.id} onClick={() => pick(c)} className="flex w-full items-center gap-3 px-3 py-3 text-left text-sm hover:bg-sky-50/50 active:bg-sky-50 sm:py-2.5">
                  <span className="shrink-0 font-mono text-sky-600">{c.customerCode}</span>
                  <span className="min-w-0 flex-1 truncate text-base text-slate-800 sm:text-sm">{c.fullName}</span>
                  <span className="shrink-0 text-xs text-slate-400">{c.villageNo ? `หมู่ ${c.villageNo}` : ''}</span>
                </button>
              ))}
          </div>
        )}
      </div>

      {!selected ? (
        <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">ค้นหาผู้ใช้น้ำเพื่อรับชำระบิลค้าง</div>
      ) : done ? (
        <div className="space-y-3 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 shadow-sm sm:p-5">
          <div className="flex items-start gap-2 text-emerald-700">
            <Check className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">รับชำระ {done.count} บิล · {money(done.total)} บาท</p>
              <p className="text-sm">เลขที่ใบเสร็จ {done.receiptNo}</p>
            </div>
          </div>
          <p className="text-xs text-slate-500">พิมพ์ใบเสร็จแต่ละบิล:</p>
          <div className="space-y-2">
            {done.bills.map((b: any) => (
              <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2.5 text-sm">
                <span className="font-medium text-slate-700">{MONTH_TH[b.periodMonth]} {b.periodYear} · {money(b.totalAmount)}</span>
                <div className="flex gap-1.5">
                  <button onClick={() => printBill(b.id, 'receipt', 'escpos')} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white sm:px-2.5 sm:py-1.5 sm:text-xs"><Printer className="h-3.5 w-3.5" /> PT-210</button>
                  <button onClick={() => printBill(b.id, 'receipt', 'pdf')} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 sm:px-2.5 sm:py-1.5 sm:text-xs"><FileText className="h-3.5 w-3.5" /> PDF</button>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => { setSelected(null); setDone(null); }} className="w-full rounded-xl border border-slate-200 bg-white py-3 text-base font-medium text-slate-600 sm:py-2 sm:text-sm">รับชำระรายถัดไป</button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 1. การ์ดข้อมูลผู้ใช้น้ำ */}
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-slate-100 pb-3">
              <User className="h-4 w-4 text-sky-500" />
              <span className="font-mono text-sky-600">{detail?.customerCode || selected.customerCode}</span>
              <span className="text-base font-semibold text-slate-900">{detail?.fullName || selected.fullName}</span>
              {detail?.usageStatus && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{USAGE_LABEL[detail.usageStatus] || detail.usageStatus}</span>}
              <button onClick={clearAll} className="ml-auto rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50">ล้างข้อมูล</button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {info(Gauge, 'หมายเลขมาตร', detail?.meterSerial)}
              {info(Phone, 'เบอร์โทร', detail?.phone)}
              {info(MapPin, 'ที่อยู่', custAddr)}
              {info(Gauge, 'เลขมาตรล่าสุด', detail?.meterLastReading)}
            </div>
          </div>

          {/* 2. รายการค้างชำระ (breakdown เต็ม) — มือถือเป็นการ์ดติ๊กได้ทั้งแถว · จอใหญ่เป็นตารางกลาง */}
          {unpaid.length === 0 ? (
            <p className="rounded-2xl border border-slate-100 bg-white py-6 text-center text-sm text-emerald-600 shadow-sm">ไม่มีบิลค้างชำระ 🎉</p>
          ) : (
            <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm sm:p-4">
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-sm font-semibold text-slate-700">รายการค้างชำระ ({unpaid.length})</p>
                <button onClick={toggleAll} className="rounded-lg px-2 py-1.5 text-sm font-medium text-sky-600 sm:text-xs">{allChecked ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}</button>
              </div>

              <div className="space-y-2 sm:hidden">
                {unpaid.map((b) => (
                  <label key={b.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${checked[b.id] ? 'border-sky-300 bg-sky-50/60' : 'border-slate-100'}`}>
                    <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={!!checked[b.id]} onChange={(e) => setChecked({ ...checked, [b.id]: e.target.checked })} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-base font-semibold text-slate-800">{MONTH_TH[b.periodMonth]} {String(b.periodYear).slice(-2)}</span>
                        <span className="text-base font-bold tabular-nums text-slate-900">{money(b.totalAmount)}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400">
                        <span className="font-mono">{b.billNo || b.periodRound || '—'}</span>
                        {' · '}ค่าน้ำ {money(b.waterAmount)} · บริการ {money(b.serviceFee)}
                        {Number(b.wastewaterFee) > 0 && ` · บำบัด ${money(b.wastewaterFee)}`}
                        {Number(b.tax) > 0 && ` · ภาษี ${money(b.tax)}`}
                        {Number(b.garbageFee) > 0 && ` · ขยะ ${money(b.garbageFee)}`}
                      </p>
                    </div>
                  </label>
                ))}
              </div>

              <TableCard className="hidden sm:block">
                <Table>
                  <THead>
                    <Th align="center"><input type="checkbox" checked={allChecked} onChange={toggleAll} /></Th>
                    <Th>งวด</Th><Th>เลขบิล</Th>
                    <Th align="right">ค่าน้ำ</Th><Th align="right">บริการ</Th><Th align="right">บำบัด</Th><Th align="right">ภาษี</Th><Th align="right">ขยะ</Th><Th align="right">รวม</Th>
                  </THead>
                  <tbody>
                    {unpaid.map((b) => (
                      <Tr key={b.id} onClick={() => setChecked({ ...checked, [b.id]: !checked[b.id] })} className={checked[b.id] ? 'bg-sky-50/50' : ''}>
                        <Td align="center"><input type="checkbox" checked={!!checked[b.id]} onClick={(e) => e.stopPropagation()} onChange={(e) => setChecked({ ...checked, [b.id]: e.target.checked })} /></Td>
                        <Td className="font-medium text-slate-700">{MONTH_TH[b.periodMonth]} {String(b.periodYear).slice(-2)}</Td>
                        <Td><CodeChip>{b.billNo || b.periodRound || '—'}</CodeChip></Td>
                        <Td align="right" className="font-mono text-slate-600">{money(b.waterAmount)}</Td>
                        <Td align="right" className="font-mono text-slate-600">{money(b.serviceFee)}</Td>
                        <Td align="right" className="font-mono text-slate-400">{money(b.wastewaterFee)}</Td>
                        <Td align="right" className="font-mono text-slate-400">{money(b.tax)}</Td>
                        <Td align="right" className="font-mono text-slate-400">{money(b.garbageFee)}</Td>
                        <Td align="right" className="font-mono font-semibold text-slate-800">{money(b.totalAmount)}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableCard>

              <div className="mt-3 flex items-center justify-between rounded-2xl bg-sky-600 px-4 py-3 text-white">
                <span className="text-sm">ยอดที่เลือก ({selectedBills.length} รายการ)</span>
                <span className="text-xl font-bold">{money(total)} บาท</span>
              </div>
            </div>
          )}

          {/* 3. ช่องทางชำระเงิน */}
          {unpaid.length > 0 && canManage && (
            <div className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
              <p className="text-sm font-semibold text-slate-700">ช่องทางชำระเงิน</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setMethod('cash')} className={methodBtn(method === 'cash')}><Banknote className="h-4 w-4" /> เงินสด</button>
                <button onClick={() => setMethod('qr')} className={methodBtn(method === 'qr')}><QrCode className="h-4 w-4" /> QR PromptPay</button>
              </div>

              {method === 'qr' && total > 0 && (
                qrData && !qrData.hasPromptpay ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-xs text-amber-700">ยังไม่ได้ตั้งเลขพร้อมเพย์ — ตั้งที่หน้า “ตั้งค่าระบบ (Admin)”</div>
                ) : (
                  <div className="rounded-2xl border border-sky-100 bg-sky-50/40 p-4 text-center">
                    {qrData?.qr ? (
                      <>
                        <p className="text-xs font-medium text-slate-600">สแกนด้วยแอปธนาคารเพื่อชำระเงิน</p>
                        <img src={qrData.qr} alt="QR พร้อมเพย์" className="mx-auto my-2 h-56 w-56 sm:h-48 sm:w-48" />
                        <p className="text-xs text-slate-500">{qrData.payeeName || 'พร้อมเพย์'} · <b className="text-sky-700">{money(total)} บาท</b></p>
                        <div className="mt-2 flex justify-center gap-2">
                          <button onClick={saveQr} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-white sm:px-2.5 sm:py-1.5 sm:text-xs"><Download className="h-3.5 w-3.5" /> บันทึก QR</button>
                          <button onClick={openDisplay} className="hidden items-center gap-1 rounded-lg border border-sky-200 bg-white px-2.5 py-1.5 text-xs text-sky-600 sm:inline-flex"><Monitor className="h-3.5 w-3.5" /> แสดงจอลูกค้า</button>
                        </div>
                      </>
                    ) : <p className="py-6 text-xs text-slate-400">กำลังสร้าง QR…</p>
                  }
                  </div>
                )
              )}

              {/* ประตูตรวจสลิป — จ่าย QR ต้องตรวจสลิปผ่านก่อนถึงกดรับชำระได้ */}
              {method === 'qr' && total > 0 && autoVerify && (
                <SlipVerifyGate
                  billIds={selectedBills.map((b) => b.id)}
                  amount={total}
                  verifyId={verifyId}
                  onVerified={(v) => setVerifyId(v?.verifyId || null)}
                />
              )}

              <div className="flex gap-2">
                <input value={receiptNo} onChange={(e) => setReceiptNo(e.target.value)} placeholder="เลขที่ใบเสร็จ (ว่าง = รันอัตโนมัติ)" className={field} />
                <button onClick={genReceiptNo} className="shrink-0 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-600 hover:bg-slate-50 sm:py-2.5">สร้างเลข</button>
              </div>
              {(() => {
                const locked = method === 'qr' && autoVerify && !verifyId;   // ยังไม่ตรวจสลิป = กดไม่ได้
                return (
                  <button onClick={() => pay.mutate()} disabled={pay.isPending || selectedBills.length === 0 || locked}
                    title={locked ? 'ต้องตรวจสลิปให้ผ่านก่อน' : ''}
                    className={`w-full rounded-xl py-3.5 text-base font-semibold text-white disabled:opacity-50 sm:py-3 sm:text-sm ${locked ? 'cursor-not-allowed bg-slate-300' : 'bg-emerald-600'}`}>
                    {locked ? 'รอตรวจสลิปก่อน' : `รับชำระ ${money(total)} บาท`}
                  </button>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
