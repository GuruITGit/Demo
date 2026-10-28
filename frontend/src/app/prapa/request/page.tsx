'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/water-api';
import { toast } from '@/hooks/use-toast';
import { FileSignature, Printer, FileText, Save } from 'lucide-react';
import { PageHeader, Card, Field, inputCls, btn, SearchInput, EmptyState } from '../ui';
import { useCanManage } from '../use-can-manage';

type Customer = { id: string; customerCode: string; fullName: string; villageNo: number | null; nationalId?: string; address?: string; meterSerial?: string; meterSizeCode?: string };
type AppForm = {
  age?: number | null; idExpiry?: string; occupation?: string; workplace?: string; purpose?: string;
  operateAt?: string; nearby?: string; pipeSize?: string; faucetSize?: string; faucetCount?: number | null;
  depositAmount?: number | null; receiver?: string; applyDate?: string; done?: boolean;
  contractSigner?: string; witness1?: string; witness2?: string;
};

const PURPOSES = ['ขอใช้น้ำประปา (รายใหม่)', 'ขอย้ายมาตรวัดน้ำ', 'ขอเปลี่ยนขนาดมาตรวัดน้ำ', 'ขอยกเลิกการใช้น้ำ', 'ขอต่อกลับการใช้น้ำ'];

export default function PrapaRequestPage() {
  const canManage = useCanManage();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Customer | null>(null);
  const [form, setForm] = useState<AppForm>({});

  const { data: results } = useQuery({
    queryKey: ['req-search', search],
    queryFn: async () => (await api.get('/water/customers', { params: { search, limit: 8 } })).data.data as Customer[],
    enabled: search.trim().length >= 2,
  });

  // โหลดคำขอเดิมเมื่อเลือกผู้ใช้น้ำ
  const { data: existing } = useQuery({
    queryKey: ['req-app', selected?.id],
    queryFn: async () => (await api.get(`/water/customers/${selected!.id}/application`)).data.data as AppForm | null,
    enabled: !!selected,
  });
  useEffect(() => {
    if (selected) setForm(existing || { applyDate: new Date().toISOString().slice(0, 10) });
  }, [existing, selected]);

  const save = useMutation({
    mutationFn: () => api.put(`/water/customers/${selected!.id}/application`, {
      ...form,
      age: form.age ?? undefined, faucetCount: form.faucetCount ?? undefined, depositAmount: form.depositAmount ?? undefined,
      idExpiry: form.idExpiry || undefined, applyDate: form.applyDate || undefined,
    }),
    onSuccess: () => toast.success('บันทึกแบบคำขอแล้ว'),
    onError: (e) => toast.error(getErrorMessage(e, 'บันทึกไม่สำเร็จ')),
  });

  const openPdf = async (kind: 'application' | 'contract') => {
    try {
      const res = await api.get(`/water/customers/${selected!.id}/application/pdf`, { params: { kind }, responseType: 'blob' });
      const u = URL.createObjectURL(res.data as Blob);
      window.open(u, '_blank');
      setTimeout(() => URL.revokeObjectURL(u), 60000);
    } catch (e) { toast.error(getErrorMessage(e, 'เปิดเอกสารไม่สำเร็จ')); }
  };

  const set = (p: Partial<AppForm>) => setForm({ ...form, ...p });
  const num = (v: string) => (v ? Number(v) : null);

  return (
    <div className="space-y-4">
      <PageHeader icon={FileSignature} iconClass="text-emerald-500" title="แบบคำขอใช้น้ำ / สัญญา" desc="เลือกผู้ใช้น้ำ กรอกคำขอ แล้วพิมพ์แบบคำขอหรือสัญญา" />

      {/* ค้นหา + เลือกผู้ใช้น้ำ */}
      <Card className="p-3 sm:p-4">
        <SearchInput value={search} onChange={setSearch} placeholder="ค้นหาผู้ใช้น้ำ (ชื่อ / รหัส / เลขบัตร)..." />
        {search.trim().length >= 2 && (
          <div className="mt-2 max-h-[50vh] divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-100">
            {(results || []).length === 0 ? <p className="p-3 text-center text-sm text-slate-400">ไม่พบผู้ใช้น้ำ</p>
              : results!.map((c) => (
                <button key={c.id} onClick={() => { setSelected(c); setSearch(''); }}
                  className="flex w-full items-center gap-3 px-3 py-3 text-left text-sm hover:bg-sky-50/50 active:bg-sky-50">
                  <span className="shrink-0 font-mono text-sky-600">{c.customerCode}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-800">{c.fullName}</span>
                  <span className="shrink-0 text-xs text-slate-400">{c.villageNo ? `หมู่ ${c.villageNo}` : ''}</span>
                </button>
              ))}
          </div>
        )}
      </Card>

      {!selected ? (
        <EmptyState icon={FileSignature} title="ค้นหาและเลือกผู้ใช้น้ำ" desc="เพื่อกรอกแบบคำขอ / พิมพ์สัญญา" />
      ) : (
        <Card className="space-y-4">
          {/* หัว: ผู้ใช้น้ำที่เลือก + ปุ่มพิมพ์ */}
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-semibold text-slate-900"><span className="font-mono font-normal text-sky-600">{selected.customerCode}</span> {selected.fullName}</p>
              <p className="text-sm text-slate-400">{selected.villageNo ? `หมู่ ${selected.villageNo} · ` : ''}เลขบัตร {selected.nationalId || '—'}</p>
            </div>
            <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex">
              <button onClick={() => openPdf('application')} className={btn('secondary')}><FileText className="h-4 w-4" /> พิมพ์แบบคำขอ</button>
              <button onClick={() => openPdf('contract')} className={btn('secondary')}><Printer className="h-4 w-4" /> พิมพ์สัญญา</button>
            </div>
          </div>

          {/* ฟอร์มคำขอ */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="อายุ (ปี)"><input type="number" inputMode="numeric" value={form.age ?? ''} onChange={(e) => set({ age: num(e.target.value) })} className={inputCls} /></Field>
            <Field label="วันหมดอายุบัตร"><input type="date" value={form.idExpiry || ''} onChange={(e) => set({ idExpiry: e.target.value })} className={inputCls} /></Field>
            <Field label="อาชีพ" className="col-span-2 sm:col-span-1"><input value={form.occupation || ''} onChange={(e) => set({ occupation: e.target.value })} className={inputCls} /></Field>
          </div>
          <Field label="สถานที่ทำงาน"><input value={form.workplace || ''} onChange={(e) => set({ workplace: e.target.value })} className={inputCls} /></Field>
          <Field label="ความประสงค์">
            <select value={form.purpose || ''} onChange={(e) => set({ purpose: e.target.value })} className={inputCls}>
              <option value="">— เลือก —</option>
              {PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="ดำเนินการที่ (สถานที่ติดตั้ง)"><input value={form.operateAt || ''} onChange={(e) => set({ operateAt: e.target.value })} className={inputCls} /></Field>
            <Field label="สถานที่ใกล้เคียง"><input value={form.nearby || ''} onChange={(e) => set({ nearby: e.target.value })} className={inputCls} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="ขนาดท่อภายใน (นิ้ว)"><input value={form.pipeSize || ''} onChange={(e) => set({ pipeSize: e.target.value })} className={inputCls} /></Field>
            <Field label="ก๊อกน้ำขนาด (นิ้ว)"><input value={form.faucetSize || ''} onChange={(e) => set({ faucetSize: e.target.value })} className={inputCls} /></Field>
            <Field label="จำนวน (ตัว)"><input type="number" inputMode="numeric" value={form.faucetCount ?? ''} onChange={(e) => set({ faucetCount: num(e.target.value) })} className={inputCls} /></Field>
            <Field label="เงินประกันมาตร (บาท)"><input type="number" inputMode="decimal" value={form.depositAmount ?? ''} onChange={(e) => set({ depositAmount: num(e.target.value) })} className={inputCls} /></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="ผู้รับคำขอ"><input value={form.receiver || ''} onChange={(e) => set({ receiver: e.target.value })} className={inputCls} /></Field>
            <Field label="ลงวันที่"><input type="date" value={form.applyDate || ''} onChange={(e) => set({ applyDate: e.target.value })} className={inputCls} /></Field>
          </div>
          <div className="border-t border-slate-100 pt-3">
            <p className="mb-2 text-xs font-semibold text-slate-500">สัญญา</p>
            <Field label="ผู้รับสัญญา (ชื่อและตำแหน่ง)"><input value={form.contractSigner || ''} onChange={(e) => set({ contractSigner: e.target.value })} className={inputCls} /></Field>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="พยาน 1"><input value={form.witness1 || ''} onChange={(e) => set({ witness1: e.target.value })} className={inputCls} /></Field>
              <Field label="พยาน 2"><input value={form.witness2 || ''} onChange={(e) => set({ witness2: e.target.value })} className={inputCls} /></Field>
            </div>
          </div>
          <label className="flex items-center gap-2.5 py-1 text-sm text-slate-600">
            <input type="checkbox" checked={!!form.done} onChange={(e) => set({ done: e.target.checked })} className="h-5 w-5 rounded accent-sky-600" /> เสร็จ / จบงานแล้ว
          </label>

          {canManage && (
            <div className="flex justify-end border-t border-slate-100 pt-3">
              <button onClick={() => save.mutate()} disabled={save.isPending} className={`${btn('primary')} w-full sm:w-auto`}>
                <Save className="h-4 w-4" /> บันทึกแบบคำขอ
              </button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
