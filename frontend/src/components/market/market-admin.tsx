'use client';
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/auth.store';
import { BILL_STATUS, PAY_METHOD, periodLabel, money } from '@/lib/payment-labels';

type Stall = { id: string; stallCode: string; zone: string; status: 'available' | 'reserved' | 'occupied'; tenantName: string | null; monthlyRate: string };
type Bill = { id: string; stallCode: string; payerName: string; kind: 'rent' | 'waste'; period: string; amount: string; status: string; paidMethod: string | null; receiptNo: string | null };

const STALL_LABEL = { available: 'ว่าง', reserved: 'จอง', occupied: 'มีผู้เช่า' } as const;
// สีตามผังเดิม: มีผู้เช่า = ฟ้าอ่อน · จอง = เหลืองอ่อน · ว่าง = ขาว
const STALL_TONE = {
  available: 'border-slate-200 bg-white text-slate-600',
  reserved: 'border-amber-300 bg-amber-50 text-amber-800',
  occupied: 'border-sky-300 bg-sky-100 text-sky-800',
} as const;
const KIND_LABEL: Record<Bill['kind'], string> = { rent: 'ค่าเช่าแผง', waste: 'ค่าขยะแผง' };

export function MarketAdmin() {
  const canManage = useAuthStore((s) => s.hasPermission('market:manage:MarketBill'));
  const qc = useQueryClient();
  const [tab, setTab] = useState<'plan' | 'bills'>('plan');
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Stall | null>(null);
  const canEditStall = useAuthStore((s) => s.hasPermission('market:manage:MarketStall'));

  const stalls =useQuery<Stall[]>({ queryKey: ['market-stalls'], queryFn: async () => (await api.get('/market/stalls')).data.data });
  const bills = useQuery<Bill[]>({
    queryKey: ['market-bills', status],
    queryFn: async () => (await api.get('/market/bills', { params: status ? { status } : {} })).data.data,
  });

  const pay = useMutation({
    mutationFn: ({ id, m }: { id: string; m: string }) => api.post(`/market/bills/${id}/pay`, { method: m }),
    onSuccess: () => {
      toast('บันทึกการรับชำระแล้ว');
      qc.invalidateQueries({ queryKey: ['market-bills'] });
    },
    onError: (e) => toast(getErrorMessage(e), { variant: 'error' }),
  });

  const saveStall = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) => api.patch(`/market/stalls/${id}`, body),
    onSuccess: () => {
      toast('บันทึกแผงแล้ว');
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['market-stalls'] });
    },
    onError: (e) => toast(getErrorMessage(e), { variant: 'error' }),
  });

  const byZone = useMemo(() => {
    const m = new Map<string, Stall[]>();
    for (const s of stalls.data ?? []) m.set(s.zone, [...(m.get(s.zone) ?? []), s]);
    return [...m.entries()];
  }, [stalls.data]);
  const counts = useMemo(() => {
    const c = { available: 0, reserved: 0, occupied: 0 };
    for (const s of stalls.data ?? []) c[s.status] += 1;
    return c;
  }, [stalls.data]);
  const unpaidTotal = useMemo(
    () => (bills.data ?? []).filter((b) => b.status !== 'paid').reduce((sum, b) => sum + Number(b.amount), 0),
    [bills.data],
  );

  return (
    <>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 text-sm">
            <button type="button" onClick={() => setTab('plan')} className={`rounded-md px-4 py-1.5 ${tab === 'plan' ? 'bg-sky-600 text-white' : 'text-slate-600'}`}>ผังแผง</button>
            <button type="button" onClick={() => setTab('bills')} className={`rounded-md px-4 py-1.5 ${tab === 'bills' ? 'bg-sky-600 text-white' : 'text-slate-600'}`}>บิลค่าแผง</button>
          </div>
          <span className="ml-auto text-sm text-slate-500">
            ว่าง {counts.available} · จอง {counts.reserved} · มีผู้เช่า {counts.occupied}
          </span>
        </div>

        {tab === 'plan' && (
          <div className="space-y-5">
            {editing && (
              <StallEditor
                key={editing.id}
                stall={editing}
                saving={saveStall.isPending}
                onClose={() => setEditing(null)}
                onSave={(body) => saveStall.mutate({ id: editing.id, body })}
              />
            )}
            {byZone.map(([zone, list]) => (
              <section key={zone} className="rounded-xl border border-slate-200 bg-white p-4">
                <h2 className="mb-3 font-semibold text-slate-800">แถว {zone}</h2>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 lg:grid-cols-10">
                  {list.map((s) => (
                    <div key={s.id} title={s.tenantName ?? ''} onClick={canEditStall ? () => setEditing(s) : undefined}
                      className={`rounded-lg border p-2 text-center text-xs ${STALL_TONE[s.status]} ${canEditStall ? 'cursor-pointer hover:ring-2 hover:ring-sky-300' : ''}`}>
                      <div className="font-bold">{s.stallCode}</div>
                      <div>{STALL_LABEL[s.status]}</div>
                      <div className="truncate text-[11px] opacity-80">{s.tenantName ?? '—'}</div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {tab === 'bills' && (
          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">
                <option value="">ทุกสถานะ</option>
                {Object.entries(BILL_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <span className="ml-auto text-sm text-slate-500">ยอดยังไม่ชำระในรายการนี้ {money(unpaidTotal)} บาท</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-2">แผง</th><th className="px-4 py-2">ผู้เช่า</th><th className="px-4 py-2">รายการ</th>
                    <th className="px-4 py-2">งวด</th><th className="px-4 py-2 text-right">ยอด (บาท)</th><th className="px-4 py-2">สถานะ</th><th className="px-4 py-2">รับชำระ</th>
                  </tr>
                </thead>
                <tbody>
                  {(bills.data ?? []).map((b) => (
                    <tr key={b.id} className="border-t border-slate-100">
                      <td className="px-4 py-2 font-medium">{b.stallCode}</td>
                      <td className="px-4 py-2">{b.payerName}</td>
                      <td className="px-4 py-2">{KIND_LABEL[b.kind]}</td>
                      <td className="px-4 py-2">{periodLabel(b.period)}</td>
                      <td className="px-4 py-2 text-right">{money(b.amount)}</td>
                      <td className="px-4 py-2">
                        {BILL_STATUS[b.status] ?? b.status}
                        {b.status === 'paid' && b.paidMethod && <span className="block text-xs text-slate-500">{PAY_METHOD[b.paidMethod]} · {b.receiptNo}</span>}
                      </td>
                      <td className="px-4 py-2">
                        {b.status !== 'paid' && canManage && (
                          <div className="flex items-center gap-2">
                            <select value={method[b.id] ?? 'cash'} onChange={(e) => setMethod({ ...method, [b.id]: e.target.value })} className="rounded-md border border-slate-300 px-2 py-1 text-xs">
                              {Object.entries(PAY_METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                            <button type="button" disabled={pay.isPending} onClick={() => pay.mutate({ id: b.id, m: method[b.id] ?? 'cash' })}
                              className="rounded-md bg-sky-600 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50">รับชำระ</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(bills.data ?? []).length === 0 && !bills.isLoading && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">ไม่มีบิลในรายการนี้</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </>
  );
}

/** แก้ไขแผง: สถานะ ชื่อผู้จอง/ผู้เช่า ค่าเช่า — ตั้งว่างแล้วชื่อจะถูกล้าง */
function StallEditor({ stall, saving, onClose, onSave }: {
  stall: Stall; saving: boolean; onClose: () => void;
  onSave: (body: { status: Stall['status']; tenantName: string | null; monthlyRate: number }) => void;
}) {
  const [status, setStatus] = useState<Stall['status']>(stall.status);
  const [tenant, setTenant] = useState(stall.tenantName ?? '');
  const [rate, setRate] = useState(String(Number(stall.monthlyRate)));
  return (
    <section className="rounded-xl border border-sky-300 bg-white p-4">
      <h2 className="mb-3 font-semibold text-slate-800">จัดการแผง {stall.stallCode}</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">สถานะ
          <select value={status} onChange={(e) => setStatus(e.target.value as Stall['status'])} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2">
            {Object.entries(STALL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="text-sm">ชื่อผู้จอง / ผู้เช่า
          <input value={tenant} onChange={(e) => setTenant(e.target.value)} disabled={status === 'available'}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100" />
        </label>
        <label className="text-sm">ค่าเช่าต่อเดือน (บาท)
          <input type="number" min={0} value={rate} onChange={(e) => setRate(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2 text-sm">ปิด</button>
        <button type="button" disabled={saving}
          onClick={() => onSave({ status, tenantName: status === 'available' ? null : tenant.trim() || null, monthlyRate: Number(rate) || 0 })}
          className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50">บันทึก</button>
      </div>
    </section>
  );
}
