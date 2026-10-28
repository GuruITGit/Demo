import { CalendarDays } from 'lucide-react';

/**
 * แบ่งรายการตามวัน (ใช้ร่วมหน้าสารบรรณ / เรื่องแจ้งร้องเรียน) — รายการต้องเรียงตามเวลาอยู่แล้ว
 * ใช้: `{isNewDay(rows, i, (r) => r.createdAt) && <DayHeader d={...} />}` แล้วโชว์ `timeOf()` ในแถว
 */
export const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export const timeOf = (d: Date) => d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

/** แถวที่ i เป็นแถวแรกของวันใหม่หรือไม่ */
export function isNewDay<T>(rows: T[], i: number, dateOf: (r: T) => string | Date) {
  return i === 0 || dayKey(new Date(dateOf(rows[i - 1]))) !== dayKey(new Date(dateOf(rows[i])));
}

/** หัวกลุ่มวัน — แถบเทาเข้มกว่าแถว + เส้นสีธีมด้านซ้าย ให้เห็นจุดเริ่มของแต่ละวันชัด ๆ */
export function DayHeader({ d }: { d: Date }) {
  const today = new Date();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  const rel = dayKey(d) === dayKey(today) ? 'วันนี้' : dayKey(d) === dayKey(yest) ? 'เมื่อวาน' : '';
  return (
    <div className="flex items-center gap-2.5 border-y border-gray-200 border-l-4 border-l-blue-600 bg-gray-100 px-4 py-2">
      <CalendarDays className="h-4 w-4 text-gray-500" />
      {rel && <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">{rel}</span>}
      <span className="text-sm font-semibold text-gray-900">
        {d.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </span>
    </div>
  );
}
