'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/water-api';
import { toast } from '@/hooks/use-toast';
import { MONTH_TH } from '@/lib/baht-text';
import { CalendarClock, ChevronRight, Wallet, Lock, RefreshCw, FileText } from 'lucide-react';
import { useCanManage } from '../use-can-manage';
import { TableCard, Table, THead, Th, Td, Tr, TableMessage, Dash } from '@/components/shared/table';

const money = (n: any) => Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const todayISO = () => new Date().toISOString().slice(0, 10);
const dateTh = (s: string) => new Date(s).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });

type Round = { periodYear: number; periodMonth: number; read: number; paid: number; customers: number };
type Remit = { id: string; remitDate: string; billCount: number; totalAmount: string; note: string | null };

export default function PrapaRoundPage() {
  const canManage = useCanManage();
  const router = useRouter();
  const qc = useQueryClient();
  const [remitDate, setRemitDate] = useState(todayISO());
  const [note, setNote] = useState('');

  const { data: round } = useQuery({
    queryKey: ['water-round'],
    queryFn: async () => (await api.get('/water/billing/round')).data.data as Round,
  });
  const { data: remits } = useQuery({
    queryKey: ['water-remit'],
    queryFn: async () => (await api.get('/water/billing/remittance')).data.data as Remit[],
  });
  const { data: routes } = useQuery({
    queryKey: ['water-routes-round', round?.periodYear, round?.periodMonth],
    enabled: !!round,
    queryFn: async () => (await api.get('/water/billing/routes', { params: { year: round!.periodYear, month: round!.periodMonth } })).data.data as any[],
  });
  const unread = (routes || []).map((r) => ({ villageNo: r.villageNo, left: (r.customers || 0) - (r.read || 0) })).filter((r) => r.left > 0).sort((a, b) => b.left - a.left);
  const totalLeft = unread.reduce((s, r) => s + r.left, 0);

  const advance = useMutation({
    mutationFn: async () => (await api.post('/water/billing/round', {})).data,
    onSuccess: () => { toast.success('เปลี่ยนรอบบิลแล้ว'); qc.invalidateQueries({ queryKey: ['water-round'] }); },
    onError: (e) => toast.error(getErrorMessage(e, 'เปลี่ยนรอบไม่สำเร็จ')),
  });
  const closeRemit = useMutation({
    mutationFn: async () => (await api.post('/water/billing/remittance', { date: remitDate, note: note || undefined })).data,
    onSuccess: () => { toast.success('ปิดรอบส่งเงินแล้ว'); setNote(''); qc.invalidateQueries({ queryKey: ['water-remit'] }); },
    onError: (e) => toast.error(getErrorMessage(e, 'ปิดรอบไม่สำเร็จ')),
  });

  const readPct = round && round.customers ? Math.round((round.read / round.customers) * 100) : 0;
  // กดหมู่ที่ยังไม่จด → ไปหน้าจดมิเตอร์ของหมู่นั้นเลย (หน้าจดอ่านหมู่ล่าสุดจาก localStorage)
  const goReading = (villageNo: number) => { localStorage.setItem('prapa-reading-village', String(villageNo)); router.push('/prapa/reading'); };
  // text-base บนมือถือ — ต่ำกว่า 16px iPhone จะซูมจอตอนแตะช่อง
  const field = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base focus:border-sky-400 focus:outline-none sm:py-2.5 sm:text-sm';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-5 w-5 text-sky-600" />
        <h1 className="text-lg font-bold text-slate-800">รอบบิล & รอบส่งเงิน</h1>
      </div>

      {/* รอบบิลปัจจุบัน */}
      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">รอบบิลปัจจุบัน</p>
        {round ? (
          <>
            <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
              <p className="text-2xl font-bold text-slate-800">{MONTH_TH[round.periodMonth]} {round.periodYear}</p>
              <p className="text-sm text-slate-500">จดแล้ว <b className="text-base text-sky-700">{readPct}%</b></p>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${readPct}%` }} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Stat label="จดแล้ว" value={round.read} sub={`จาก ${round.customers.toLocaleString()} ราย`} tone="text-sky-700" />
              <Stat label="เก็บเงินแล้ว" value={round.paid} sub="ราย" tone="text-emerald-700" />
              <Stat label="ยังไม่จด" value={Math.max(0, round.customers - round.read)} sub="ราย" tone="text-amber-600" />
            </div>
            {canManage && (
              <button onClick={() => { if (confirm(`เปลี่ยนรอบบิลไปเดือนถัดไป?\n(${MONTH_TH[round.periodMonth]} ${round.periodYear} → เดือนถัดไป)`)) advance.mutate(); }}
                disabled={advance.isPending}
                className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-sky-600 px-4 py-3 text-base font-semibold text-white transition hover:bg-sky-700 disabled:opacity-50 sm:w-auto sm:py-2.5 sm:text-sm">
                <ChevronRight className="h-5 w-5" /> เปลี่ยนรอบ (เดือนถัดไป)
              </button>
            )}
          </>
        ) : <p className="mt-2 text-sm text-slate-400">กำลังโหลด…</p>}
        <p className="mt-3 text-xs text-slate-400">รอบบิลคือค่าเริ่มต้นของงวดในหน้าจดมิเตอร์ · เปลี่ยนรอบเมื่อจด/เก็บเดือนนี้ครบแล้ว</p>
      </section>

      {/* ยังไม่จดรอบนี้ — ไล่ให้ครบก่อนปิดรอบ (ตรวจ ตามระบบเก่า) · กดหมู่ = ไปจดต่อ */}
      {totalLeft > 0 && (
        <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">ยังไม่จดรอบนี้</p>
          <p className="mt-1 text-sm text-slate-500">เหลือ <b className="text-amber-600">{totalLeft.toLocaleString()}</b> ราย — กดหมู่เพื่อไปจดต่อ</p>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
            {unread.map((r) => (
              <button key={r.villageNo ?? 'x'} onClick={() => r.villageNo && goReading(r.villageNo)}
                className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 transition hover:bg-amber-100 active:scale-[.97] sm:py-1.5">
                <span>หมู่ {r.villageNo ?? '-'}</span><b className="tabular-nums">{r.left}</b>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ปิดรอบส่งเงิน */}
      {canManage && (
        <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <Wallet className="h-4 w-4" /> ปิดรอบส่งเงินประจำวัน
          </p>
          <p className="mt-1 text-sm text-slate-500">สรุปยอดเงินที่รับชำระในวันนั้น (นำส่งการเงิน) — บันทึกซ้ำได้ ระบบจะคำนวณยอดใหม่ให้</p>
          <div className="mt-3 grid gap-3 sm:flex sm:items-end">
            <label className="block text-sm sm:w-48">
              <span className="mb-1 block text-slate-500">วันที่ส่งเงิน</span>
              <input type="date" value={remitDate} onChange={(e) => setRemitDate(e.target.value)} className={field} />
            </label>
            <label className="block text-sm sm:flex-1">
              <span className="mb-1 block text-slate-500">หมายเหตุ (ถ้ามี)</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น นำส่ง กองคลัง" className={field} />
            </label>
            <button onClick={() => closeRemit.mutate()} disabled={closeRemit.isPending}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-3 text-base font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50 sm:py-2.5 sm:text-sm">
              <Lock className="h-4 w-4" /> ปิดรอบวันนี้
            </button>
          </div>
        </section>
      )}

      {/* ประวัติรอบส่งเงิน = ป.32 สรุปรายรับประจำวัน — มือถือเป็นการ์ด · จอใหญ่เป็นตารางกลาง */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <RefreshCw className="h-4 w-4" /> ป.32 สรุปรายรับประจำวัน
          </p>
          {/* รายงาน ป.32 ตัวจริง (หัวกระดาษราชการ · Excel/PDF) อยู่ที่หน้ารายงาน — ที่นี่เป็นแค่ประวัติปิดรอบ */}
          <Link href="/prapa/report?tab=p32" className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-700 hover:bg-sky-100 print:hidden">
            <FileText className="h-3.5 w-3.5" /> เปิดรายงาน ป.32
          </Link>
        </div>

        <div className="space-y-2 sm:hidden">
          {remits?.length ? remits.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm">
              <div className="min-w-0">
                <p className="font-semibold text-slate-800">{dateTh(r.remitDate)}</p>
                <p className="truncate text-xs text-slate-400">{r.billCount} ใบเสร็จ{r.note ? ` · ${r.note}` : ''}</p>
              </div>
              <p className="shrink-0 text-base font-bold tabular-nums text-emerald-700">{money(r.totalAmount)}</p>
            </div>
          )) : <p className="rounded-2xl border border-slate-100 bg-white py-8 text-center text-sm text-slate-400">ยังไม่มีรายการปิดรอบส่งเงิน</p>}
        </div>

        <TableCard className="hidden sm:block">
          <Table>
            <THead>
              <Th>วันที่ส่งเงิน</Th><Th align="right">จำนวนใบเสร็จ</Th><Th align="right">ยอดรวม (บาท)</Th><Th>หมายเหตุ</Th>
            </THead>
            <tbody>
              {remits?.length ? remits.map((r) => (
                <Tr key={r.id}>
                  <Td className="font-medium text-slate-700">{dateTh(r.remitDate)}</Td>
                  <Td align="right" className="font-mono text-slate-600">{r.billCount}</Td>
                  <Td align="right" className="font-mono font-semibold text-emerald-700">{money(r.totalAmount)}</Td>
                  <Td className="text-slate-500">{r.note || <Dash />}</Td>
                </Tr>
              )) : <TableMessage colSpan={4}>ยังไม่มีรายการปิดรอบส่งเงิน</TableMessage>}
            </tbody>
          </Table>
        </TableCard>
      </section>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: number; sub: string; tone: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-2 py-2.5 text-center">
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${tone}`}>{value.toLocaleString()}</p>
      <p className="text-[10px] text-slate-400">{sub}</p>
    </div>
  );
}
