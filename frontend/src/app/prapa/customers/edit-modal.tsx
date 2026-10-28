'use client';
import { useState, type ReactNode } from 'react';
import { Gauge, AlertCircle } from 'lucide-react';
import { Sheet, inputCls, btn } from '../ui';
import { useMasterOptions } from './use-customers';
import type { Customer } from './types';

/** ป้ายกำกับช่องกรอก — ต้องอยู่นอก EditModal เสมอ ไม่งั้น identity เปลี่ยนทุก render (ทุกครั้งที่พิมพ์)
 *  ทำให้ React unmount/remount ทั้งช่อง inputเสียโฟกัสทุกตัวอักษร (นี่คือสาเหตุหลักที่พิมพ์แล้ว "เด้ง") */
function FormLabel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block"><span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>{children}</label>
  );
}

/**
 * ช่องกรอกตัวเลขที่ไม่เด้งขณะพิมพ์ — type="number" ของเบราว์เซอร์คืนค่า "" ทุกครั้งที่เลขยังพิมพ์ไม่ครบ
 * (เช่น "-" ตัวเดียว หรือจุดทศนิยมค้างท้าย) ทำให้ state ตกเป็น null แล้วเด้งกลับ จึงคุมด้วย raw string เอง
 * ไม่อนุญาตเครื่องหมายลบเลย เพราะทุกช่องที่ใช้ component นี้เป็นค่าที่ติดลบไม่ได้อยู่แล้ว
 */
function NumInput({ value, onChange, decimal, min, className, placeholder }: {
  value: number | null; onChange: (v: number | null) => void;
  decimal?: boolean; min?: number; className: string; placeholder?: string;
}) {
  const [raw, setRaw] = useState(value != null ? String(value) : '');
  const pattern = decimal ? /^\d*\.?\d*$/ : /^\d*$/;
  return (
    <input
      type="text" inputMode={decimal ? 'decimal' : 'numeric'} placeholder={placeholder} value={raw}
      onChange={(e) => {
        const v = e.target.value;
        if (!pattern.test(v)) return;
        setRaw(v);
        if (v === '') { onChange(null); return; }
        if (v.endsWith('.')) return; // เลขยังไม่ครบ รอพิมพ์ต่อ
        const n = Number(v);
        if (min === undefined || n >= min) onChange(n);
      }}
      className={className}
    />
  );
}

export function EditModal({ editing, setEditing, save }: { editing: Partial<Customer>; setEditing: (c: Partial<Customer> | null) => void; save: any }) {
  const field = inputCls;
  const set = (patch: Partial<Customer>) => setEditing({ ...editing, ...patch });
  const mStatus = useMasterOptions('usage_status'); const mMeter = useMasterOptions('meter_size'); const mRoute = useMasterOptions('route');
  const mOpts = (list: { code?: string; name: string }[], current?: string | null) => {
    const opts = list.map((m) => ({ v: (m.code || m.name) as string, label: m.name }));
    if (current && !opts.some((o) => o.v === current)) opts.unshift({ v: current, label: `${current} (เดิม)` });
    return opts;
  };
  return (
    <Sheet size="lg" title={editing.id ? 'แก้ไขผู้ใช้น้ำ' : 'เพิ่มผู้ใช้น้ำ'} onClose={() => setEditing(null)}
      footer={
        <div className="flex gap-2">
          <button onClick={() => setEditing(null)} className={btn('secondary')}>ยกเลิก</button>
          <button onClick={() => save.mutate()} disabled={save.isPending || (!!editing.id && !editing.customerCode?.trim()) || !editing.fullName?.trim()}
            className={`${btn('primary')} flex-1`}>บันทึก</button>
        </div>
      }>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <FormLabel label="รหัสผู้ใช้น้ำ">
              {editing.id ? (
                <input value={editing.customerCode || ''} onChange={(e) => set({ customerCode: e.target.value })} className={field} />
              ) : (
                <div className={`${field} flex items-center bg-slate-50 text-sm text-slate-400`}>สร้างอัตโนมัติ</div>
              )}
            </FormLabel>
            <FormLabel label="หมู่ที่"><NumInput value={editing.villageNo ?? null} onChange={(v) => set({ villageNo: v })} min={1} placeholder="10" className={field} /></FormLabel>
            <div className="col-span-2 sm:col-span-1"><FormLabel label="สถานะ"><select value={editing.usageStatus || ''} onChange={(e) => set({ usageStatus: e.target.value })} className={field}>
              <option value="">— ไม่ระบุ —</option>
              {mOpts(mStatus, editing.usageStatus).map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select></FormLabel></div>
          </div>
          <FormLabel label="ชื่อ-สกุล"><input value={editing.fullName || ''} placeholder="นางทองสา คำเกิด" onChange={(e) => set({ fullName: e.target.value })} className={field} /></FormLabel>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormLabel label="เลขบัตรประชาชน"><input value={editing.nationalId || ''} inputMode="numeric" placeholder="1234567890123" onChange={(e) => set({ nationalId: e.target.value })} className={field} /></FormLabel>
            <FormLabel label="เบอร์โทร (ให้สมาชิกเช็คค่าน้ำเองได้)"><input value={editing.phone || ''} inputMode="tel" placeholder="08x-xxxxxxx" onChange={(e) => set({ phone: e.target.value })} className={field} /></FormLabel>
          </div>
          <FormLabel label="ที่อยู่/บ้านเลขที่"><input value={editing.address || ''} placeholder="299 ม.10" onChange={(e) => set({ address: e.target.value })} className={field} /></FormLabel>

          <div className="border-t border-slate-100 pt-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500"><Gauge className="h-3.5 w-3.5" /> มิเตอร์ / การเก็บเงิน</p>
            <div className="grid grid-cols-2 gap-3">
              <FormLabel label="เลขประจำมิเตอร์"><input value={editing.meterSerial || ''} placeholder="66-005-00002:035" onChange={(e) => set({ meterSerial: e.target.value })} className={field} /></FormLabel>
              <FormLabel label="เลขมิเตอร์ล่าสุด"><NumInput value={editing.meterLastReading ?? null} onChange={(v) => set({ meterLastReading: v })} placeholder="1445" className={field} /></FormLabel>
              <FormLabel label="ขนาดมิเตอร์"><select value={editing.meterSizeCode || ''} onChange={(e) => set({ meterSizeCode: e.target.value })} className={field}>
                <option value="">— ไม่ระบุ —</option>
                {mOpts(mMeter, editing.meterSizeCode).map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
              </select></FormLabel>
              <FormLabel label="เส้นทางเก็บเงิน"><select value={editing.collectionRoute || ''} onChange={(e) => set({ collectionRoute: e.target.value })} className={field}>
                <option value="">— ไม่ระบุ —</option>
                {mOpts(mRoute, editing.collectionRoute).map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
              </select></FormLabel>
              <FormLabel label="ลำดับเดินจดมิเตอร์"><NumInput value={editing.walkOrder ?? null} onChange={(v) => set({ walkOrder: v })} min={0} placeholder="เช่น 1, 2, 3..." className={field} /></FormLabel>
              <FormLabel label="ราคาต่อหน่วยเฉพาะราย (บาท)"><NumInput value={editing.unitPrice != null ? Number(editing.unitPrice) : null} onChange={(v) => set({ unitPrice: v })} decimal min={0} placeholder="ว่าง = ใช้เรตกลาง" className={field} /></FormLabel>
            </div>
            <p className="mt-1.5 flex items-start gap-1 text-[11px] text-slate-400"><AlertCircle className="mt-0.5 h-3 w-3 shrink-0" /> เว้นว่าง = คิดตามเรตกลางในหน้าตั้งค่าระบบ · กรอกเฉพาะรายที่ราคาต่าง (เช่น ยังไม่ขึ้นราคา)</p>
          </div>
        </div>
    </Sheet>
  );
}
