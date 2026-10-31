'use client';
import { useState } from 'react';
import { PlaceFilter, placeMatch, type PlaceKind } from '@/components/market/place-filter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { money, periodLabel } from '@/lib/payment-labels';
import { Empty, Panel, inputCls } from './pay-ui';

export type QueueBill = {
  id: string; period: string; amount: string; status: string; slipUrl: string | null; submittedMethod: string | null; submittedAt: string | null;
  // ค่าแผง
  stallCode?: string; payerName?: string; kind?: 'rent' | 'waste';
  // ค่าขยะบ้าน
  householdRef?: string; holderName?: string; houseNo?: string; moo?: string;
};

const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

/** คิวรอตรวจ: บิลที่ประชาชนแจ้งชำระ (แนบสลิป หรือแจ้งจะจ่ายเงินสด) — เจ้าหน้าที่ยืนยันรับเงินหรือตีกลับพร้อมเหตุผล */
type SlipResult = { label: string; count: number; amount: number; ok: boolean; reason: string; receiptNos: string[] };

export function SlipQueue({ kind, canManage }: { kind: 'market' | 'waste'; canManage: boolean }) {
  const qc = useQueryClient();
  const [rejecting, setRejecting] = useState<QueueBill | null>(null);
  const [place, setPlace] = useState<PlaceKind>('all');
  const [note, setNote] = useState('');
  const [zoom, setZoom] = useState<string | null>(null);
  const [batch, setBatch] = useState<{ results: SlipResult[]; remaining: number } | null>(null);
  // ปุ่มตรวจอัตโนมัติใช้ได้เมื่อ อบต. ผูกโทเคนผู้ให้บริการตรวจสลิปไว้แล้ว
  const { data: tokenSet = false } = useQuery<boolean>({
    queryKey: [kind, 'slip-token'],
    queryFn: async () => !!(await api.get(`/${kind}/config`)).data.data?.slipTokenSet,
    staleTime: 60_000,
  });

  const { data, isLoading } = useQuery<QueueBill[]>({
    queryKey: [kind, 'queue'],
    queryFn: async () => (await api.get(`/${kind}/bills`, { params: { status: 'pending' } })).data.data,
    refetchInterval: 30_000,
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: [kind] }); };

  const verifyAll = useMutation({
    mutationFn: async () => (await api.post(`/${kind}/bills/verify-slips`)).data.data as { results: SlipResult[]; remaining: number },
    onSuccess: (d) => { setBatch(d); refresh(); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const confirm = useMutation({
    mutationFn: (b: QueueBill) => api.post(`/${kind}/bills/${b.id}/pay`, { method: b.submittedMethod === 'cash' ? 'cash' : 'transfer' }),
    onSuccess: () => { toast.success('บันทึกการรับเงินแล้ว'); refresh(); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const reject = useMutation({
    mutationFn: (b: QueueBill) => api.post(`/${kind}/bills/${b.id}/reject`, { note }),
    onSuccess: () => { toast.success('ตีกลับแล้ว ผู้จ่ายจะเห็นเหตุผลและแจ้งใหม่ได้'); setRejecting(null); setNote(''); refresh(); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const rows = [...(data ?? [])].filter((r) => kind !== 'market' || placeMatch(place, r.stallCode)).sort((a, b) => (a.submittedAt ?? '').localeCompare(b.submittedAt ?? ''));
  const slips = rows.filter((r) => r.submittedMethod !== 'cash');
  const cash = rows.filter((r) => r.submittedMethod === 'cash');

  const card = (b: QueueBill) => {
    const who = kind === 'market' ? b.payerName : b.holderName;
    const place = kind === 'market'
      ? `แผง ${b.stallCode} · ${b.kind === 'waste' ? 'ค่าขยะแผง' : 'ค่าเช่าแผง'}`
      : `บ้านเลขที่ ${b.houseNo} หมู่ ${Number(b.moo)} · ${b.householdRef}`;
    return (
      <article key={b.id} className="flex flex-wrap items-start gap-4 border-t border-gray-100 p-4 first:border-t-0">
        {b.slipUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={b.slipUrl} alt="สลิปโอนเงิน" onClick={() => setZoom(b.slipUrl)} className="h-24 w-24 shrink-0 cursor-zoom-in rounded-lg border border-gray-200 object-cover" />
        ) : (
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-dashed border-gray-300 px-2 text-center text-xs text-gray-400">ไม่มีสลิป<br />(จ่ายเงินสด)</div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900">{who}</p>
          <p className="text-sm text-gray-600">{place}</p>
          <p className="text-sm text-gray-500">งวด {periodLabel(b.period)} · แจ้งเมื่อ {fmtTime(b.submittedAt)}</p>
          <p className="mt-1 text-lg font-bold text-blue-700">{money(b.amount)} บาท</p>
        </div>
        {canManage && (
          <div className="flex shrink-0 flex-col gap-2">
            <Button size="sm" variant="success" loading={confirm.isPending && confirm.variables?.id === b.id} onClick={() => confirm.mutate(b)}>
              {b.submittedMethod === 'cash' ? 'รับเงินสดแล้ว' : 'ยืนยันรับเงิน'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setRejecting(b); setNote(''); }}>ตีกลับ</Button>
          </div>
        )}
      </article>
    );
  };

  return (
    <div className="space-y-5">
      {kind === 'market' && <PlaceFilter value={place} onChange={setPlace} />}
      {batch && (
        <Panel
          title={<>ผลตรวจสลิป <span className="text-sm font-normal text-gray-500">ผ่าน {batch.results.filter((r) => r.ok).length} · ไม่ผ่าน {batch.results.filter((r) => !r.ok).length}</span></>}
          actions={<Button size="sm" variant="outline" onClick={() => setBatch(null)}>ปิด</Button>}
        >
          <ul>
            {batch.results.map((r, i) => (
              <li key={i} className="flex flex-wrap items-start gap-3 border-t border-gray-100 px-4 py-3 first:border-t-0">
                <span className={r.ok ? 'rounded-full bg-green-100 px-2.5 py-0.5 text-sm font-semibold text-green-700' : 'rounded-full bg-red-100 px-2.5 py-0.5 text-sm font-semibold text-red-700'}>{r.ok ? 'ผ่าน' : 'ไม่ผ่าน'}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{r.label} <span className="font-normal text-gray-500">· {money(r.amount)} บาท</span></p>
                  <p className="text-sm text-gray-500">{r.ok ? `ชำระแล้ว · ใบเสร็จ ${r.receiptNos.join(', ')}` : `${r.reason} — ยังอยู่ในคิว ให้ดูรูปสลิปแล้วกดยืนยันหรือตีกลับเอง`}</p>
                </div>
              </li>
            ))}
            {!batch.results.length && <li><Empty>ไม่มีสลิปให้ตรวจ</Empty></li>}
          </ul>
          {batch.remaining > 0 && <p className="border-t border-gray-100 px-4 py-3 text-sm text-amber-700">ตรวจรอบนี้ {batch.results.length} รายการ เหลืออีก {batch.remaining} รายการ — กดตรวจอีกครั้งเพื่อตรวจต่อ</p>}
        </Panel>
      )}
      <Panel
        title={<>สลิปโอนรอตรวจ <span className="text-sm font-normal text-gray-500">({slips.length})</span></>}
        actions={canManage && slips.length > 0 && (
          <Button size="sm" disabled={!tokenSet} loading={verifyAll.isPending} onClick={() => verifyAll.mutate()}
            title={tokenSet ? 'ส่งสลิปทั้งหมดไปตรวจกับผู้ให้บริการ' : 'ผูกโทเคนตรวจสลิปที่แท็บ "ตั้งค่า" ก่อน'}>
            ตรวจสลิปทั้งหมด ({slips.length})
          </Button>
        )}
      >
        {canManage && slips.length > 0 && !tokenSet && <p className="border-b border-gray-100 px-4 py-2 text-sm text-gray-500">อยากให้ระบบตรวจสลิปให้ทั้งหมดในคลิกเดียว? ผูกโทเคน Slip2Go ที่แท็บ “ตั้งค่า” ก่อน</p>}
        {isLoading ? <Empty>กำลังโหลด…</Empty> : slips.length ? slips.map(card) : <Empty>ไม่มีสลิปรอตรวจ</Empty>}
      </Panel>
      <Panel title={<>แจ้งจ่ายเงินสด รอรับที่ อบต. <span className="text-sm font-normal text-gray-500">({cash.length})</span></>}>
        {isLoading ? <Empty>กำลังโหลด…</Empty> : cash.length ? cash.map(card) : <Empty>ไม่มีรายการรอรับเงินสด</Empty>}
      </Panel>

      <Dialog open={!!rejecting} onOpenChange={(o) => { if (!o) setRejecting(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>ตีกลับรายการ</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">เหตุผลนี้จะแสดงให้ผู้จ่ายเห็นตอนค้นหาบิล เพื่อแก้ไขแล้วแจ้งชำระใหม่</p>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={3} placeholder="เช่น ยอดในสลิปไม่ตรงกับบิล / สลิปไม่ชัด"
            className={inputCls} />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRejecting(null)}>ยกเลิก</Button>
            <Button variant="destructive" loading={reject.isPending} onClick={() => rejecting && reject.mutate(rejecting)}>ตีกลับ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {zoom && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" onClick={() => setZoom(null)} role="dialog" aria-label="ดูสลิป">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="สลิปโอนเงิน" className="max-h-full max-w-full rounded-lg bg-white" />
        </div>
      )}
    </div>
  );
}
