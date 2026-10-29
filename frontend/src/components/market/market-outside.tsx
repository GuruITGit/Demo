'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { money } from '@/lib/payment-labels';
import { Empty, Field, Panel, inputCls } from '@/components/pay/pay-ui';
import { printReceipt } from '@/components/pay/receipt-print';

type Location = { id: string; name: string; rentRate: string; rentPeriod: 'daily' | 'monthly'; enabled: boolean };
type Collection = { id: string; locationId: string; vendorName: string; collectedOn: string; amount: string; receiptNo: string | null };

const PERIOD_LABEL = { daily: 'ต่อวัน', monthly: 'ต่อเดือน' } as const;
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const thDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });

/** แผงลอย: เปิด/ปิดจุดเก็บค่าที่นอกผังประจำ ตั้งราคารายวัน/รายเดือน และบันทึกเก็บเงินหน้างาน */
export function MarketOutside({ canManageStall, canManageBill, orgName }: { canManageStall: boolean; canManageBill: boolean; orgName: string }) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ['market', 'outside'] });
  const { data: locs = [] } = useQuery<Location[]>({ queryKey: ['market', 'outside', 'locs'], queryFn: async () => (await api.get('/market/outside/locations')).data.data });

  const [editId, setEditId] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState({ name: '', rentRate: '', rentPeriod: 'daily' as Location['rentPeriod'] });
  const [delLoc, setDelLoc] = useState<Location | null>(null);

  const [selLoc, setSelLoc] = useState('');
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); });
  const [to, setTo] = useState(todayIso);
  const [vendor, setVendor] = useState('');
  const [collectOn, setCollectOn] = useState(todayIso);
  const [amount, setAmount] = useState('');
  const [delCol, setDelCol] = useState<Collection | null>(null);

  const { data: cols } = useQuery<{ total: number; rows: Collection[] }>({
    queryKey: ['market', 'outside', 'cols', selLoc, from, to],
    queryFn: async () => (await api.get('/market/outside/collections', { params: { locationId: selLoc || undefined, from, to } })).data.data,
  });

  const saveLoc = useMutation({
    mutationFn: () => {
      const body = { name: form.name.trim(), rentRate: Number(form.rentRate) || 0, rentPeriod: form.rentPeriod };
      return editId === 'new' ? api.post('/market/outside/locations', body) : api.patch(`/market/outside/locations/${editId}`, body);
    },
    onSuccess: () => { toast.success('บันทึกจุดแผงลอยแล้ว'); setEditId(null); refresh(); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const toggle = useMutation({
    mutationFn: (l: Location) => api.patch(`/market/outside/locations/${l.id}`, { enabled: !l.enabled }),
    onSuccess: (_r, l) => { toast.success(l.enabled ? `ปิดจุด ${l.name} แล้ว` : `เปิดจุด ${l.name} แล้ว`); refresh(); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const delLocation = useMutation({
    mutationFn: (id: string) => api.delete(`/market/outside/locations/${id}`),
    onSuccess: () => { toast.success('ลบจุดแล้ว (ประวัติการเก็บเงินยังอยู่)'); setDelLoc(null); refresh(); },
    onError: (e) => { toast.error(getErrorMessage(e)); setDelLoc(null); },
  });
  const collect = useMutation({
    mutationFn: () => api.post('/market/outside/collections', { locationId: selLoc, vendorName: vendor.trim(), collectedOn: collectOn, ...(amount ? { amount: Number(amount) } : {}) }),
    onSuccess: (r) => {
      const c = r.data.data as Collection;
      toast.success(`บันทึกการเก็บเงินแล้ว · ${c.receiptNo}`);
      setVendor(''); setAmount(''); refresh();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const delCollection = useMutation({
    mutationFn: (id: string) => api.delete(`/market/outside/collections/${id}`),
    onSuccess: () => { toast.success('ลบรายการแล้ว'); setDelCol(null); refresh(); },
    onError: (e) => { toast.error(getErrorMessage(e)); setDelCol(null); },
  });

  const locName = (id: string) => locs.find((l) => l.id === id)?.name ?? '—';
  const startEdit = (l: Location | 'new') => {
    setEditId(l === 'new' ? 'new' : l.id);
    setForm(l === 'new' ? { name: '', rentRate: '', rentPeriod: 'daily' } : { name: l.name, rentRate: String(Number(l.rentRate)), rentPeriod: l.rentPeriod });
  };
  const selected = locs.find((l) => l.id === selLoc);

  return (
    <div className="space-y-5">
      <Panel title="จุดแผงลอย" actions={canManageStall && <Button size="sm" onClick={() => startEdit('new')}>+ เปิดจุดใหม่</Button>}>
        {editId && canManageStall && (
          <div className="grid gap-3 border-b border-gray-100 p-4 sm:grid-cols-4">
            <Field label="ชื่อจุด" className="sm:col-span-2"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="เช่น หน้าตลาด / ลานจอดรถ" /></Field>
            <Field label="ค่าเช่า (บาท)"><input type="number" min={0} className={inputCls} value={form.rentRate} onChange={(e) => setForm({ ...form, rentRate: e.target.value })} /></Field>
            <Field label="คิดค่าเช่า">
              <select className={inputCls} value={form.rentPeriod} onChange={(e) => setForm({ ...form, rentPeriod: e.target.value as Location['rentPeriod'] })}>
                <option value="daily">รายวัน</option><option value="monthly">รายเดือน</option>
              </select>
            </Field>
            <div className="flex gap-2 sm:col-span-4">
              <Button loading={saveLoc.isPending} disabled={!form.name.trim()} onClick={() => saveLoc.mutate()}>บันทึก</Button>
              <Button variant="outline" onClick={() => setEditId(null)}>ยกเลิก</Button>
            </div>
          </div>
        )}
        {locs.length ? (
          <ul>
            {locs.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-3 border-t border-gray-100 px-4 py-3 first:border-t-0">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900">{l.name}</p>
                  <p className="text-sm text-gray-500">{money(l.rentRate)} บาท {PERIOD_LABEL[l.rentPeriod]}</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${l.enabled ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{l.enabled ? 'เปิดอยู่' : 'ปิดอยู่'}</span>
                {canManageStall && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" loading={toggle.isPending && toggle.variables?.id === l.id} onClick={() => toggle.mutate(l)}>{l.enabled ? 'ปิดจุด' : 'เปิดจุด'}</Button>
                    <Button size="sm" variant="outline" onClick={() => startEdit(l)}>แก้ไข</Button>
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setDelLoc(l)}>ลบ</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : <Empty>ยังไม่มีจุดแผงลอย{canManageStall ? ' — กด “เปิดจุดใหม่” เพื่อเริ่ม' : ''}</Empty>}
      </Panel>

      <Panel title="เก็บเงินแผงลอย">
        {canManageBill && (
          <div className="grid gap-3 border-b border-gray-100 p-4 sm:grid-cols-5">
            <Field label="จุด">
              <select className={inputCls} value={selLoc} onChange={(e) => { setSelLoc(e.target.value); setAmount(''); }}>
                <option value="">— เลือกจุด —</option>
                {locs.filter((l) => l.enabled).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </Field>
            <Field label="ชื่อผู้ค้า" className="sm:col-span-2"><input className={inputCls} value={vendor} onChange={(e) => setVendor(e.target.value)} /></Field>
            <Field label="วันที่เก็บ"><input type="date" className={inputCls} value={collectOn} max={todayIso()} onChange={(e) => setCollectOn(e.target.value)} /></Field>
            <Field label="ยอด (บาท)" hint={selected ? `ว่าง = ${money(selected.rentRate)}` : undefined}>
              <input type="number" min={0} className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <div className="sm:col-span-5"><Button loading={collect.isPending} disabled={!selLoc || !vendor.trim()} onClick={() => collect.mutate()}>บันทึกการเก็บเงิน</Button></div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 p-4">
          <select className={`${inputCls} w-auto`} value={selLoc} onChange={(e) => setSelLoc(e.target.value)}>
            <option value="">ทุกจุด</option>
            {locs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-600">ตั้งแต่ <input type="date" className={`${inputCls} w-auto`} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="flex items-center gap-2 text-sm text-gray-600">ถึง <input type="date" className={`${inputCls} w-auto`} value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <span className="ml-auto text-sm text-gray-500">รวม <b className="text-gray-800">{money(cols?.total ?? 0)}</b> บาท · {cols?.rows.length ?? 0} รายการ</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr><th className="px-4 py-2">วันที่</th><th className="px-4 py-2">จุด</th><th className="px-4 py-2">ผู้ค้า</th><th className="px-4 py-2 text-right">ยอด (บาท)</th><th className="px-4 py-2">ใบเสร็จ</th><th className="px-4 py-2" /></tr>
            </thead>
            <tbody>
              {(cols?.rows ?? []).map((c) => (
                <tr key={c.id} className="border-t border-gray-100">
                  <td className="px-4 py-2">{thDate(c.collectedOn)}</td>
                  <td className="px-4 py-2">{locName(c.locationId)}</td>
                  <td className="px-4 py-2">{c.vendorName}</td>
                  <td className="px-4 py-2 text-right">{money(c.amount)}</td>
                  <td className="px-4 py-2 text-gray-500">{c.receiptNo}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => {
                        if (!printReceipt({ orgName, receiptNo: c.receiptNo, payer: c.vendorName, place: `แผงลอย ${locName(c.locationId)}`, lines: [{ label: `ค่าที่แผงลอย ${thDate(c.collectedOn)}`, amount: c.amount }], method: 'cash', paidAt: `${c.collectedOn}T12:00:00` }))
                          toast.error('เปิดหน้าพิมพ์ไม่ได้ — อนุญาตป็อปอัปของเว็บนี้แล้วลองใหม่');
                      }}>พิมพ์ใบเสร็จ</Button>
                      {canManageBill && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setDelCol(c)}>ลบ</Button>}
                    </div>
                  </td>
                </tr>
              ))}
              {!cols?.rows.length && <tr><td colSpan={6}><Empty>ไม่มีรายการเก็บเงินในช่วงนี้</Empty></td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>

      <ConfirmDialog open={!!delLoc} onOpenChange={(o) => { if (!o) setDelLoc(null); }} loading={delLocation.isPending}
        onConfirm={() => delLoc && delLocation.mutate(delLoc.id)} title={`ลบจุด “${delLoc?.name}”?`}
        description="จุดจะถูกเอาออกจากรายการ ประวัติการเก็บเงินที่ผ่านมายังอยู่ในรายงาน" confirmText="ลบจุด" />
      <ConfirmDialog open={!!delCol} onOpenChange={(o) => { if (!o) setDelCol(null); }} loading={delCollection.isPending}
        onConfirm={() => delCol && delCollection.mutate(delCol.id)} title="ลบรายการเก็บเงินนี้?"
        description={`${delCol?.vendorName ?? ''} · ${delCol ? money(delCol.amount) : ''} บาท — ใช้เมื่อบันทึกผิด ใบเสร็จเลขนี้จะไม่มีรายการรองรับ`} confirmText="ลบรายการ" />
    </div>
  );
}
