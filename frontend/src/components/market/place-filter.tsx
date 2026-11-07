'use client';
import { inputCls } from '@/components/pay/pay-ui';

export type PlaceKind = 'all' | 'stall' | 'outside';
/** แผงลอยใช้รหัสผู้เช่า OUT-xxxx · แผงประจำใช้รหัสแผง เช่น A06 */
export const isOutsideCode = (code?: string | null) => !!code && /^OUT-/i.test(code.trim());
export const placeMatch = (kind: PlaceKind, code?: string | null) => kind === 'all' || (kind === 'outside') === isOutsideCode(code);

const LABEL: Record<PlaceKind, string> = { all: 'ทั้งหมด', stall: 'แผงประจำ', outside: 'แผงลอย' };

/** ตัวเลือกแยกประเภทแผง (ลิสต์) ใช้ร่วมกันในหน้าบิล ค้างชำระ และคิวรอตรวจ */
export function PlaceFilter({ value, onChange }: { value: PlaceKind; onChange: (v: PlaceKind) => void }) {
  return (
    <select aria-label="ประเภทแผง" value={value} onChange={(e) => onChange(e.target.value as PlaceKind)} className={`${inputCls} w-auto!`}>
      {(['all', 'stall', 'outside'] as const).map((k) => <option key={k} value={k}>{k === 'all' ? 'ทุกประเภทแผง' : LABEL[k]}</option>)}
    </select>
  );
}
