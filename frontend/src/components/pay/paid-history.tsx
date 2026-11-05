'use client';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { periodLabel, money } from '@/lib/payment-labels';
import { Empty, Field, MethodChip, Metric, Panel, SlipButton, inputCls, recentPeriods, useOrgName } from '@/components/pay/pay-ui';
import { printReceipt, printReport } from '@/components/pay/receipt-print';

/** บิลที่ชำระแล้ว (ค่าแผง/ค่าขยะ) — ใช้ฟิลด์ร่วมของทั้งสองประเภท */
type PaidBill = {
  id: string; period: string; amount: string; paidMethod: string | null; paidAt: string | null; receiptNo: string | null;
  slipUrl: string | null; slipTransRef: string | null;
  stallCode?: string; payerName?: string; kind?: 'rent' | 'waste';
  householdRef?: string; holderName?: string; houseNo?: string; moo?: string;
};
type Row = PaidBill & { who: string; place: string; item: string; how: 'auto' | 'staff' | 'cash'; };

const HOW_LABEL: Record<Row['how'], string> = { auto: 'ระบบตรวจสลิปอัตโนมัติ', staff: 'เจ้าหน้าที่ยืนยัน', cash: 'รับเงินสด' };
const HOW_TONE: Record<Row['how'], string> = { auto: 'bg-green-50 text-green-700', staff: 'bg-blue-50 text-blue-700', cash: 'bg-gray-100 text-gray-700' };

const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

/**
 * แท็บ "ชำระแล้ว": ใครจ่าย จ่ายอะไร งวดไหน เท่าไร เมื่อไร ผ่านวิธีไหน ใครตรวจ (ระบบตรวจสลิปอัตโนมัติ/เจ้าหน้าที่/เงินสด)
 * + เลขใบเสร็จ รูปสลิป พิมพ์ใบเสร็จซ้ำ · สลิปใบเดียวหลายบิล: เลขอ้างอิงเก็บที่บิลแรก จึงนับทั้งกลุ่มว่าตรวจอัตโนมัติ
 */
export function PaidHistory({ kind }: { kind: 'market' | 'waste' }) {
  const orgName = useOrgName();
  const periods = recentPeriods(12);
  const [q, setQ] = useState('');
  const [period, setPeriod] = useState('');
  const [how, setHow] = useState<'' | Row['how']>('');
  const [zoom, setZoom] = useState<string | null>(null);

  const { data = [], isLoading } = useQuery<PaidBill[]>({
    queryKey: [kind, 'paid-history', period],
    queryFn: async () => (await api.get(`/${kind}/bills`, { params: { status: 'paid', period: period || undefined } })).data.data,
    refetchInterval: 20_000,
  });

  // ชื่อแผง: แผงประจำ = โซน · แผงลอย = ชื่อจุดที่เช่า (บิลมีแต่รหัส OUT-xxxx / รหัสแผง)
  const { data: stalls = [] } = useQuery<{ stallCode: string; zone: string }[]>({ queryKey: ['market', 'stalls'], queryFn: async () => (await api.get('/market/stalls')).data.data, enabled: kind === 'market', staleTime: 60_000 });
  const { data: outside = [] } = useQuery<{ appCode: string; location?: { name?: string } }[]>({ queryKey: ['market', 'outside', 'apps', 'all-names'], queryFn: async () => (await api.get('/market/outside/applications')).data.data, enabled: kind === 'market', staleTime: 60_000 });
  const placeOf = (code: string) => {
    const o = outside.find((x) => x.appCode === code);
    if (o) return `แผงลอย ${code}${o.location?.name ? ' · ' + o.location.name : ''}`;
    const st = stalls.find((x) => x.stallCode === code);
    return `แผง ${code}${st ? ' · โซน ' + st.zone : ''}`;
  };
  const rows = useMemo<Row[]>(() => {
    const base = (u: string) => u.split('?')[0]; // URL สลิปที่เซ็นแล้วต่างกันต่อบิล — เทียบเฉพาะพาธ
    const autoSlips = new Set(data.filter((b) => b.slipTransRef && b.slipUrl).map((b) => base(b.slipUrl as string)));
    return data.map((b) => {
      const transfer = b.paidMethod === 'transfer' || b.paidMethod === 'qr';
      const auto = transfer && (!!b.slipTransRef || (!!b.slipUrl && autoSlips.has(base(b.slipUrl))));
      return {
        ...b,
        who: (kind === 'market' ? b.payerName : b.holderName) ?? '—',
        place: kind === 'market' ? placeOf(b.stallCode ?? '') : `บ้านเลขที่ ${b.houseNo} หมู่ ${Number(b.moo)} · ${b.householdRef}`,
        item: kind === 'market' ? (b.kind === 'waste' ? 'ค่าขยะแผง' : 'ค่าเช่าแผง') : 'ค่าเก็บขยะ',
        how: auto ? 'auto' : transfer ? 'staff' : 'cash',
      } as Row;
    }).sort((a, b) => (b.paidAt ?? '').localeCompare(a.paidAt ?? ''));
  }, [data, kind, stalls, outside]); // eslint-disable-line react-hooks/exhaustive-deps

  const key = q.trim().toLowerCase();
  const shown = rows.filter((r) => (!how || r.how === how) && (!key || `${r.who} ${r.place} ${r.receiptNo ?? ''}`.toLowerCase().includes(key)));
  const total = shown.reduce((s, r) => s + Number(r.amount), 0);
  const count = (h: Row['how']) => shown.filter((r) => r.how === h).length;

  const print = (r: Row) => {
    const ok = printReceipt({
      orgName, receiptNo: r.receiptNo, payer: r.who, place: kind === 'market' ? r.place : `บ้านเลขที่ ${r.houseNo} หมู่ ${Number(r.moo)}`,
      lines: [{ label: `${r.item} ${periodLabel(r.period)}`, amount: r.amount }], method: r.paidMethod, paidAt: r.paidAt,
    });
    if (!ok) toast.error('เปิดหน้าพิมพ์ไม่ได้ — อนุญาตป็อปอัปของเว็บนี้แล้วลองใหม่');
  };

  const printList = () => {
    const ok = printReport({ orgName, title: kind === 'market' ? 'รายงานการรับชำระค่าแผงตลาด' : 'รายงานการรับชำระค่าธรรมเนียมเก็บขยะ', subtitle: `งวด: ${period ? periodLabel(period) : 'ทุกงวด'} · ผู้ตรวจ/วิธีรับ: ${how ? HOW_LABEL[how] : 'ทั้งหมด'}${q ? ` · ค้นหา “${q}”` : ''}`, columns: [{ label: 'วันเวลาชำระ' }, { label: kind === 'market' ? 'ผู้เช่า' : 'ผู้รับบิล' }, { label: kind === 'market' ? 'แผง' : 'บ้านเลขที่' }, { label: 'รายการ/งวด' }, { label: 'วิธีชำระ' }, { label: 'ผู้ตรวจ' }, { label: 'เลขใบเสร็จ' }, { label: 'จำนวนเงิน (บาท)', align: 'right' }], rows: shown.map((r) => [fmtTime(r.paidAt), r.who, r.place, `${r.item} ${periodLabel(r.period)}`, r.paidMethod === 'cash' ? 'เงินสด' : 'โอน', HOW_LABEL[r.how], r.receiptNo ?? '—', money(r.amount)]), totalRow: ['', '', '', '', '', '', 'รวมทั้งสิ้น', money(total)], signers: ['ผู้จัดทำรายงาน', 'เจ้าหน้าที่การเงิน', 'ผู้อนุมัติ'] });
    if (!ok) toast.error('เปิดหน้าพิมพ์ไม่ได้ — อนุญาตป็อปอัปของเว็บนี้แล้วลองใหม่');
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="ชำระแล้ว" value={`${shown.length} รายการ`} sub={period ? periodLabel(period) : 'ทุกงวด'} tone="ok" />
        <Metric label="ยอดรวม" value={`${money(total)} บาท`} tone="ok" />
        <Metric label="ระบบตรวจสลิปอัตโนมัติ" value={`${count('auto')} รายการ`} sub="ผ่าน Slip2Go" />
        <Metric label="เจ้าหน้าที่ยืนยัน / เงินสด" value={`${count('staff')} / ${count('cash')}`} />
      </div>

      <Panel title="รายการที่ชำระแล้ว" actions={<Button size="sm" variant="outline" onClick={printList}>พิมพ์รายงาน</Button>}>
        <div className="flex flex-wrap items-end gap-3 border-b border-gray-100 p-4">
          <Field label="ค้นหา" className="min-w-52 flex-1">
            <input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder={kind === 'market' ? 'ชื่อ / รหัสแผง / เลขใบเสร็จ' : 'ชื่อ / บ้านเลขที่ / เลขใบเสร็จ'} />
          </Field>
          <Field label="งวด" className="w-44">
            <select className={inputCls} value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="">ทุกงวด</option>
              {periods.map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}
            </select>
          </Field>
          <Field label="ผู้ตรวจ/วิธีรับ" className="w-52">
            <select className={inputCls} value={how} onChange={(e) => setHow(e.target.value as '' | Row['how'])}>
              <option value="">ทั้งหมด</option>
              <option value="auto">ระบบตรวจสลิปอัตโนมัติ</option>
              <option value="staff">เจ้าหน้าที่ยืนยัน</option>
              <option value="cash">รับเงินสด</option>
            </select>
          </Field>
        </div>

        {isLoading ? <p className="p-6 text-sm text-gray-500">กำลังโหลด…</p> : shown.length === 0 ? <Empty>ยังไม่มีรายการที่ชำระแล้วตามที่เลือก</Empty> : (
          <ul>
            {shown.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start gap-4 border-t border-gray-100 p-4 first:border-t-0">
                {r.slipUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.slipUrl} alt="สลิปโอนเงิน" onClick={() => setZoom(r.slipUrl)} className="h-16 w-16 shrink-0 cursor-zoom-in rounded-lg border border-gray-200 object-cover" />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-gray-300 px-1 text-center text-[11px] text-gray-400">{r.paidMethod === 'cash' ? 'เงินสด' : 'ไม่มีรูปสลิป'}</div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900">{r.who}</p>
                  <p className="text-sm text-gray-600">{r.place}</p>
                  <p className="text-sm text-gray-500">{r.item} · งวด {periodLabel(r.period)}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <MethodChip method={r.paidMethod} />
                    <span className={`rounded-full px-2 py-0.5 font-medium ${HOW_TONE[r.how]}`}>{HOW_LABEL[r.how]}</span>
                    <span className="text-gray-500">{fmtTime(r.paidAt)}</span>
                    {r.receiptNo && <span className="text-gray-500">ใบเสร็จ {r.receiptNo}</span>}
                    {r.slipTransRef && <span className="text-gray-400">อ้างอิงสลิป {r.slipTransRef}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <p className="text-lg font-bold text-green-700">{money(r.amount)} บาท</p>
                  <div className="flex items-center gap-2"><SlipButton url={r.slipUrl} method={r.paidMethod} /><Button size="sm" variant="outline" onClick={() => print(r)}>พิมพ์ใบเสร็จ</Button></div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {zoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setZoom(null)} role="dialog" aria-label="รูปสลิป">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="สลิปโอนเงิน" className="max-h-full max-w-full rounded-lg bg-white" />
        </div>
      )}
    </div>
  );
}
