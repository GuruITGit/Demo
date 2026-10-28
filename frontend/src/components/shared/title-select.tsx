'use client';
import { TITLE_GROUPS } from '@/lib/titles';

/** ตัวเลือกคำนำหน้าชื่อกลาง (ราชการไทย) — ใช้เหมือนกันทุกหน้า จัดกลุ่มด้วย optgroup */
export function TitleSelect({
  value,
  onChange,
  className,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  id?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className ?? 'mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'}
    >
      <option value="">— ไม่ระบุคำนำหน้า —</option>
      {TITLE_GROUPS.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.items.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
