'use client';
import { Button } from '@/components/ui/button';

export type PlaceKind = 'all' | 'stall' | 'outside';
/** แผงลอยใช้รหัสผู้เช่า OUT-xxxx · แผงประจำใช้รหัสแผง เช่น A06 */
export const isOutsideCode = (code?: string | null) => !!code && /^OUT-/i.test(code.trim());
export const placeMatch = (kind: PlaceKind, code?: string | null) => kind === 'all' || (kind === 'outside') === isOutsideCode(code);

const LABEL: Record<PlaceKind, string> = { all: 'ทั้งหมด', stall: 'แผงประจำ', outside: 'แผงลอย' };

/** ปุ่มแยกประเภทแผง ใช้ร่วมกันในหน้าบิล ค้างชำระ และคิวรอตรวจ */
export function PlaceFilter({ value, onChange }: { value: PlaceKind; onChange: (v: PlaceKind) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {(['all', 'stall', 'outside'] as const).map((k) => (
        <Button key={k} size="sm" variant={value === k ? 'default' : 'outline'} onClick={() => onChange(k)}>{LABEL[k]}</Button>
      ))}
    </div>
  );
}
