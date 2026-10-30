'use client';
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Field, Panel, inputCls } from './pay-ui';

export type PayConfig = {
  promptpayId: string; promptpayType: 'mobile' | 'natid' | 'ewallet'; payeeName: string; accountBank: string; accountNo: string;
  cashPlace: string; cashHours: string; wasteStallFee: number; householdFee: number;
};

/**
 * ตั้งค่าบัญชีรับเงิน + ราคากลาง (ใช้ร่วมกันระหว่างหน้าค่าแผงและค่าขยะ — เก็บชุดเดียวต่อ อบต.)
 * ไม่ใส่พร้อมเพย์ = หน้าประชาชนซ่อน QR/แอปธนาคาร เหลือแต่เงินสด
 */
export function PaySettings({ kind, canManage }: { kind: 'market' | 'waste'; canManage: boolean }) {
  const qc = useQueryClient();
  const { data } = useQuery<PayConfig>({ queryKey: ['pay-config'], queryFn: async () => (await api.get(`/${kind}/config`)).data.data });
  const [f, setF] = useState<PayConfig | null>(null);
  useEffect(() => { if (data) setF(data); }, [data]);

  const save = useMutation({
    mutationFn: (body: PayConfig) => api.put(`/${kind}/config`, body),
    onSuccess: () => { toast.success('บันทึกการตั้งค่าแล้ว'); qc.invalidateQueries({ queryKey: ['pay-config'] }); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  if (!f) return <p className="p-6 text-sm text-gray-500">กำลังโหลด…</p>;
  const set = <K extends keyof PayConfig>(k: K, v: PayConfig[K]) => setF({ ...f, [k]: v });
  const dis = !canManage;
  const invalidPp = f.promptpayId !== '' && !/^(\d{10}|\d{13}|\d{15})$/.test(f.promptpayId);

  return (
    <div className="space-y-5">
      <Panel title="ราคา">
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Field label="ค่าเก็บขยะบ้านต่อเดือน (บาท)" hint="ราคากลางทุกครัวเรือน — ตั้งราคาเฉพาะครัวเรือนได้ที่แท็บครัวเรือน">
            <input type="number" min={0} className={inputCls} disabled={dis} value={f.householdFee} onChange={(e) => set('householdFee', Number(e.target.value))} />
          </Field>
          <Field label="ค่าขยะแผงตลาดต่อเดือน (บาท)" hint="ออกคู่กับค่าเช่าแผงทุกเดือน · ค่าเช่าแผงตั้งที่ผังแผง (รายล็อก/รายโซน)">
            <input type="number" min={0} className={inputCls} disabled={dis} value={f.wasteStallFee} onChange={(e) => set('wasteStallFee', Number(e.target.value))} />
          </Field>
        </div>
        <p className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500">ราคาที่เปลี่ยนมีผลกับบิลที่ออกต่อจากนี้ ไม่แก้บิลที่ออกไปแล้ว</p>
      </Panel>

      <Panel title="บัญชีรับเงิน (แสดงให้ประชาชนตอนชำระ)">
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Field label="เลขพร้อมเพย์" hint={invalidPp ? 'ต้องเป็นเบอร์มือถือ 10 หลัก / เลขบัตรประชาชน 13 หลัก / e-Wallet 15 หลัก' : 'เว้นว่าง = ไม่รับโอน แสดงเฉพาะเงินสด'}>
            <input className={`${inputCls} ${invalidPp ? 'border-red-400' : ''}`} inputMode="numeric" disabled={dis} value={f.promptpayId} onChange={(e) => set('promptpayId', e.target.value.replace(/\D/g, ''))} />
          </Field>
          <Field label="ประเภทพร้อมเพย์">
            <select className={inputCls} disabled={dis} value={f.promptpayType} onChange={(e) => set('promptpayType', e.target.value as PayConfig['promptpayType'])}>
              <option value="mobile">เบอร์มือถือ</option>
              <option value="natid">เลขบัตรประชาชน / เลขนิติบุคคล</option>
              <option value="ewallet">e-Wallet</option>
            </select>
          </Field>
          <Field label="ชื่อบัญชี"><input className={inputCls} disabled={dis} value={f.payeeName} onChange={(e) => set('payeeName', e.target.value)} /></Field>
          <Field label="ธนาคาร"><input className={inputCls} disabled={dis} value={f.accountBank} onChange={(e) => set('accountBank', e.target.value)} /></Field>
          <Field label="เลขบัญชี"><input className={inputCls} disabled={dis} value={f.accountNo} onChange={(e) => set('accountNo', e.target.value)} /></Field>
        </div>
      </Panel>

      <Panel title="จ่ายเงินสดที่ อบต.">
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Field label="สถานที่"><input className={inputCls} disabled={dis} value={f.cashPlace} onChange={(e) => set('cashPlace', e.target.value)} /></Field>
          <Field label="วัน-เวลาทำการ"><input className={inputCls} disabled={dis} value={f.cashHours} onChange={(e) => set('cashHours', e.target.value)} /></Field>
        </div>
      </Panel>

      {canManage && (
        <div className="flex justify-end">
          <Button loading={save.isPending} disabled={invalidPp} onClick={() => save.mutate(f)}>บันทึกการตั้งค่า</Button>
        </div>
      )}
    </div>
  );
}
