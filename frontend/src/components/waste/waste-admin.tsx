'use client';
import { useRef, useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { BILL_STATUS, PAY_METHOD, periodLabel, money } from '@/lib/payment-labels';
import { Empty, Field, Metric, Panel, PayTabs, inputCls, recentPeriods, useOrgName } from '@/components/pay/pay-ui';
import { QrSvg, downloadQrPng, printQrSheet, houseQrUrl, type QrItem } from '@/components/pay/qr';
import { SlipQueue } from '@/components/pay/slip-queue';
import { PaySettings } from '@/components/pay/pay-settings';
import { printReceipt } from '@/components/pay/receipt-print';

type Household = {
  id: string; householdRef: string; holderName: string; houseNo: string; moo: string; phone: string | null; monthlyFee: string | null;
  owedMonths: number; owedTotal: number;
};
type WasteBill = {
  id: string; householdRef: string; holderName: string; houseNo: string; moo: string; phone: string | null; period: string; amount: string; status: string;
  paidMethod: string | null; paidAt: string | null; receiptNo: string | null; submittedMethod: string | null; reviewNote: string | null;
};
type Summary = {
  householdCount: number; unpaidCount: number; unpaidTotal: number;
  byStatus: { status: string; count: number; total: number }[];
};
type Arrear = { householdRef: string; holderName: string; houseNo: string; moo: string; phone: string | null; months: number; total: number };
type Tab = 'overview' | 'queue' | 'households' | 'bills' | 'dues' | 'qr' | 'settings';

const STATUS_TONE: Record<string, string> = {
  unpaid: 'bg-red-50 text-red-700', pending: 'bg-amber-50 text-amber-700', paid: 'bg-green-50 text-green-700', mismatch: 'bg-orange-50 text-orange-700',
};

/** ค่าเก็บขยะบ้าน (เจ้าหน้าที่) — ภาพรวม · คิวรอตรวจ · ครัวเรือน · บิล · ค้างชำระ · QR ประจำบ้าน · ตั้งค่า */
export function WasteAdmin() {
  const has = useAuthStore((s) => s.hasPermission);
  const canManage = has('waste:manage:WasteBill');
  const orgName = useOrgName();
  const [tab, setTab] = useState<Tab>('overview');
  const [billSeed, setBillSeed] = useState<{ q: string; status: string; n: number }>({ q: '', status: '', n: 0 });
  const { data: sum } = useQuery<Summary>({ queryKey: ['waste', 'summary'], queryFn: async () => (await api.get('/waste/summary')).data.data, refetchInterval: 60_000 });
  const pending = sum?.byStatus.find((s) => s.status === 'pending')?.count ?? 0;
  const goBills = (q: string, status = '') => { setBillSeed({ q, status, n: billSeed.n + 1 }); setTab('bills'); };

  return (
    <div className="space-y-5">
      <PayTabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'overview', label: 'ภาพรวม' },
          { key: 'queue', label: 'รอตรวจ', badge: pending },
          { key: 'households', label: 'ครัวเรือน' },
          { key: 'bills', label: 'บิล' },
          { key: 'dues', label: 'ค้างชำระ' },
          { key: 'qr', label: 'QR ประจำบ้าน' },
          { key: 'settings', label: 'ตั้งค่า' },
        ]}
      />
      {tab === 'overview' && <Overview sum={sum} onGo={setTab} />}
      {tab === 'queue' && <SlipQueue kind="waste" canManage={canManage} />}
      {tab === 'households' && <Households canManage={canManage} onBills={(ref) => goBills(ref)} />}
      {tab === 'bills' && <Bills key={billSeed.n} canManage={canManage} orgName={orgName} seedQ={billSeed.q} seedStatus={billSeed.status} />}
      {tab === 'dues' && <Dues onBills={(ref) => goBills(ref, 'unpaid')} />}
      {tab === 'qr' && <HouseQr orgName={orgName} />}
      {tab === 'settings' && <PaySettings kind="waste" canManage={canManage} />}
    </div>
  );
}

function Overview({ sum, onGo }: { sum?: Summary; onGo: (t: Tab) => void }) {
  const by = (s: string) => sum?.byStatus.find((x) => x.status === s);
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="ยอดค้างทั้งหมด" value={`${money(sum?.unpaidTotal ?? 0)} บาท`} sub={`${sum?.unpaidCount ?? 0} บิล`} tone={sum?.unpaidTotal ? 'bad' : 'ok'} />
        <Metric label="รอตรวจ/รับเงินสด" value={`${by('pending')?.count ?? 0} รายการ`} sub={`${money(by('pending')?.total ?? 0)} บาท`} tone="warn" />
        <Metric label="ชำระแล้ว (ทุกงวด)" value={`${money(by('paid')?.total ?? 0)} บาท`} sub={`${by('paid')?.count ?? 0} บิล`} tone="ok" />
        <Metric label="ครัวเรือนในทะเบียน" value={`${sum?.householdCount ?? 0} หลัง`} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => onGo('queue')}>ไปตรวจรายการรอดำเนินการ ›</Button>
        <Button variant="outline" onClick={() => onGo('bills')}>ออกบิลประจำงวด ›</Button>
        <Button variant="outline" onClick={() => onGo('dues')}>ดูผู้ค้างชำระ ›</Button>
      </div>
    </div>
  );
}

// ───────────────────────────── ทะเบียนครัวเรือน
const EMPTY_FORM = { holderName: '', houseNo: '', moo: '', phone: '', monthlyFee: '' };

/** อ่าน CSV ง่าย ๆ: คอลัมน์ ชื่อ,บ้านเลขที่,หมู่,เบอร์โทร,ค่าธรรมเนียม (บรรทัดแรกเป็นหัวตารางได้) — รองรับเครื่องหมายคำพูดและ BOM */
function parseCsv(text: string): { holderName: string; houseNo: string; moo: string; phone?: string; monthlyFee?: number }[] {
  const rows: string[][] = [];
  for (const line of text.replace(/^﻿/, '').split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells: string[] = [];
    let cur = '', q = false;
    for (const ch of line) {
      if (ch === '"') q = !q;
      else if ((ch === ',' || ch === '\t') && !q) { cells.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    cells.push(cur.trim());
    rows.push(cells);
  }
  const body = rows.length && /ชื่อ|name/i.test(rows[0][0] ?? '') ? rows.slice(1) : rows;
  return body.map((c) => ({
    holderName: c[0] ?? '', houseNo: c[1] ?? '', moo: (c[2] ?? '').replace(/\D/g, ''),
    ...(c[3] ? { phone: c[3].replace(/[\s-]/g, '') } : {}),
    ...(c[4] && Number.isFinite(Number(c[4])) ? { monthlyFee: Number(c[4]) } : {}),
  }));
}

function Households({ canManage, onBills }: { canManage: boolean; onBills: (ref: string) => void }) {
  const qc = useQueryClient();
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | 'new' | null>(null);
  const [del, setDel] = useState<Household | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['waste'] });

  const { data = [], isLoading } = useQuery<Household[]>({
    queryKey: ['waste', 'households', q],
    queryFn: async () => (await api.get('/waste/households', { params: q ? { q } : {} })).data.data,
  });

  const save = useMutation({
    mutationFn: () => {
      const body = {
        holderName: form.holderName.trim(), houseNo: form.houseNo.trim(), moo: form.moo.trim(),
        phone: form.phone.replace(/[\s-]/g, ''), monthlyFee: form.monthlyFee === '' ? null : Number(form.monthlyFee),
      };
      return editId === 'new' ? api.post('/waste/households', body) : api.patch(`/waste/households/${editId}`, body);
    },
    onSuccess: () => { toast.success('บันทึกครัวเรือนแล้ว'); setEditId(null); refresh(); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/waste/households/${id}`),
    onSuccess: () => { toast.success('ลบครัวเรือนแล้ว'); setDel(null); refresh(); },
    onError: (e) => { toast.error(getErrorMessage(e)); setDel(null); },
  });
  const importRows = useMutation({
    mutationFn: (rows: ReturnType<typeof parseCsv>) => api.post('/waste/households/import', { rows }),
    onSuccess: (r) => {
      const d = r.data.data as { created: number; updated: number; errors: { row: number; message: string }[] };
      toast.success(`นำเข้าแล้ว: เพิ่มใหม่ ${d.created} · อัปเดต ${d.updated}${d.errors.length ? ` · ข้าม ${d.errors.length} แถว (แถว ${d.errors.slice(0, 5).map((e) => e.row).join(', ')})` : ''}`);
      refresh();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const rows = parseCsv(await f.text());
    if (!rows.length) return toast.error('ไม่พบข้อมูลในไฟล์');
    if (rows.length > 2000) return toast.error('นำเข้าได้ครั้งละไม่เกิน 2,000 แถว');
    importRows.mutate(rows);
    if (fileRef.current) fileRef.current.value = '';
  };
  const startEdit = (h: Household | 'new') => {
    setEditId(h === 'new' ? 'new' : h.id);
    setForm(h === 'new' ? EMPTY_FORM : { holderName: h.holderName, houseNo: h.houseNo, moo: h.moo, phone: h.phone ?? '', monthlyFee: h.monthlyFee != null ? String(Number(h.monthlyFee)) : '' });
  };
  const downloadTemplate = () => {
    const blob = new Blob(['﻿ชื่อ-นามสกุล,บ้านเลขที่,หมู่,เบอร์โทร,ค่าธรรมเนียมต่อเดือน (ไม่บังคับ)\nสมชาย ใจดี,18,2,0810000000,\n'], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'แบบฟอร์มนำเข้าครัวเรือน.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  };
  const search = (e: FormEvent) => { e.preventDefault(); setQ(input.trim()); };
  const needOk = form.holderName.trim() && form.houseNo.trim() && form.moo.trim();

  return (
    <div className="space-y-5">
      <Panel
        title="ทะเบียนครัวเรือน"
        actions={canManage && (
          <>
            <Button size="sm" onClick={() => startEdit('new')}>+ เพิ่มครัวเรือน</Button>
            <Button size="sm" variant="outline" loading={importRows.isPending} onClick={() => fileRef.current?.click()}>นำเข้าจากไฟล์ CSV</Button>
            <Button size="sm" variant="ghost" onClick={downloadTemplate}>ดาวน์โหลดแบบฟอร์ม</Button>
            <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </>
        )}
      >
        {editId && canManage && (
          <div className="grid gap-3 border-b border-gray-100 p-4 sm:grid-cols-6">
            <Field label="ชื่อผู้รับบิล" className="sm:col-span-2" hint="ประชาชนต้องกรอกชื่อนี้ให้ตรงตอนจ่าย"><input className={inputCls} value={form.holderName} onChange={(e) => setForm({ ...form, holderName: e.target.value })} /></Field>
            <Field label="บ้านเลขที่"><input className={inputCls} value={form.houseNo} onChange={(e) => setForm({ ...form, houseNo: e.target.value })} placeholder="18 หรือ 12/3" /></Field>
            <Field label="หมู่ที่"><input className={inputCls} inputMode="numeric" value={form.moo} onChange={(e) => setForm({ ...form, moo: e.target.value.replace(/\D/g, '') })} /></Field>
            <Field label="เบอร์โทร"><input className={inputCls} inputMode="numeric" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="ค่าขยะ/เดือน" hint="ว่าง = ราคากลาง"><input type="number" min={0} className={inputCls} value={form.monthlyFee} onChange={(e) => setForm({ ...form, monthlyFee: e.target.value })} /></Field>
            <div className="flex gap-2 sm:col-span-6">
              <Button loading={save.isPending} disabled={!needOk} onClick={() => save.mutate()}>บันทึก</Button>
              <Button variant="outline" onClick={() => setEditId(null)}>ยกเลิก</Button>
            </div>
          </div>
        )}
        <form onSubmit={search} className="flex flex-wrap items-center gap-2 border-b border-gray-100 p-4">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="บ้านเลขที่และหมู่ เช่น 18 หมู่ 2 · ชื่อ · เบอร์โทร · หมู่ 3" className={`${inputCls} min-w-[260px] flex-1`} />
          <Button type="submit">ค้นหา</Button>
          {q && <Button type="button" variant="ghost" onClick={() => { setInput(''); setQ(''); }}>ล้าง</Button>}
          <span className="text-sm text-gray-500">{data.length} หลัง{data.length >= 500 ? ' (แสดง 500 แรก)' : ''}</span>
        </form>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-2">รหัส</th><th className="px-4 py-2">ผู้รับบิล</th><th className="px-4 py-2">บ้านเลขที่</th><th className="px-4 py-2">เบอร์โทร</th>
                <th className="px-4 py-2 text-right">ค่าขยะ/เดือน</th><th className="px-4 py-2 text-right">ค้างชำระ</th><th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {data.map((h) => (
                <tr key={h.id} className="border-t border-gray-100">
                  <td className="px-4 py-2 font-medium">{h.householdRef}</td>
                  <td className="px-4 py-2">{h.holderName}</td>
                  <td className="px-4 py-2">{h.houseNo} หมู่ {Number(h.moo)}</td>
                  <td className="px-4 py-2">{h.phone ?? '—'}</td>
                  <td className="px-4 py-2 text-right">{h.monthlyFee != null ? <span title="ราคาเฉพาะครัวเรือน">{money(h.monthlyFee)} *</span> : <span className="text-gray-400">ราคากลาง</span>}</td>
                  <td className="px-4 py-2 text-right">{h.owedTotal ? <span className="font-semibold text-red-600">{money(h.owedTotal)} ({h.owedMonths} เดือน)</span> : <span className="text-gray-400">—</span>}</td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => onBills(h.householdRef)}>บิล</Button>
                      {canManage && <Button size="sm" variant="outline" onClick={() => startEdit(h)}>แก้ไข</Button>}
                      {canManage && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setDel(h)}>ลบ</Button>}
                    </div>
                  </td>
                </tr>
              ))}
              {!data.length && <tr><td colSpan={7}>{isLoading ? <Empty>กำลังโหลด…</Empty> : <Empty>{q ? 'ไม่พบครัวเรือนจากคำค้นนี้' : 'ยังไม่มีครัวเรือนในทะเบียน — เพิ่มทีละหลังหรือนำเข้าจากไฟล์ CSV'}</Empty>}</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
      <ConfirmDialog open={!!del} onOpenChange={(o) => { if (!o) setDel(null); }} loading={remove.isPending}
        onConfirm={() => del && remove.mutate(del.id)} title={`ลบครัวเรือน ${del?.householdRef}?`}
        description={`${del?.holderName ?? ''} · บ้านเลขที่ ${del?.houseNo ?? ''} หมู่ ${del ? Number(del.moo) : ''} — ต้องไม่มีบิลค้าง ประวัติการชำระที่ผ่านมายังอยู่`} confirmText="ลบครัวเรือน" />
    </div>
  );
}

// ───────────────────────────── บิล
function Bills({ canManage, orgName, seedQ, seedStatus }: { canManage: boolean; orgName: string; seedQ: string; seedStatus: string }) {
  const qc = useQueryClient();
  const periods = recentPeriods(12);
  const [input, setInput] = useState(seedQ);
  const [q, setQ] = useState(seedQ);
  const [status, setStatus] = useState(seedStatus);
  const [period, setPeriod] = useState('');
  const [genPeriod, setGenPeriod] = useState(periods[0]);
  const [method, setMethod] = useState<Record<string, string>>({});
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ householdRef: '', period: periods[0], amount: '' });
  const refresh = () => qc.invalidateQueries({ queryKey: ['waste'] });

  const { data = [], isLoading } = useQuery<WasteBill[]>({
    queryKey: ['waste', 'bills', q, status, period],
    queryFn: async () => (await api.get('/waste/bills', { params: { q: q || undefined, status: status || undefined, period: period || undefined } })).data.data,
  });

  const generate = useMutation({
    mutationFn: () => api.post('/waste/bills/generate', { period: genPeriod }),
    onSuccess: (r) => {
      const d = r.data.data as { created: number; skipped: number; noFee: number };
      toast.success(d.created ? `ออกบิลงวด ${periodLabel(genPeriod)} แล้ว ${d.created} ใบ` : `งวด ${periodLabel(genPeriod)} มีบิลครบแล้ว ไม่มีบิลใหม่`);
      refresh();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const pay = useMutation({
    mutationFn: ({ id, m }: { id: string; m: string }) => api.post(`/waste/bills/${id}/pay`, { method: m }),
    onSuccess: () => { toast.success('บันทึกการรับชำระแล้ว'); refresh(); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/waste/bills/${id}`),
    onSuccess: () => { toast.success('ยกเลิกบิลแล้ว'); setCancelId(null); refresh(); },
    onError: (e) => { toast.error(getErrorMessage(e)); setCancelId(null); },
  });
  const create = useMutation({
    mutationFn: () => api.post('/waste/bills', { householdRef: draft.householdRef.trim().toUpperCase(), period: draft.period, amount: Number(draft.amount) }),
    onSuccess: () => { toast.success('เพิ่มบิลแล้ว'); setAdding(false); setDraft({ ...draft, householdRef: '', amount: '' }); refresh(); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const openTotal = data.filter((b) => b.status !== 'paid').reduce((s, b) => s + Number(b.amount), 0);
  const doPrint = (b: WasteBill) => {
    if (!printReceipt({
      orgName, receiptNo: b.receiptNo, payer: b.holderName, place: `บ้านเลขที่ ${b.houseNo} หมู่ ${Number(b.moo)}`,
      lines: [{ label: `ค่าเก็บขยะ ${periodLabel(b.period)}`, amount: b.amount }], method: b.paidMethod, paidAt: b.paidAt,
    })) toast.error('เปิดหน้าพิมพ์ไม่ได้ — อนุญาตป็อปอัปของเว็บนี้แล้วลองใหม่');
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
            <Button loading={generate.isPending} onClick={() => generate.mutate()}>ออกบิลค่าขยะบ้านทุกครัวเรือน</Button>
            <p className="basis-full text-xs text-gray-500">ออกให้ทุกครัวเรือนในทะเบียน ตามราคากลาง (หรือราคาเฉพาะครัวเรือน) · กดซ้ำได้ ไม่ออกบิลซ้ำ</p>
          </div>
          {adding && (
            <div className="grid gap-3 border-t border-gray-100 p-4 sm:grid-cols-4">
              <Field label="รหัสครัวเรือน"><input className={inputCls} value={draft.householdRef} onChange={(e) => setDraft({ ...draft, householdRef: e.target.value })} placeholder="HH-014" /></Field>
              <Field label="งวด">
                <select className={inputCls} value={draft.period} onChange={(e) => setDraft({ ...draft, period: e.target.value })}>
                  {recentPeriods(36).map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}
                </select>
              </Field>
              <Field label="ยอด (บาท)"><input type="number" min={0} className={inputCls} value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} /></Field>
              <div className="flex items-end"><Button loading={create.isPending} disabled={!draft.householdRef.trim() || !(Number(draft.amount) > 0)} onClick={() => create.mutate()}>เพิ่มบิล</Button></div>
            </div>
          )}
        </Panel>
      )}

      <Panel title="รายการบิล" actions={<span className="text-sm text-gray-500">ยอดยังไม่ชำระในรายการนี้ <b className="text-gray-800">{money(openTotal)}</b> บาท</span>}>
        <form onSubmit={(e) => { e.preventDefault(); setQ(input.trim()); }} className="flex flex-wrap items-center gap-2 border-b border-gray-100 p-4">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="บ้านเลขที่และหมู่ · ชื่อ · เบอร์ · รหัส (เว้นว่าง = ล่าสุด)" className={`${inputCls} min-w-[240px] flex-1`} />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputCls} w-auto`}>
            <option value="">ทุกสถานะ</option>
            {Object.entries(BILL_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className={`${inputCls} w-auto`}>
            <option value="">ทุกงวด</option>
            {recentPeriods(36).map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}
          </select>
          <Button type="submit">ค้นหา</Button>
        </form>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr><th className="px-4 py-2">รหัส</th><th className="px-4 py-2">ผู้รับบิล</th><th className="px-4 py-2">บ้านเลขที่</th><th className="px-4 py-2">งวด</th><th className="px-4 py-2 text-right">ยอด (บาท)</th><th className="px-4 py-2">สถานะ</th><th className="px-4 py-2">จัดการ</th></tr>
            </thead>
            <tbody>
              {data.map((b) => (
                <tr key={b.id} className="border-t border-gray-100 align-top">
                  <td className="px-4 py-2 font-medium">{b.householdRef}</td>
                  <td className="px-4 py-2">{b.holderName}</td>
                  <td className="px-4 py-2">{b.houseNo} หมู่ {Number(b.moo)}</td>
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
                        <select value={method[b.id] ?? (b.submittedMethod === 'transfer' ? 'transfer' : 'cash')} onChange={(e) => setMethod({ ...method, [b.id]: e.target.value })} className="rounded-md border border-gray-300 px-2 py-1 text-xs">
                          {Object.entries(PAY_METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                        <Button size="sm" loading={pay.isPending && pay.variables?.id === b.id} onClick={() => pay.mutate({ id: b.id, m: method[b.id] ?? (b.submittedMethod === 'transfer' ? 'transfer' : 'cash') })}>รับชำระ</Button>
                        <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setCancelId(b.id)}>ยกเลิกบิล</Button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!data.length && <tr><td colSpan={7}>{isLoading ? <Empty>กำลังโหลด…</Empty> : <Empty>ไม่พบบิลจากเงื่อนไขนี้</Empty>}</td></tr>}
            </tbody>
          </table>
        </div>
        {data.length >= 200 && <p className="border-t border-gray-100 px-4 py-2 text-xs text-amber-700">แสดง 200 รายการแรก — ค้นหาหรือกรองให้แคบลงเพื่อดูส่วนที่เหลือ</p>}
      </Panel>
      <ConfirmDialog open={!!cancelId} onOpenChange={(o) => { if (!o) setCancelId(null); }} loading={remove.isPending}
        onConfirm={() => cancelId && remove.mutate(cancelId)} title="ยกเลิกบิลนี้?"
        description="บิลจะถูกลบออกจากระบบ (ใช้กรณีออกผิด) — บิลที่ชำระแล้วลบไม่ได้" confirmText="ยกเลิกบิล" />
    </div>
  );
}

// ───────────────────────────── ค้างชำระ
function Dues({ onBills }: { onBills: (ref: string) => void }) {
  const { data = [], isLoading } = useQuery<Arrear[]>({ queryKey: ['waste', 'arrears'], queryFn: async () => (await api.get('/waste/arrears')).data.data });
  const total = data.reduce((s, r) => s + r.total, 0);
  return (
    <Panel
      title={<>ผู้ค้างชำระ <span className="text-sm font-normal text-gray-500">{data.length} หลัง · รวม {money(total)} บาท</span></>}
      actions={<Button size="sm" variant="outline" onClick={() => window.print()}>พิมพ์รายงาน</Button>}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr><th className="px-4 py-2">รหัส</th><th className="px-4 py-2">ผู้รับบิล</th><th className="px-4 py-2">บ้านเลขที่</th><th className="px-4 py-2">เบอร์โทร</th><th className="px-4 py-2 text-right">ค้าง</th><th className="px-4 py-2 text-right">ยอดค้าง (บาท)</th><th className="px-4 py-2 no-print" /></tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.householdRef} className="border-t border-gray-100">
                <td className="px-4 py-2 font-medium">{r.householdRef}</td>
                <td className="px-4 py-2">{r.holderName}</td>
                <td className="px-4 py-2">{r.houseNo} หมู่ {Number(r.moo)}</td>
                <td className="px-4 py-2">{r.phone ?? '—'}</td>
                <td className="px-4 py-2 text-right">{r.months} เดือน</td>
                <td className="px-4 py-2 text-right font-semibold">{money(r.total)}</td>
                <td className="px-4 py-2 no-print"><Button size="sm" variant="outline" onClick={() => onBills(r.householdRef)}>ดูบิล / รับชำระ</Button></td>
              </tr>
            ))}
            {!data.length && <tr><td colSpan={7}>{isLoading ? <Empty>กำลังโหลด…</Empty> : <Empty>ไม่มียอดค้างชำระ</Empty>}</td></tr>}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ───────────────────────────── QR ประจำบ้าน
function HouseQr({ orgName }: { orgName: string }) {
  const [moo, setMoo] = useState('');
  const { data = [] } = useQuery<Household[]>({ queryKey: ['waste', 'households', ''], queryFn: async () => (await api.get('/waste/households')).data.data });
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const moos = [...new Set(data.map((h) => h.moo))].sort((a, b) => Number(a) - Number(b));
  // บนสติกเกอร์ไม่ใส่ชื่อเจ้าของบ้าน (ติดหน้าบ้านต่อสาธารณะ) — ใส่แค่บ้านเลขที่/หมู่และรหัส
  const items: QrItem[] = data.filter((h) => !moo || h.moo === moo).map((h) => ({
    code: h.householdRef, title: `บ้านเลขที่ ${h.houseNo} หมู่ ${Number(h.moo)}`, sub: h.householdRef, text: houseQrUrl(origin, h.houseNo, String(Number(h.moo))),
  }));
  const target = picked.size ? items.filter((i) => picked.has(i.code)) : items;
  const toggle = (code: string) => setPicked((p) => { const n = new Set(p); if (n.has(code)) n.delete(code); else n.add(code); return n; });

  return (
    <Panel
      title="QR ประจำบ้าน"
      actions={
        <>
          <select className={`${inputCls} w-auto`} value={moo} onChange={(e) => { setMoo(e.target.value); setPicked(new Set()); }}>
            <option value="">ทุกหมู่</option>
            {moos.map((m) => <option key={m} value={m}>หมู่ {Number(m)}</option>)}
          </select>
          <Button size="sm" onClick={() => { if (!printQrSheet(target, 'ค่าเก็บขยะบ้าน', orgName)) toast.error('เปิดหน้าพิมพ์ไม่ได้ — อนุญาตป็อปอัปของเว็บนี้แล้วลองใหม่'); }}>
            พิมพ์ {picked.size ? `ที่เลือก ${picked.size}` : `ทั้งหมด ${items.length}`} ดวง
          </Button>
          {picked.size > 0 && <Button size="sm" variant="ghost" onClick={() => setPicked(new Set())}>ล้างที่เลือก</Button>}
        </>
      }
    >
      <p className="border-b border-gray-100 px-4 py-3 text-sm text-gray-500">
        ติดหน้าบ้าน — ประชาชนสแกนแล้วกรอกชื่อผู้รับบิลเพื่อดูค่าขยะและชำระ · QR มีแค่บ้านเลขที่และหมู่ ไม่มีชื่อหรือยอดเงิน · เลือกบางหลังเพื่อพิมพ์เฉพาะที่ต้องการได้
      </p>
      {items.length === 0 ? <Empty>ยังไม่มีครัวเรือนในทะเบียน</Empty> : (
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 lg:grid-cols-6">
          {items.map((i) => (
            <article key={i.code} className={`rounded-xl border p-3 text-center ${picked.has(i.code) ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'}`}>
              <button type="button" onClick={() => toggle(i.code)} className="block w-full" aria-pressed={picked.has(i.code)} aria-label={`เลือก QR ${i.title}`}>
                <QrSvg text={i.text} label={i.title} className="mx-auto w-full max-w-[140px]" />
              </button>
              <b className="mt-1 block text-sm">{i.title}</b>
              <small className="block text-gray-500">{i.sub}</small>
              <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => downloadQrPng(i, 'qr-waste').catch((e) => toast.error(getErrorMessage(e)))}>บันทึกรูป</Button>
            </article>
          ))}
        </div>
      )}
    </Panel>
  );
}
