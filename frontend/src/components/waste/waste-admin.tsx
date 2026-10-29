'use client';
import { useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/auth.store';
import { BILL_STATUS, PAY_METHOD, periodLabel, money } from '@/lib/payment-labels';

type WasteBill = {
  id: string; householdRef: string; holderName: string; houseNo: string; moo: string; phone: string | null;
  period: string; amount: string; status: string; paidMethod: string | null; receiptNo: string | null;
};

export function WasteAdmin() {
  const canManage = useAuthStore((s) => s.hasPermission('waste:manage:WasteBill'));
  const qc = useQueryClient();
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [method, setMethod] = useState<Record<string, string>>({});

  // ค้นหาเมื่อกดปุ่ม/Enter — ไม่ยิง API ทุกตัวอักษร
  const { data, isFetching } = useQuery<WasteBill[]>({
    queryKey: ['waste-search', query],
    enabled: query.length > 0,
    queryFn: async () => (await api.get('/waste/bills', { params: { q: query } })).data.data,
  });

  const pay = useMutation({
    mutationFn: ({ id, m }: { id: string; m: string }) => api.post(`/waste/bills/${id}/pay`, { method: m }),
    onSuccess: () => {
      toast('บันทึกการรับชำระแล้ว');
      qc.invalidateQueries({ queryKey: ['waste-search'] });
    },
    onError: (e) => toast(getErrorMessage(e), { variant: 'error' }),
  });

  const search = (e: FormEvent) => { e.preventDefault(); setQuery(input.trim()); };

  return (
    <>
      <div className="space-y-5">
        <form onSubmit={search} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-4">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="บ้านเลขที่และหมู่ เช่น 18 หมู่ 2 · ชื่อ · หรือเบอร์โทร"
            className="min-w-[260px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <button type="submit" disabled={!input.trim()} className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50">ค้นหา</button>
        </form>

        <section className="rounded-xl border border-slate-200 bg-white">
          {query === '' && <p className="p-8 text-center text-slate-500">ค้นหาครัวเรือนเพื่อดูบิลค่าเก็บขยะที่ค้าง</p>}
          {query !== '' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-2">รหัส</th><th className="px-4 py-2">ผู้รับบิล</th><th className="px-4 py-2">บ้านเลขที่</th>
                    <th className="px-4 py-2">งวด</th><th className="px-4 py-2 text-right">ยอด (บาท)</th><th className="px-4 py-2">สถานะ</th><th className="px-4 py-2">รับชำระ</th>
                  </tr>
                </thead>
                <tbody>
                  {(data ?? []).map((b) => (
                    <tr key={b.id} className="border-t border-slate-100">
                      <td className="px-4 py-2 font-medium">{b.householdRef}</td>
                      <td className="px-4 py-2">{b.holderName}</td>
                      <td className="px-4 py-2">{b.houseNo} หมู่ {Number(b.moo)}</td>
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
                  {(data ?? []).length === 0 && !isFetching && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">ไม่พบบิลค้างจากคำค้นนี้</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
