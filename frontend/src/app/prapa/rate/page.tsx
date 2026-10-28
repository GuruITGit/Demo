'use client';
import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/water-api';
import { toast } from '@/hooks/use-toast';
import { useWaterAuthStore } from '@/stores/water-auth.store';
import {
  Building2, Droplets, QrCode, Receipt, FileText, PenLine, ImagePlus, Trash2, Plus, X, Check, ChevronRight, Settings, Printer,
} from 'lucide-react';
import { PageHeader, Field, textareaCls } from '../ui';
import { useCanManage } from '../use-can-manage';

/**
 * ตั้งค่าระบบประปา (Admin) — แบ่งเป็นหมวดซ้าย/ขวา (มือถือเป็นแท็บเลื่อน) แก้ทีละหมวด บันทึกทีเดียวทั้งหน้า
 * หมวด: หน่วยงาน · อัตราค่าน้ำ · พร้อมเพย์ · ใบเสร็จ/ใบแจ้งหนี้ · ลายเซ็น
 * ทุกหมวดมี "ตัวอย่าง" ให้เห็นว่าค่าที่กรอกไปโผล่ตรงไหน (แถบบน / ผลคิดเงิน / หัวใบเสร็จ)
 */

type Tab = 'org' | 'rate' | 'promptpay' | 'docs' | 'notice' | 'sign';
type Tier = { from: number; to: number; price: number };

const TABS: { key: Tab; label: string; hint: string; icon: typeof Building2 }[] = [
  { key: 'org', label: 'หน่วยงาน', hint: 'ชื่อ · โลโก้ · ที่อยู่ · โทร', icon: Building2 },
  { key: 'rate', label: 'อัตราค่าน้ำ', hint: 'ราคา/หน่วย · ค่าบริการ · ค่าธรรมเนียม', icon: Droplets },
  { key: 'promptpay', label: 'พร้อมเพย์', hint: 'QR ให้ประชาชนจ่ายเอง', icon: QrCode },
  { key: 'docs', label: 'ใบเสร็จ / ใบแจ้งหนี้', hint: 'ชื่อเอกสาร · หัว · ท้าย · วันครบกำหนด', icon: Receipt },
  { key: 'notice', label: 'หนังสือแจ้งค้างชำระ', hint: 'เลขที่หนังสือ · กอง · ผู้ลงนาม', icon: FileText },
  { key: 'sign', label: 'ลายเซ็น / ใบเสร็จสีฟ้า', hint: 'รายงาน · ใบเตือน · ตรา · ตำแหน่งพิมพ์', icon: PenLine },
];

const EMPTY = {
  unitPrice: '4', serviceFee: '5', garbageFee: '0', wastewaterFee: '0', taxRate: '0',
  ppId: '', ppType: 'mobile', payee: '', ktbBiller: '',
  slipList: [] as { provider: string; token: string; hasToken?: boolean }[], slipReceiverName: '',
  docTitle: '', receiptHeader: '', receiptFooter: '',
  invoiceHeader: '', invoiceFooter: '', billExpiryDays: '30',
  reportSignatureUrl: '', warningSignatureUrl: '',
  receiptSealUrl: '', receiptSignatureUrl: '', receiptOffsetX: '0', receiptOffsetY: '0',
  orgName: '', orgAddress: '', orgPhone: '', orgLogoUrl: '',
  noticeDocPrefix: '', noticeAddressLine: '', noticeDivision: '', noticePhone: '',
  noticeSignerName: '', noticeSignerTitle: '', noticeDueDays: '7',
};
type Form = typeof EMPTY;

const money = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** อ่านรูปแล้วย่อให้ด้านยาวสุดไม่เกิน maxPx (คง PNG โปร่งใส) → dataURL ขนาดเล็กพอเก็บใน DB/ส่ง JSON */
function readImageResized(file: File, maxPx: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error('canvas')); return; }
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('อ่านรูปไม่ได้')); };
    img.src = url;
  });
}

export default function PrapaSettingsPage() {
  const canManage = useCanManage();
  const qc = useQueryClient();
  const orgId = useWaterAuthStore((s) => s.user?.organizationId);
  const [tab, setTab] = useState<Tab>('org');

  const { data: rate } = useQuery({
    queryKey: ['water-rate'],
    queryFn: async () => (await api.get('/water/billing/rate')).data.data as any,
  });
  // ค่าจากระบบหลัก (placeholder + fallback เมื่อเว้นว่าง)
  const { data: org } = useQuery({
    queryKey: ['prapa-org', orgId],
    queryFn: async () => (await api.get('/water/auth/org')).data.data as { main?: { nameTh?: string; phone?: string; address?: string; logoUrl?: string | null } },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });
  const main = org?.main || {};

  const [f, setF] = useState<Form>(EMPTY);
  const [rateMode, setRateMode] = useState<'flat' | 'tiered'>('flat');
  const [tiers, setTiers] = useState<Tier[]>([{ from: 1, to: 30, price: 5 }]);
  const [snapshot, setSnapshot] = useState('');
  const set = (p: Partial<Form>) => setF((s) => ({ ...s, ...p }));

  useEffect(() => {
    if (!rate) return;
    const next: Form = {
      unitPrice: String(rate.unitPrice ?? 4), serviceFee: String(rate.serviceFee ?? 5),
      garbageFee: String(rate.garbageFee ?? 0), wastewaterFee: String(rate.wastewaterFee ?? 0), taxRate: String(rate.taxRate ?? 0),
      ppId: rate.promptpayId || '', ppType: rate.promptpayType || 'mobile', payee: rate.payeeName || '',
      ktbBiller: rate.ktbBillerId || '',
      slipList: (rate.slipVerifyList || []).map((p: any) => ({ provider: p.provider, token: '', hasToken: true })), slipReceiverName: rate.slipReceiverName || '',
      docTitle: rate.docTitle || '', receiptHeader: rate.receiptHeader || '', receiptFooter: rate.receiptFooter || '',
      invoiceHeader: rate.invoiceHeader || '', invoiceFooter: rate.invoiceFooter || '', billExpiryDays: String(rate.billExpiryDays ?? 30),
      reportSignatureUrl: rate.reportSignatureUrl || '', warningSignatureUrl: rate.warningSignatureUrl || '',
      receiptSealUrl: rate.receiptSealUrl || '', receiptSignatureUrl: rate.receiptSignatureUrl || '',
      receiptOffsetX: String(Number(rate.receiptOffsetX ?? 0)), receiptOffsetY: String(Number(rate.receiptOffsetY ?? 0)),
      orgName: rate.orgName || '', orgAddress: rate.orgAddress || '', orgPhone: rate.orgPhone || '', orgLogoUrl: rate.orgLogoUrl || '',
      noticeDocPrefix: rate.noticeDocPrefix || '', noticeAddressLine: rate.noticeAddressLine || '',
      noticeDivision: rate.noticeDivision || '', noticePhone: rate.noticePhone || '',
      noticeSignerName: rate.noticeSignerName || '', noticeSignerTitle: rate.noticeSignerTitle || '',
      noticeDueDays: String(rate.noticeDueDays ?? 7),
    };
    const mode = rate.rateMode === 'tiered' ? 'tiered' : 'flat';
    const t = Array.isArray(rate.tiers) && rate.tiers.length ? rate.tiers : [{ from: 1, to: 30, price: 5 }];
    setF(next); setRateMode(mode); setTiers(t);
    setSnapshot(JSON.stringify({ next, mode, t }));
  }, [rate]);

  const dirty = snapshot !== '' && JSON.stringify({ next: f, mode: rateMode, t: tiers }) !== snapshot;

  const save = useMutation({
    mutationFn: () => api.put('/water/billing/rate', {
      unitPrice: Number(f.unitPrice), serviceFee: Number(f.serviceFee),
      garbageFee: Number(f.garbageFee), wastewaterFee: Number(f.wastewaterFee), taxRate: Number(f.taxRate),
      promptpayId: f.ppId.trim(), promptpayType: f.ppType, payeeName: f.payee.trim(), ktbBillerId: f.ktbBiller.trim(),
      slipVerifyProviders: f.slipList.filter((x) => x.provider).map((x) => ({ provider: x.provider, token: x.token.trim() || undefined })),
      slipReceiverName: f.slipReceiverName.trim() || undefined,
      docTitle: f.docTitle.trim(), receiptHeader: f.receiptHeader.trim(), receiptFooter: f.receiptFooter.trim(),
      invoiceHeader: f.invoiceHeader.trim(), invoiceFooter: f.invoiceFooter.trim(), billExpiryDays: Number(f.billExpiryDays) || 0,
      reportSignatureUrl: f.reportSignatureUrl, warningSignatureUrl: f.warningSignatureUrl,
      receiptSealUrl: f.receiptSealUrl, receiptSignatureUrl: f.receiptSignatureUrl,
      receiptOffsetX: clampOffset(f.receiptOffsetX), receiptOffsetY: clampOffset(f.receiptOffsetY),
      rateMode, tiers: rateMode === 'tiered' ? tiers.map((t) => ({ from: Number(t.from), to: Number(t.to), price: Number(t.price) })) : [],
      orgName: f.orgName.trim(), orgAddress: f.orgAddress.trim(), orgPhone: f.orgPhone.trim(), orgLogoUrl: f.orgLogoUrl,
      noticeDocPrefix: f.noticeDocPrefix.trim(), noticeAddressLine: f.noticeAddressLine.trim(),
      noticeDivision: f.noticeDivision.trim(), noticePhone: f.noticePhone.trim(),
      noticeSignerName: f.noticeSignerName.trim(), noticeSignerTitle: f.noticeSignerTitle.trim(),
      noticeDueDays: Number(f.noticeDueDays) || 7,
    }),
    onSuccess: () => {
      toast.success('บันทึกการตั้งค่าแล้ว');
      qc.invalidateQueries({ queryKey: ['water-rate'] });
      qc.invalidateQueries({ queryKey: ['prapa-org'] }); // แถบบนเปลี่ยนชื่อ/โลโก้ตาม
    },
    onError: (e) => toast.error(getErrorMessage(e, 'บันทึกไม่สำเร็จ')),
  });

  const pickImage = async (key: 'orgLogoUrl' | 'reportSignatureUrl' | 'warningSignatureUrl' | 'receiptSealUrl' | 'receiptSignatureUrl', file: File | undefined, maxPx: number) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('เลือกได้เฉพาะไฟล์รูปภาพ'); return; }
    try { set({ [key]: await readImageResized(file, maxPx) } as Partial<Form>); }
    catch { toast.error('อ่านรูปไม่ได้ ลองไฟล์อื่น'); }
  };

  // ใบทดสอบใบเสร็จสีฟ้า — ใช้ค่าที่บันทึกแล้ว (ตรา/ลายเซ็น/ค่าเลื่อน)
  const [testing, setTesting] = useState(false);
  const printBlueTest = async () => {
    setTesting(true);
    try {
      const res = await api.get('/water/billing/blue-receipt/test', { responseType: 'blob' });
      const u = URL.createObjectURL(res.data as Blob);
      window.open(u, '_blank'); setTimeout(() => URL.revokeObjectURL(u), 60000);
    } catch (e) { toast.error(getErrorMessage(e, 'เปิดใบทดสอบไม่สำเร็จ')); }
    finally { setTesting(false); }
  };

  // ตัวอย่างการคิดเงิน (สูตรเดียวกับ backend computeCharges)
  const [sampleUnits, setSampleUnits] = useState(10);
  const sample = useMemo(() => {
    let water = 0;
    if (rateMode === 'tiered') {
      // ขั้นสุดท้ายไม่มีเพดาน (ตรงกับ backend)
      const sorted = [...tiers].sort((a, b) => Number(a.from) - Number(b.from));
      sorted.forEach((t, i) => {
        const to = i === sorted.length - 1 ? Infinity : Number(t.to);
        if (sampleUnits >= t.from) water += (Math.min(sampleUnits, to) - t.from + 1) * Number(t.price || 0);
      });
    } else water = sampleUnits * Number(f.unitPrice || 0);
    const service = Number(f.serviceFee || 0), garbage = Number(f.garbageFee || 0), waste = Number(f.wastewaterFee || 0);
    const taxable = water + service + garbage + waste;
    const tax = +(taxable * Number(f.taxRate || 0) / 100).toFixed(2);
    return { water, service, garbage, waste, tax, total: +(taxable + tax).toFixed(2) };
  }, [rateMode, tiers, sampleUnits, f.unitPrice, f.serviceFee, f.garbageFee, f.wastewaterFee, f.taxRate]);

  const orgName = f.orgName.trim() || main.nameTh || '';
  const orgAddress = f.orgAddress.trim() || main.address || '';
  const orgPhone = f.orgPhone.trim() || main.phone || '';
  const orgLogo = f.orgLogoUrl || main.logoUrl || '';
  // ที่อยู่หัวหนังสือแบบราชการ — ถ้าไม่ตั้งเอง backend ประกอบ "อำเภอ… จังหวัด…" จากทะเบียนหน่วยงานให้
  const autoAddressLine = (main.address || '').replace(/^ต\.\S+\s*/, '').replace(/อ\./, 'อำเภอ').replace(/จ\./, 'จังหวัด'); // ใช้ในพรีวิวหนังสือเท่านั้น
  const active = TABS.find((t) => t.key === tab)!;

  return (
    <div className="space-y-4">
      {/* หัวหน้า */}
      <PageHeader icon={Settings} iconClass="text-slate-500" title="ตั้งค่าระบบประปา" desc="ตั้งครั้งเดียว มีผลทั้งใบแจ้งหนี้ ใบเสร็จ รายงาน และหน้าเช็คบิลของประชาชน"
        actions={canManage && <SaveButton dirty={dirty} pending={save.isPending} onClick={() => save.mutate()} className="hidden sm:inline-flex" />} />

      {!canManage && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">โหมดดูอย่างเดียว — บัญชีนี้ไม่มีสิทธิ์แก้ไขการตั้งค่า</p>
      )}

      <div className="grid gap-4 lg:grid-cols-[232px_1fr] lg:items-start">
        {/* เมนูหมวด — เดสก์ท็อปเป็นรายการซ้าย / มือถือเป็นแถบเลื่อนแนวนอน */}
        <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:sticky lg:top-16 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
          {TABS.map((t) => {
            const on = t.key === tab;
            return (
              <button key={t.key} type="button" onClick={() => setTab(t.key)}
                className={`flex shrink-0 items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm transition lg:w-full lg:py-2.5 ${
                  on ? 'border-sky-200 bg-sky-50 text-sky-800' : 'border-transparent text-slate-600 hover:bg-white hover:text-slate-800'}`}>
                <t.icon className={`h-4 w-4 shrink-0 ${on ? 'text-sky-600' : 'text-slate-400'}`} />
                <span className="min-w-0">
                  <span className="block font-medium">{t.label}</span>
                  <span className={`hidden truncate text-[11px] lg:block ${on ? 'text-sky-600/80' : 'text-slate-400'}`}>{t.hint}</span>
                </span>
                {on && <ChevronRight className="ml-auto hidden h-4 w-4 text-sky-400 lg:block" />}
              </button>
            );
          })}
        </nav>

        {/* แผงหมวดที่เลือก */}
        <fieldset disabled={!canManage} className="min-w-0 space-y-4">
          <div className="flex items-center gap-2 px-1 lg:hidden">
            <active.icon className="h-4 w-4 text-sky-600" />
            <span className="text-sm font-semibold text-slate-700">{active.label}</span>
            <span className="text-xs text-slate-400">— {active.hint}</span>
          </div>

          {tab === 'org' && (
            <>
              <Card title="ข้อมูลหน่วยงาน" desc="ใช้บนแถบบนของระบบประปา หัวใบเสร็จ/ใบแจ้งหนี้ ซองจดหมาย และหัวรายงาน — ช่องไหนเว้นว่างจะใช้ค่าจากระบบหลักให้อัตโนมัติ">
                <div className="flex flex-col gap-5 sm:flex-row">
                  {/* โลโก้ */}
                  <div className="flex shrink-0 flex-col items-center gap-2 sm:w-40">
                    <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50">
                      {f.orgLogoUrl ? <img src={f.orgLogoUrl} alt="" className="h-full w-full object-contain p-2" />
                        : <Building2 className="h-9 w-9 text-slate-300" />}
                    </div>
                    <p className="text-center text-[11px] text-slate-400">
                      {f.orgLogoUrl ? 'โลโก้ของระบบประปา' : main.logoUrl ? 'ยังไม่ได้อัปโหลด — จะใช้โลโก้จากระบบหลัก' : 'ยังไม่มีโลโก้'}
                    </p>
                    <div className="flex gap-1.5">
                      <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                        <ImagePlus className="h-3.5 w-3.5" /> {f.orgLogoUrl ? 'เปลี่ยน' : 'อัปโหลด'}
                        <input type="file" accept="image/*" className="sr-only" onChange={(e) => { pickImage('orgLogoUrl', e.target.files?.[0], 256); e.target.value = ''; }} />
                      </label>
                      {f.orgLogoUrl && (
                        <button type="button" onClick={() => set({ orgLogoUrl: '' })} title="กลับไปใช้โลโก้จากระบบหลัก"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50">
                          <Trash2 className="h-3.5 w-3.5" /> ลบ
                        </button>
                      )}
                    </div>
                  </div>
                  {/* ชื่อ/ที่อยู่/โทร */}
                  <div className="grid flex-1 gap-3 sm:grid-cols-2">
                    <Field label="ชื่อหน่วยงาน" className="sm:col-span-2">
                      <input value={f.orgName} onChange={(e) => set({ orgName: e.target.value })} placeholder="เช่น องค์การบริหารส่วนตำบล…" className={INPUT} />
                    </Field>
                    <Field label="ที่อยู่ (พิมพ์บนใบเสร็จ/ซองจดหมาย)" className="sm:col-span-2">
                      <textarea value={f.orgAddress} onChange={(e) => set({ orgAddress: e.target.value })} rows={2} placeholder="เช่น ต.… อ.… จ.…" className={INPUT} />
                    </Field>
                    <Field label="เบอร์โทร">
                      <input value={f.orgPhone} onChange={(e) => set({ orgPhone: e.target.value })} placeholder="เช่น 0xx-xxxxxx" className={INPUT} />
                    </Field>
                  </div>
                </div>
              </Card>

              <Card title="ตัวอย่างบนแถบบน" desc="แถบด้านบนของทุกหน้าในระบบประปาจะแสดงแบบนี้">
                <div className="flex h-13 items-center gap-2 rounded-xl bg-sky-600 px-3 text-white">
                  <span className="text-xs text-white/70">ระบบประปา</span>
                  <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
                    {orgLogo && <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/95 p-0.5 ring-1 ring-white/50"><img src={orgLogo} alt="" className="h-full w-full object-contain" /></span>}
                    <span className="truncate text-base font-bold tracking-tight">{orgName || 'ชื่อหน่วยงาน'}</span>
                  </div>
                  <span className="h-7 w-7 shrink-0 rounded-full bg-white/20" />
                </div>
              </Card>
            </>
          )}

          {tab === 'rate' && (
            <div className="grid gap-4 xl:grid-cols-[1fr_300px] xl:items-start">
              <div className="space-y-4">
                <Card title="วิธีคิดค่าน้ำ" desc="เลือกให้ตรงกับข้อบัญญัติของ อบต. — ระบบใช้สูตรนี้ตอนจดมิเตอร์และออกใบแจ้งหนี้">
                  <Segmented value={rateMode} onChange={setRateMode}
                    options={[{ value: 'flat', label: 'ราคาเดียว', sub: 'ทุกหน่วยราคาเท่ากัน' }, { value: 'tiered', label: 'ขั้นบันได', sub: 'ยิ่งใช้มากยิ่งแพงขึ้น' }]} />
                  {rateMode === 'flat' ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Num label="ราคาต่อหน่วย" unit="บาท/หน่วย" value={f.unitPrice} onChange={(v) => set({ unitPrice: v })} />
                      <Num label="ค่าบริการต่อบิล" unit="บาท" value={f.serviceFee} onChange={(v) => set({ serviceFee: v })} hint="เก็บทุกราย แม้ใช้ 0 หน่วย" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="overflow-hidden rounded-xl border border-slate-200">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 text-xs text-slate-500">
                            <tr><th className="px-3 py-2 text-left font-medium">ขั้น</th><th className="px-2 py-2 text-left font-medium">หน่วยที่</th><th className="px-2 py-2 text-left font-medium">ถึง</th><th className="px-2 py-2 text-left font-medium">บาท/หน่วย</th><th className="w-10" /></tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {tiers.map((t, i) => {
                              const upd = (p: Partial<Tier>) => setTiers((a) => a.map((x, j) => (j === i ? { ...x, ...p } : x)));
                              return (
                                <tr key={i}>
                                  <td className="px-3 py-1.5 text-slate-500">{i + 1}</td>
                                  <td className="px-2 py-1.5"><input type="number" min="0" value={t.from} onChange={(e) => upd({ from: Number(e.target.value) })} className={INPUT_SM} /></td>
                                  <td className="px-2 py-1.5"><input type="number" min="0" value={t.to} onChange={(e) => upd({ to: Number(e.target.value) })} className={INPUT_SM} /></td>
                                  <td className="px-2 py-1.5"><input type="number" step="0.01" min="0" value={t.price} onChange={(e) => upd({ price: Number(e.target.value) })} className={INPUT_SM} /></td>
                                  <td className="px-1 py-1.5 text-center">
                                    <button type="button" onClick={() => setTiers((a) => a.filter((_, j) => j !== i))} disabled={tiers.length <= 1}
                                      className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30" title="ลบขั้นนี้"><X className="h-4 w-4" /></button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <button type="button" onClick={() => setTiers((a) => [...a, { from: (a.at(-1)?.to ?? 0) + 1, to: (a.at(-1)?.to ?? 0) + 20, price: (a.at(-1)?.price ?? 5) + 1 }])}
                        className="inline-flex items-center gap-1 rounded-lg border border-dashed border-sky-300 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-50">
                        <Plus className="h-3.5 w-3.5" /> เพิ่มขั้น
                      </button>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Num label="ค่าบริการต่อบิล" unit="บาท" value={f.serviceFee} onChange={(v) => set({ serviceFee: v })} hint="เก็บทุกราย แม้ใช้ 0 หน่วย" />
                      </div>
                    </div>
                  )}
                </Card>

                <Card title="ค่าธรรมเนียมอื่น" desc="บวกเพิ่มทุกบิล — ใส่ 0 ถ้า อบต. ไม่เก็บ">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Num label="ค่าขยะ" unit="บาท" value={f.garbageFee} onChange={(v) => set({ garbageFee: v })} />
                    <Num label="ค่าบำบัดน้ำเสีย" unit="บาท" value={f.wastewaterFee} onChange={(v) => set({ wastewaterFee: v })} />
                    <Num label="ภาษี" unit="%" value={f.taxRate} onChange={(v) => set({ taxRate: v })} />
                  </div>
                </Card>
              </div>

              {/* ตัวอย่างคิดเงิน — อยู่ขวาบนจอกว้าง */}
              <Card title="ลองคิดเงิน" desc="เปลี่ยนตัวเลขด้านซ้ายแล้วดูผลทันที">
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  ใช้น้ำ
                  <input type="number" min="0" value={sampleUnits} onChange={(e) => setSampleUnits(Math.max(0, Number(e.target.value) || 0))}
                    className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-center text-sm font-semibold text-slate-800 focus:border-sky-400 focus:outline-none" />
                  หน่วย
                </label>
                <dl className="divide-y divide-slate-100 text-sm">
                  <Row label="ค่าน้ำ" value={sample.water} />
                  <Row label="ค่าบริการ" value={sample.service} />
                  {sample.garbage > 0 && <Row label="ค่าขยะ" value={sample.garbage} />}
                  {sample.waste > 0 && <Row label="ค่าบำบัด" value={sample.waste} />}
                  {sample.tax > 0 && <Row label={`ภาษี ${f.taxRate}%`} value={sample.tax} />}
                  <div className="flex items-baseline justify-between pt-2">
                    <dt className="font-semibold text-slate-800">รวมทั้งสิ้น</dt>
                    <dd className="text-xl font-bold tabular-nums text-sky-700">{money(sample.total)} <span className="text-xs font-normal text-slate-400">บาท</span></dd>
                  </div>
                </dl>
              </Card>
            </div>
          )}

          {tab === 'promptpay' && (
            <Card title="พร้อมเพย์ของ อบต." desc="เมื่อตั้งแล้ว ใบแจ้งหนี้และหน้าเช็คบิลของประชาชนจะแสดง QR ให้สแกนจ่ายได้เอง — เว้นว่างถ้าให้ชำระที่สำนักงาน/เจ้าหน้าที่เท่านั้น"
              aside={<Pill on={!!f.ppId.trim()} onText="แสดง QR" offText="ไม่แสดง QR" />}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="เลขพร้อมเพย์ปลายทาง">
                  <input value={f.ppId} onChange={(e) => set({ ppId: e.target.value })} placeholder="เบอร์โทร / เลขผู้เสียภาษี ของ อบต." className={INPUT} inputMode="numeric" />
                </Field>
                <Field label="ชนิดของเลข">
                  <select value={f.ppType} onChange={(e) => set({ ppType: e.target.value })} className={INPUT}>
                    <option value="mobile">เบอร์มือถือ</option>
                    <option value="natid">เลขบัตรประชาชน / ผู้เสียภาษี</option>
                    <option value="ewallet">e-Wallet</option>
                  </select>
                </Field>
                <Field label="ชื่อบัญชีผู้รับเงิน (แสดงคู่ QR)" className="sm:col-span-2">
                  <input value={f.payee} onChange={(e) => set({ payee: e.target.value })} placeholder="เช่น องค์การบริหารส่วนตำบล…" className={INPUT} />
                </Field>
              </div>
              <div className="mt-4 space-y-2 rounded-xl border border-sky-100 bg-sky-50/50 p-4">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                  Biller ID — KTB Bill Payment (กระทบยอดอัตโนมัติ)
                </p>
                <Field label="Biller ID (Comp Code) จากการสมัครกับธนาคารกรุงไทย">
                  <input value={f.ktbBiller} onChange={(e) => set({ ktbBiller: e.target.value.replace(/\D/g, '') })} placeholder="เช่น 099400000123456" className={INPUT} inputMode="numeric" />
                </Field>
                <p className="text-xs text-slate-500">
                  ตั้งค่านี้แล้ว: ใบแจ้งหนี้จะออก <b>QR Bill Payment</b> (มีเลขอ้างอิงในตัว) แทนพร้อมเพย์ → ประชาชนสแกนจ่ายที่ธนาคารไหนก็ได้ เงินเข้าบัญชี อบต. แล้วระบบ<b>ตัดยอด+ออกใบเสร็จอัตโนมัติ</b>จากไฟล์ที่ธนาคารส่งมา (เมนู “กระทบยอดจากธนาคาร”) · เว้นว่าง = ใช้ QR พร้อมเพย์เดิม (ต้องแนบสลิปยืนยันเอง)
                </p>
              </div>

              {/* ตรวจสลิปอัตโนมัติ (ปิดช่องยืนยันสลิปปลอม) — ตั้งได้หลายเจ้า เจ้าแรกโทเคนหมด→ใช้เจ้าถัดไป */}
              <div className="mt-4 space-y-2 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                  ตรวจสลิปอัตโนมัติกับธนาคาร (กันสลิปปลอม)
                  {f.slipList.length > 0 && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">{f.slipList.length} เจ้า</span>}
                </p>
                <div className="space-y-2">
                  {f.slipList.map((row, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-5 shrink-0 text-center text-xs text-slate-400">{i + 1}</span>
                      <select value={row.provider}
                        onChange={(e) => set({ slipList: f.slipList.map((r, j) => j === i ? { ...r, provider: e.target.value } : r) })}
                        className={`${INPUT} max-w-40`}>
                        <option value="">— เลือกเจ้า —</option>
                        <option value="easyslip">EasySlip</option>
                        <option value="slip2go">Slip2Go</option>
                        <option value="slipok">SlipOK</option>
                      </select>
                      <input type="password" value={row.token} autoComplete="off"
                        onChange={(e) => set({ slipList: f.slipList.map((r, j) => j === i ? { ...r, token: e.target.value } : r) })}
                        placeholder={row.hasToken ? '•••••••• (ตั้งไว้แล้ว)' : 'วาง token / secret key'} className={`${INPUT} flex-1`} />
                      <button type="button" onClick={() => set({ slipList: f.slipList.filter((_, j) => j !== i) })}
                        className="shrink-0 rounded-lg border border-rose-200 px-2.5 py-2 text-sm text-rose-500 hover:bg-rose-50">ลบ</button>
                    </div>
                  ))}
                  <button type="button" onClick={() => set({ slipList: [...f.slipList, { provider: '', token: '' }] })}
                    className="rounded-lg border border-dashed border-emerald-300 px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-50">+ เพิ่มผู้ให้บริการ</button>
                </div>
                <Field label="ชื่อบัญชีผู้รับเงิน (ตามที่ขึ้นบนสลิป)">
                  <input value={f.slipReceiverName} onChange={(e) => set({ slipReceiverName: e.target.value })}
                    placeholder="เช่น โชคชัย กัลยา — ชื่อเจ้าของบัญชี/พร้อมเพย์ที่รับเงินจริง" className={INPUT} />
                </Field>
                <p className="text-xs text-slate-500">
                  ⚠️ <b>สำคัญ</b>: ระบบเทียบ &quot;บัญชีปลายทางตรงไหม&quot; ด้วย<b>ชื่อบัญชี</b> — ตั้งให้ตรงกับชื่อที่ขึ้นบนสลิป (เลขพร้อมเพย์บนสลิปจะโชว์เป็นเลขบัญชีธนาคารจริง คนละเลขกับเบอร์ เทียบเบอร์ไม่ได้) · เว้นว่าง = ไม่เทียบบัญชีปลายทาง (ยึดสลิปจริง+ยอดตรง+ไม่ซ้ำ)
                </p>
                <p className="text-xs text-slate-500">
                  ระบบจะไล่ใช้ทีละเจ้าตามลำดับ — <b>เจ้าแรกโทเคนหมด/ล่ม จะสลับไปเจ้าถัดไปอัตโนมัติ</b> · เปิดแล้ว: จ่ายแบบ QR ต้องตรวจสลิปผ่านก่อน (ยอดตรง+บัญชีตรง+ไม่ซ้ำ) เจ้าหน้าที่ถึงกดรับเงินได้ · SlipOK ใส่ token เป็น <span className="font-mono">branchId:apiKey</span> · ไม่ใส่เลย = ปิด (ตรวจเอง)
                </p>
              </div>
            </Card>
          )}

          {tab === 'docs' && (
            <div className="grid gap-4 xl:grid-cols-[1fr_260px] xl:items-start">
              <div className="space-y-4">
                <Card title="ใบเสร็จรับเงิน" desc="พิมพ์จากเครื่องพิมพ์พกพา 58mm หลังรับชำระ">
                  <Field label="ชื่อเอกสาร (บรรทัดแรกใต้ครุฑ)">
                    <input value={f.docTitle} onChange={(e) => set({ docTitle: e.target.value })} placeholder="ใบเสร็จรับเงินค่าน้ำประปา" className={INPUT} />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="ข้อความหัวเอกสาร" hint="ใต้ชื่อ/ที่อยู่หน่วยงาน เช่น กองการประปา หรือเวลาทำการ">
                      <textarea value={f.receiptHeader} onChange={(e) => set({ receiptHeader: e.target.value })} rows={3} placeholder="กองการประปา เปิดทำการ จ.–ศ. 08.30–16.30 น." className={INPUT} />
                    </Field>
                    <Field label="ข้อความท้ายใบเสร็จ">
                      <textarea value={f.receiptFooter} onChange={(e) => set({ receiptFooter: e.target.value })} rows={3} placeholder="กรุณาเก็บไว้เป็นหลักฐานว่าท่านได้ชำระเรียบร้อยแล้ว" className={INPUT} />
                    </Field>
                  </div>
                </Card>

                <Card title="ใบแจ้งหนี้" desc="พิมพ์ตอนจดมิเตอร์ (ยังไม่ได้รับเงิน) — ช่องไหนเว้นว่างจะใช้ข้อความของใบเสร็จ">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="ข้อความหัวใบแจ้งหนี้">
                      <textarea value={f.invoiceHeader} onChange={(e) => set({ invoiceHeader: e.target.value })} rows={3} placeholder={f.receiptHeader || 'ใช้ข้อความหัวของใบเสร็จ'} className={INPUT} />
                    </Field>
                    <Field label="ข้อความท้ายใบแจ้งหนี้">
                      <textarea value={f.invoiceFooter} onChange={(e) => set({ invoiceFooter: e.target.value })} rows={3} placeholder={f.receiptFooter || 'หมายเหตุ มีปัญหา/ขัดข้อง ให้แจ้งตามที่อยู่ด้านบน'} className={INPUT} />
                    </Field>
                    <Num label="ชำระภายใน" unit="วัน นับจากวันจด" value={f.billExpiryDays} onChange={(v) => set({ billExpiryDays: v })} integer hint="0 = ไม่พิมพ์วันครบกำหนด" />
                  </div>
                </Card>
              </div>

              <SlipPreview title={f.docTitle} orgName={orgName} address={orgAddress} phone={orgPhone}
                receipt={{ header: f.receiptHeader, footer: f.receiptFooter }}
                invoice={{ header: f.invoiceHeader || f.receiptHeader, footer: f.invoiceFooter || f.receiptFooter, days: Number(f.billExpiryDays) || 0 }} />
            </div>
          )}

          {tab === 'notice' && (
            <div className="grid gap-4 xl:grid-cols-[1fr_300px] xl:items-start">
              <div className="space-y-4">
                <Card title="หัวหนังสือราชการ" desc="หนังสือแจ้งเตือนค้างชำระที่ออกจากเมนู “หนังสือแจ้งค้างชำระ” — ชื่อและที่อยู่หน่วยงานใช้จากหมวด “หน่วยงาน” ให้อัตโนมัติ">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="เลขที่หนังสือ (ส่วนหน้า)" hint="พิมพ์เป็น “ที่ <ค่านี้>/<เลขที่ออก>” เช่น บร 85405">
                      <input value={f.noticeDocPrefix} onChange={(e) => set({ noticeDocPrefix: e.target.value })} placeholder="บร 00000" className={INPUT} />
                    </Field>
                    <Field label="กองที่รับผิดชอบกิจการประปา" hint="เว้นว่าง = เขียนแค่ “กิจการประปา <ชื่อหน่วยงาน>”">
                      <input value={f.noticeDivision} onChange={(e) => set({ noticeDivision: e.target.value })} placeholder="กองช่าง" className={INPUT} />
                    </Field>
                    <Field label="ที่อยู่บนหัวหนังสือ" hint="แบบราชการ ใส่รหัสไปรษณีย์ด้วย · คนละบรรทัดกับที่อยู่บนใบเสร็จ" className="sm:col-span-2">
                      <input value={f.noticeAddressLine} onChange={(e) => set({ noticeAddressLine: e.target.value })}
                        placeholder="เช่น อำเภอ… จังหวัด… 00000" className={INPUT} />
                    </Field>
                  </div>
                </Card>

                <Card title="ผู้ลงนามและกำหนดชำระ" desc="ลายเซ็นที่จะวางเหนือชื่อ ตั้งได้ในหมวด “ลายเซ็น” — ไม่ใส่รูปก็เว้นช่องไว้เซ็นมือ">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="ชื่อผู้ลงนาม" hint="พิมพ์ในวงเล็บใต้ลายเซ็น · เว้นว่าง = เว้นช่องไว้เขียนมือ">
                      <input value={f.noticeSignerName} onChange={(e) => set({ noticeSignerName: e.target.value })} placeholder="นายสมชาย ใจดี" className={INPUT} />
                    </Field>
                    <Field label="ตำแหน่ง" hint="เว้นว่าง = ใช้ “นายก” นำหน้าชื่อหน่วยงานให้">
                      <input value={f.noticeSignerTitle} onChange={(e) => set({ noticeSignerTitle: e.target.value })} placeholder="เช่น นายกองค์การบริหารส่วนตำบล…" className={INPUT} />
                    </Field>
                    <Num label="ให้ชำระภายใน" unit="วัน นับจากได้รับหนังสือ" value={f.noticeDueDays} onChange={(v) => set({ noticeDueDays: v })} integer />
                    <Field label="โทร./โทรสาร ท้ายหนังสือ" hint="เว้นว่าง = ใช้เบอร์จากหมวด “หน่วยงาน”">
                      <input value={f.noticePhone} onChange={(e) => set({ noticePhone: e.target.value })} placeholder="เช่น 0xx-xxxxxx" className={INPUT} />
                    </Field>
                  </div>
                </Card>
              </div>

              <NoticePreview orgName={orgName} addressLine={f.noticeAddressLine.trim() || autoAddressLine} phone={f.noticePhone.trim() || orgPhone}
                docPrefix={f.noticeDocPrefix} division={f.noticeDivision}
                signerName={f.noticeSignerName} signerTitle={f.noticeSignerTitle}
                dueDays={Number(f.noticeDueDays) || 7} signature={f.warningSignatureUrl} />
            </div>
          )}

          {tab === 'sign' && (
            <Card title="รูปลายเซ็น" desc="วางในช่องลงนามอัตโนมัติ — ถ่าย/สแกนลายเซ็นบนกระดาษขาว ตัดขอบให้พอดี · ไม่ใส่ = เว้นช่องไว้เซ็นมือ">
              <div className="grid gap-4 sm:grid-cols-2">
                {([
                  ['reportSignatureUrl', 'ลายเซ็นบนรายงาน', 'ป.17 บัญชีลูกหนี้ · ป.32 ทะเบียนคุมใบเสร็จ'],
                  ['warningSignatureUrl', 'ลายเซ็นบนหนังสือแจ้งค้างชำระ', 'ช่องลงนามนายก อบต.'],
                  ['receiptSealUrl', 'ตราบนใบเสร็จสีฟ้า', 'ประทับที่ต้นขั้วและสำเนา · ใช้รูปตราพื้นโปร่งใส'],
                  ['receiptSignatureUrl', 'ลายเซ็นผู้รับเงินบนใบเสร็จสีฟ้า', 'ต้นขั้วและตัวจริง'],
                ] as const).map(([k, label, sub]) => (
                  <div key={k} className="rounded-xl border border-slate-200 p-3">
                    <p className="text-sm font-medium text-slate-700">{label}</p>
                    <p className="mb-2 text-[11px] text-slate-400">{sub}</p>
                    <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50">
                      {f[k] ? <img src={f[k]} alt="" className="max-h-20 max-w-full object-contain" /> : <span className="text-xs text-slate-400">ยังไม่มีรูป</span>}
                    </div>
                    <div className="mt-2 flex gap-1.5">
                      <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                        <ImagePlus className="h-3.5 w-3.5" /> {f[k] ? 'เปลี่ยนรูป' : 'อัปโหลดรูป'}
                        <input type="file" accept="image/*" className="sr-only" onChange={(e) => { pickImage(k, e.target.files?.[0], 800); e.target.value = ''; }} />
                      </label>
                      {f[k] && (
                        <button type="button" onClick={() => set({ [k]: '' } as Partial<Form>)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50">
                          <Trash2 className="h-3.5 w-3.5" /> ลบ
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {tab === 'sign' && (
            <Card title="ตำแหน่งพิมพ์ใบเสร็จสีฟ้า" desc="ใบเสร็จบนกระดาษต่อเนื่องที่พิมพ์ฟอร์มไว้แล้ว ระบบพิมพ์เฉพาะข้อความลงช่อง · ถ้าพิมพ์ออกมาเหลื่อมช่อง ให้ปรับค่าเลื่อนที่นี่ครั้งเดียว">
              <div className="grid gap-3 sm:grid-cols-2">
                <Num label="เลื่อนซ้าย-ขวา" unit="มม. (บวก = ขวา)" value={f.receiptOffsetX} onChange={(v) => set({ receiptOffsetX: v })} signed />
                <Num label="เลื่อนขึ้น-ลง" unit="มม. (บวก = ลง)" value={f.receiptOffsetY} onChange={(v) => set({ receiptOffsetY: v })} signed />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" onClick={printBlueTest} disabled={testing}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                  <Printer className="h-4 w-4" /> {testing ? 'กำลังเปิด…' : 'พิมพ์ใบทดสอบ'}
                </button>
                <p className="text-xs text-slate-400">{dirty ? 'บันทึกก่อน ใบทดสอบจึงจะใช้ค่าใหม่' : 'ตอนสั่งพิมพ์ ตั้งขนาดกระดาษให้ตรงกับกระดาษต่อเนื่อง และสเกล 100% (ไม่ใช่ “พอดีหน้า”)'}</p>
              </div>
            </Card>
          )}
        </fieldset>
      </div>

      {/* แถบบันทึกล่าง (มือถือ) — โผล่เมื่อมีการแก้ */}
      {canManage && dirty && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden">
          <SaveButton dirty={dirty} pending={save.isPending} onClick={() => save.mutate()} className="inline-flex w-full" />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────── ชิ้นส่วน UI ของหน้านี้
const INPUT = `${textareaCls} disabled:bg-slate-50 disabled:text-slate-500`;
const INPUT_SM = 'w-full min-w-16 rounded-lg border border-slate-200 px-2 py-2 text-base tabular-nums focus:border-sky-400 focus:outline-none sm:py-1.5 sm:text-sm';

function Card({ title, desc, aside, children }: { title: string; desc?: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-3.5">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          {desc && <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{desc}</p>}
        </div>
        {aside}
      </div>
      <div className="space-y-4 p-4 sm:p-5">{children}</div>
    </section>
  );
}

/** ค่าเลื่อนใบเสร็จสีฟ้า (มม.) — backend รับ -30..30 */
const clampOffset = (v: string) => Math.max(-30, Math.min(30, Math.round((Number(v) || 0) * 10) / 10));

function Num({ label, unit, value, onChange, hint, integer, signed }: { label: string; unit: string; value: string; onChange: (v: string) => void; hint?: string; integer?: boolean; signed?: boolean }) {
  return (
    <Field label={label} hint={hint}>
      <span className="flex items-center rounded-xl border border-slate-200 bg-white transition focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-100">
        <input type="number" inputMode={integer ? 'numeric' : 'decimal'} step={integer ? '1' : signed ? '0.5' : '0.01'} min={signed ? '-30' : '0'} max={signed ? '30' : undefined} value={value} onChange={(e) => onChange(e.target.value)}
          className="h-11 w-full min-w-0 bg-transparent px-3 text-base tabular-nums text-slate-800 focus:outline-none sm:h-10 sm:text-sm" />
        <span className="shrink-0 whitespace-nowrap pr-3 text-xs text-slate-400">{unit}</span>
      </span>
    </Field>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between py-1.5">
      <dt className="text-slate-500">{label}</dt>
      <dd className="tabular-nums text-slate-800">{money(value)}</dd>
    </div>
  );
}

function Pill({ on, onText, offText }: { on: boolean; onText: string; offText: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${on ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-emerald-500' : 'bg-slate-400'}`} /> {on ? onText : offText}
    </span>
  );
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; sub: string }[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" onClick={() => onChange(o.value)}
            className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${on ? 'border-sky-500 bg-sky-50' : 'border-slate-200 hover:border-slate-300'}`}>
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${on ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-300'}`}>{on && <Check className="h-3 w-3" />}</span>
            <span><span className={`block text-sm font-medium ${on ? 'text-sky-800' : 'text-slate-700'}`}>{o.label}</span><span className="block text-[11px] text-slate-400">{o.sub}</span></span>
          </button>
        );
      })}
    </div>
  );
}

function SaveButton({ dirty, pending, onClick, className = '' }: { dirty: boolean; pending: boolean; onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={!dirty || pending}
      className={`items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none ${className}`}>
      {pending ? 'กำลังบันทึก…' : dirty ? 'บันทึกการตั้งค่า' : 'บันทึกแล้ว'}
    </button>
  );
}

/** ช่องว่างแบบเส้นประ (ยังไม่ได้กรอก) ในตัวอย่างหนังสือ */
function Blank({ w }: { w: string }) {
  return <span className="inline-block border-b border-dotted border-slate-300 align-middle" style={{ width: w }} />;
}

/** ตัวอย่างหนังสือแจ้งค้างชำระ A4 — ย่อส่วน ให้เห็นว่าค่าที่กรอกไปอยู่ตรงไหนของหน้ากระดาษ */
function NoticePreview({ orgName, addressLine, phone, docPrefix, division, signerName, signerTitle, dueDays, signature }: {
  orgName: string; addressLine: string; phone: string; docPrefix: string; division: string;
  signerName: string; signerTitle: string; dueDays: number; signature: string;
}) {
  const unit = ['กิจการประปา', division.trim(), orgName].filter(Boolean).join(' ');
  const title = signerTitle.trim() || (orgName ? `นายก${orgName}` : '');
  const foot = [division.trim(), orgName].filter(Boolean).join(' ');
  return (
    <div className="space-y-2">
      <div className="mx-auto w-full rounded-sm border border-slate-200 bg-white p-4 text-[10px] leading-relaxed text-slate-700 shadow-sm">
        <div className="mb-1 flex justify-center"><span className="h-6 w-5 rounded-t-full bg-slate-200" /></div>
        <div className="flex items-start justify-between gap-2">
          <span>ที่ {docPrefix.trim() || <Blank w="42px" />}/<Blank w="26px" /></span>
          <span className="text-right">
            <span className="block">{orgName || <Blank w="90px" />}</span>
            {addressLine && <span className="block">{addressLine}</span>}
          </span>
        </div>
        <p className="mt-2 text-center">…… เดือน …… ๒๕๖๙</p>
        <p className="mt-2"><span className="inline-block w-10">เรื่อง</span>แจ้งเตือนขอให้ชำระเงินค่าน้ำประปา</p>
        <p><span className="inline-block w-10">เรียน</span>นาย/นาง …………</p>
        <p className="mt-2 indent-6 text-slate-500"><span className="text-slate-800">{unit || <Blank w="120px" />}</span> ขอส่งแจ้งเตือนขอให้ชำระเงินค่าน้ำประปา ของผู้ใช้น้ำเลขที่ …… ยอดค้างชำระ …… บาท</p>
        <p className="mt-1.5 indent-6 text-slate-500">ดังนั้น <span className="text-slate-800">{unit || <Blank w="120px" />}</span> จึงขอแจ้งให้ท่านชำระ … ภายใน <b className="text-slate-800">{dueDays}</b> วัน หากไม่ชำระตามกำหนด <span className="text-slate-800">{orgName}</span>จะทำการ<u>งดส่งน้ำ</u></p>
        <div className="mt-3 pl-[38%]">
          <p>ขอแสดงความนับถือ</p>
          <div className="flex h-9 items-center">{signature ? <img src={signature} alt="" className="max-h-9 object-contain" /> : <span className="text-[9px] text-slate-300">(เว้นช่องลายเซ็น)</span>}</div>
          <p>({signerName.trim() || <Blank w="70px" />})</p>
          <p className="text-center">{title || <Blank w="90px" />}</p>
        </div>
        <div className="mt-3 border-t border-slate-100 pt-1 text-[9px] text-slate-500">
          {foot && <p>{foot}</p>}
          {phone && <p>โทร./โทรสาร {phone}</p>}
        </div>
      </div>
      <p className="text-center text-[11px] text-slate-400">ตัวอย่างย่อ — ของจริงเป็น A4 มีครุฑและข้อความครบตามระเบียบ</p>
    </div>
  );
}

/** บรรทัดข้อความในสลิปตัวอย่าง (คงขึ้นบรรทัดใหม่ตามที่พิมพ์) */
function Line({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return <p className={`whitespace-pre-line ${muted ? 'text-slate-400' : ''}`}>{children}</p>;
}

/** ตัวอย่างหัว/ท้ายใบเสร็จ 58mm — สลับดูใบเสร็จ/ใบแจ้งหนี้ ให้เห็นว่าข้อความแต่ละช่องไปโผล่ตรงไหน */
function SlipPreview({ title, orgName, address, phone, receipt, invoice }: {
  title: string; orgName: string; address: string; phone: string;
  receipt: { header: string; footer: string }; invoice: { header: string; footer: string; days: number };
}) {
  const [kind, setKind] = useState<'receipt' | 'invoice'>('receipt');
  const d = kind === 'receipt' ? receipt : invoice;
  const docTitle = title.trim() || (kind === 'receipt' ? 'ใบเสร็จรับเงินค่าน้ำประปา' : 'ใบแจ้งหนี้ค่าน้ำประปา');
  return (
    <div className="space-y-2">
      <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs">
        {(['receipt', 'invoice'] as const).map((k) => (
          <button key={k} type="button" onClick={() => setKind(k)}
            className={`flex-1 rounded-md py-1.5 font-medium transition ${kind === k ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
            {k === 'receipt' ? 'ใบเสร็จ' : 'ใบแจ้งหนี้'}
          </button>
        ))}
      </div>
      <div className="mx-auto w-full max-w-[240px] rounded-sm border border-slate-200 bg-white px-3 py-3 text-center font-mono text-[11px] leading-snug text-slate-700 shadow-sm">
        <div className="mx-auto mb-1 h-6 w-6 rounded-full bg-slate-200" />
        <p className="font-semibold">{docTitle}</p>
        {kind === 'invoice' && <Line muted>***(ไม่ใช่ใบเสร็จรับเงิน)***</Line>}
        <Line muted>ประจำเดือน ………… </Line>
        <p className="mt-1 font-semibold">{orgName || 'ชื่อหน่วยงาน'}</p>
        {address && <Line>{address}</Line>}
        {phone && <Line>โทร {phone}</Line>}
        {d.header && <Line>{d.header}</Line>}
        <div className="my-1.5 border-t border-dashed border-slate-300" />
        <Line muted>สมาชิก ………… / รายการ / ยอดรวม</Line>
        {kind === 'invoice' && invoice.days > 0 && <Line>กรุณาชำระภายใน {invoice.days} วัน</Line>}
        <div className="my-1.5 border-t border-dashed border-slate-300" />
        {d.footer ? <Line>{d.footer}</Line> : <Line muted>(ข้อความท้ายเอกสาร)</Line>}
      </div>
      <p className="text-center text-[11px] text-slate-400">ตัวอย่างตำแหน่งข้อความ — ของจริงมีครุฑและรายการค่าน้ำครบ</p>
    </div>
  );
}
