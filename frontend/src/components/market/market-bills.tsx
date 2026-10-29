'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { BILL_STATUS, PAY_METHOD, periodLabel, money } from '@/lib/payment-labels';
import { Empty, Field, Panel, inputCls, recentPeriods } from '@/components/pay/pay-ui';
import { printReceipt } from '@/components/pay/receipt-print';

export type Bill = {
  id: string; stallCode: string; payerName: string; kind: 'rent' | 'waste'; period: string; amount: string; status: string;
  paidMethod: string | null; paidAt: string | null; receiptNo: string | null; submittedMethod: string | null; reviewNote: string | null;
};
export const KIND_LABEL: Record<Bill['kind'], string> = { rent: 'ค่าเช่าแผง', waste: 'ค่าขยะแผง' };

const STATUS_TONE: Record<string, string> = {
  unpaid: 'bg-red-50 text-red-700', pending: 'bg-amber-50 text-amber-700', paid: 'bg-green-50 text-green-700', mismatch: 'bg-orange-50 text-orange-700',
};

/** แท็บบิลค่าแผง: ออกบิลประจำงวด · เพิ่มบิลเอง · ค้น/กรอง · รับชำระ · ยกเลิกบิล · พิมพ์ใบเสร็จ */
export function MarketBills({ canManage, orgName, initialStall, initialStatus }: {
  canManage: boolean; orgName: string; initialStall?: string; initialStatus?: string;
}) {
  const qc = useQueryClient();
  const periods = recentPeriods(12);
  const [status, setStatus] = useState(initialStatus ?? '');
  const [period, setPeriod] = useState('');
  const [stall, setStall] = useState(initialStall ?? '');
  const [genPeriod, setGenPeriod] = useState(periods[0]);
  const [method, setMethod] = useState<Record<string, string>>({});
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ stallCode: '', kind: 'rent' as Bill['kind'], period: periods[0], amount: '' });

  const { data, isLoading } = useQuery<Bill[]>({
    queryKey: ['market', 'bills', status, period, stall.trim().toUpperCase()],
    queryFn: async () => (await api.get('/market/bills', { params: { status: status || undefined, period: period || undefined, stallCode: stall.trim().toUpperCase() || undefined } })).data.data,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['market'] });

  const generate = useMutation({
    mutationFn: () => api.post('/market/bills/generate', { period: genPeriod }),
    onSuccess: (r) => {
      const d = r.data.data as { created: number; skipped: number };
      toast.success(d.created ? `ออกบิลงวด ${periodLabel(genPeriod)} แล้ว ${d.created} ใบ` : `งวด ${periodLabel(genPeriod)} มีบิลครบแล้ว ไม่มีบิลใหม่`);
      refresh();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const pay = useMutation({
    mutationFn: ({ id, m }: { id: string; m: string }) => api.post(`/market/bills/${id}/pay`, { method: m }),
    onSuccess: () => { toast.success('บันทึกการรับชำระแล้ว'); refresh(); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/market/bills/${id}`),
    onSuccess: () => { toast.success('ยกเลิกบิลแล้ว'); setCancelId(null); refresh(); },
    onError: (e) => { toast.error(getErrorMessage(e)); setCancelId(null); },
  });
  const create = useMutation({
    mutationFn: () => api.post('/market/bills', { stallCode: draft.stallCode.trim().toUpperCase(), kind: draft.kind, period: draft.period, amount: Number(draft.amount) }),
    onSuccess: () => { toast.success('เพิ่มบิลแล้ว'); setAdding(false); setDraft({ ...draft, stallCode: '', amount: '' }); refresh(); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const rows = data ?? [];
  const openTotal = rows.filter((b) => b.status !== 'paid').reduce((s, b) => s + Number(b.amount), 0);
  const doPrint = (b: Bill) => {
    const ok = printReceipt({
      orgName, receiptNo: b.receiptNo, payer: b.payerName, place: `แผง ${b.stallCode}`,
      lines: [{ label: `${KIND_LABEL[b.kind]} ${periodLabel(b.period)}`, amount: b.amount }], method: b.paidMethod, paidAt: b.paidAt,
    });
    if (!ok) toast.error('เปิดหน้าพิมพ์ไม่ได้ — อนุญาตป็อปอัปของเว็บนี้แล้วลองใหม่');
  };

  return (
    <div className="space-y-5">
      {canManage && (
        <Panel title="ออกบิลประจำงวด" actions={<Button size="sm" variant="outline" onClick={() => setAdding((v) => !v)}>{adding ? 'ปิดฟอร์ม' : '+ เพิ่มบิลเอง'}</Button>}>
          <div className="flex flex-wrap items-end gap-3 p-4">
            <Field label="งวด" className="w-48">
              <select className={inputCls} value={genPeriod} onChange={(e) => setGenPeriod(e.target.value)}>
                {periods.map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}
              </select>
            </Field>
            <Button loading={generate.isPending} onClick={() => generate.mutate()}>ออกบิลค่าเช่า + ค่าขยะแผง</Button>
            <p className="basis-full text-xs text-gray-500">ออกให้ทุกแผงที่มีผู้เช่า ตามค่าเช่าของแผงและค่าขยะที่ตั้งไว้ · กดซ้ำได้ ไม่ออกบิลซ้ำ</p>
          </div>
          {adding && (
            <div className="grid gap-3 border-t border-gray-100 p-4 sm:grid-cols-5">
              <Field label="รหัสแผง"><input className={inputCls} value={draft.stallCode} onChange={(e) => setDraft({ ...draft, stallCode: e.target.value })} placeholder="A06" /></Field>
              <Field label="รายการ">
                <select className={inputCls} value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as Bill['kind'] })}>
                  <option value="rent">ค่าเช่าแผง</option><option value="waste">ค่าขยะแผง</option>
                </select>
              </Field>
              <Field label="งวด">
                <select className={inputCls} value={draft.period} onChange={(e) => setDraft({ ...draft, period: e.target.value })}>
                  {recentPeriods(36).map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}
                </select>
              </Field>
              <Field label="ยอด (บาท)"><input type="number" min={0} className={inputCls} value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} /></Field>
              <div className="flex items-end"><Button loading={create.isPending} disabled={!draft.stallCode.trim() || !(Number(draft.amount) > 0)} onClick={() => create.mutate()}>เพิ่มบิล</Button></div>
            </div>
          )}
        </Panel>
      )}

      <Panel
        title="รายการบิล"
        actions={<span className="text-sm text-gray-500">ยอดยังไม่ชำระในรายการนี้ <b className="text-gray-800">{money(openTotal)}</b> บาท</span>}
      >
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 p-4">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputCls} w-auto`}>
            <option value="">ทุกสถานะ</option>
            {Object.entries(BILL_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className={`${inputCls} w-auto`}>
            <option value="">ทุกงวด</option>
            {recentPeriods(36).map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}
          </select>
          <input value={stall} onChange={(e) => setStall(e.target.value)} placeholder="รหัสแผง เช่น A06" className={`${inputCls} w-40`} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-2">แผง</th><th className="px-4 py-2">ผู้เช่า</th><th className="px-4 py-2">รายการ</th><th className="px-4 py-2">งวด</th>
                <th className="px-4 py-2 text-right">ยอด (บาท)</th><th className="px-4 py-2">สถานะ</th><th className="px-4 py-2">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id} className="border-t border-gray-100 align-top">
                  <td className="px-4 py-2 font-medium">{b.stallCode}</td>
                  <td className="px-4 py-2">{b.payerName}</td>
                  <td className="px-4 py-2">{KIND_LABEL[b.kind]}</td>
                  <td className="px-4 py-2">{periodLabel(b.period)}</td>
                  <td className="px-4 py-2 text-right">{money(b.amount)}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[b.status] ?? 'bg-gray-100 text-gray-600'}`}>{BILL_STATUS[b.status] ?? b.status}</span>
                    {b.status === 'paid' && <span className="mt-1 block text-xs text-gray-500">{b.paidMethod ? PAY_METHOD[b.paidMethod] : ''} · {b.receiptNo}</span>}
                    {b.status === 'mismatch' && b.reviewNote && <span className="mt-1 block text-xs text-orange-700">{b.reviewNote}</span>}
                  </td>
                  <td className="px-4 py-2">
                    {b.status === 'paid' ? (
                      <Button size="sm" variant="outline" onClick={() => doPrint(b)}>พิมพ์ใบเสร็จ</Button>
                    ) : canManage ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <select value={method[b.id] ?? (b.submittedMethod === 'cash' ? 'cash' : b.submittedMethod === 'transfer' ? 'transfer' : 'cash')}
                          onChange={(e) => setMethod({ ...method, [b.id]: e.target.value })} className="rounded-md border border-gray-300 px-2 py-1 text-xs">
                          {Object.entries(PAY_METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                        <Button size="sm" loading={pay.isPending && pay.variables?.id === b.id}
                          onClick={() => pay.mutate({ id: b.id, m: method[b.id] ?? (b.submittedMethod === 'transfer' ? 'transfer' : 'cash') })}>รับชำระ</Button>
                        <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setCancelId(b.id)}>ยกเลิกบิล</Button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={7}>{isLoading ? <Empty>กำลังโหลด…</Empty> : <Empty>ไม่มีบิลในรายการนี้</Empty>}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {rows.length >= 500 && <p className="border-t border-gray-100 px-4 py-2 text-xs text-amber-700">แสดง 500 รายการล่าสุด — กรองตามสถานะ/งวด/แผงเพื่อดูส่วนที่เหลือ</p>}
      </Panel>

      <ConfirmDialog
        open={!!cancelId}
        onOpenChange={(o) => { if (!o) setCancelId(null); }}
        onConfirm={() => cancelId && remove.mutate(cancelId)}
        loading={remove.isPending}
        title="ยกเลิกบิลนี้?"
        description="บิลจะถูกลบออกจากระบบ (ใช้กรณีออกผิดหรือเลิกเช่า) — บิลที่ชำระแล้วลบไม่ได้"
        confirmText="ยกเลิกบิล"
      />
    </div>
  );
}
