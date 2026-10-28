'use client';
import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';

/**
 * ป้ายสถานะ / ความเร่งด่วน แบบอ่านง่าย (เป็นมิตรกับผู้สูงอายุ)
 * - ตัวอักษรใหญ่กว่าเดิม (text-sm) มีเส้นขอบและจุดสีบอกสถานะชัดเจน
 * - ใช้แทนการเขียน span+className กระจัดกระจายในแต่ละหน้า
 */

type Tone = 'green' | 'blue' | 'yellow' | 'orange' | 'red' | 'gray' | 'indigo' | 'purple';

const TONE_STYLES: Record<Tone, { box: string; dot: string }> = {
  green:  { box: 'bg-green-50 text-green-800 border-green-300',   dot: 'bg-green-500' },
  blue:   { box: 'bg-blue-50 text-blue-800 border-blue-300',      dot: 'bg-blue-500' },
  yellow: { box: 'bg-yellow-50 text-yellow-800 border-yellow-300', dot: 'bg-yellow-500' },
  orange: { box: 'bg-orange-50 text-orange-800 border-orange-300', dot: 'bg-orange-500' },
  red:    { box: 'bg-red-50 text-red-800 border-red-300',         dot: 'bg-red-500' },
  gray:   { box: 'bg-gray-100 text-gray-700 border-gray-300',     dot: 'bg-gray-400' },
  indigo: { box: 'bg-indigo-50 text-indigo-800 border-indigo-300', dot: 'bg-indigo-500' },
  purple: { box: 'bg-purple-50 text-purple-800 border-purple-300', dot: 'bg-purple-500' },
};

// แมปสถานะทั่วทั้งระบบ -> โทนสี
const STATUS_TONE: Record<string, Tone> = {
  // สารบรรณ
  'รอรับ': 'yellow', 'รับแล้ว': 'blue', 'มอบหมาย': 'indigo', 'มอบหมายแล้ว': 'indigo',
  'ดำเนินการ': 'orange', 'เสร็จสิ้น': 'green',
  // สารบรรณ Ticket (Rework 2.0)
  'รอดำเนินการ': 'yellow', 'รอปลัด': 'blue', 'รอนายก': 'purple',
  // อนุมัติ
  'ร่าง': 'gray', 'รออนุมัติ': 'yellow', 'รอการอนุมัติ': 'yellow', 'ระหว่างพิจารณา': 'orange',
  'อนุมัติแล้ว': 'green', 'ไม่อนุมัติ': 'red', 'ส่งคืน': 'orange', 'ตีกลับ': 'orange',
  // ร้องเรียน
  'รับเรื่องแล้ว': 'blue', 'อยู่ระหว่างดำเนินการ': 'orange', 'กำลังดำเนินการ': 'orange',
  'ปิดเรื่อง': 'green', 'รอข้อมูลเพิ่มเติม': 'yellow', 'แก้ไขแล้ว': 'green',
  // ประชุม
  'กำหนดการ': 'blue', 'กำลังประชุม': 'orange', 'เริ่มประชุม': 'orange',
  // ทั่วไป
  'ส่งแล้ว': 'green', 'รอลงนาม': 'yellow', 'ปิด': 'gray', 'ยกเลิก': 'gray',
  'ใช้งาน': 'green', 'ชำรุด': 'red', 'ซ่อมบำรุง': 'orange', 'จำหน่าย': 'gray',
  'ปฏิบัติงาน': 'green', 'ลาออก': 'gray',
  'แผน': 'gray', 'ประกาศ': 'blue', 'ทำสัญญา': 'orange', 'อนุมัติ': 'green',
  // ภาษี
  'รอชำระ': 'yellow', 'ชำระบางส่วน': 'orange', 'ชำระแล้ว': 'green', 'ค้างชำระ': 'red',
};

function statusTone(status?: string): Tone {
  if (!status) return 'gray';
  return STATUS_TONE[status] ?? 'gray';
}

const SIZE = {
  sm: 'px-2 py-0.5 text-xs gap-1',
  md: 'px-2.5 py-1 text-sm gap-1.5',
  lg: 'px-3 py-1.5 text-base gap-2',
};

export function StatusBadge({
  status,
  size = 'md',
  className,
}: {
  status?: string | null;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  if (!status) return <span className="text-gray-400">-</span>;
  const tone = TONE_STYLES[statusTone(status)];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-semibold whitespace-nowrap',
        SIZE[size],
        tone.box,
        className,
      )}
    >
      <span className={cn('rounded-full', size === 'lg' ? 'h-2.5 w-2.5' : 'h-2 w-2', tone.dot)} />
      {status}
    </span>
  );
}

/**
 * ความเร่งด่วน — Rework 2.0 ใช้ 4 ระดับตามมาตรฐานหนังสือราชการ
 *   ปกติ < ด่วน < ด่วนมาก < ด่วนที่สุด  (แสดงสีต่างกันชัดเจน)
 */
const URGENCY_TONE: Record<string, { box: string; urgent: boolean }> = {
  'ปกติ':       { box: 'bg-gray-100 text-gray-600 border-gray-300', urgent: false },
  'ด่วน':       { box: 'bg-yellow-100 text-yellow-800 border-yellow-400', urgent: true },
  'ด่วนมาก':    { box: 'bg-orange-100 text-orange-800 border-orange-400', urgent: true },
  'ด่วนที่สุด': { box: 'bg-red-100 text-red-700 border-red-500', urgent: true },
};

/** คงไว้เพื่อความเข้ากันได้ย้อนหลัง (โค้ดเก่าบางส่วนยังเรียกใช้) */
export function normalizeUrgency(level?: string | null): 'ด่วน' | 'ปกติ' {
  if (!level) return 'ปกติ';
  return level === 'ปกติ' ? 'ปกติ' : 'ด่วน';
}

export function UrgencyBadge({
  level,
  size = 'md',
  className,
}: {
  level?: string | null;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const key = level && URGENCY_TONE[level] ? level : 'ปกติ';
  const tone = URGENCY_TONE[key];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-bold whitespace-nowrap',
        SIZE[size], tone.box, className,
      )}
    >
      {tone.urgent ? (
        <AlertTriangle className={cn(size === 'sm' ? 'h-3 w-3' : 'h-4 w-4')} />
      ) : (
        <span className={cn('rounded-full bg-gray-400', size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5')} />
      )}
      {key}
    </span>
  );
}

/** ตัวเลือกความเร่งด่วนสำหรับฟอร์ม/ตัวกรอง (4 ระดับ) */
export const URGENCY_OPTIONS = ['ปกติ', 'ด่วน', 'ด่วนมาก', 'ด่วนที่สุด'] as const;

/**
 * ชั้นความลับ — ปกติ/ลับ/ลับมาก/ลับที่สุด (แสดงสีเตือนชัดเจน)
 */
const CONFIDENTIALITY_TONE: Record<string, { box: string; secret: boolean }> = {
  'ปกติ':       { box: 'bg-gray-100 text-gray-600 border-gray-300', secret: false },
  'ลับ':         { box: 'bg-blue-100 text-blue-800 border-blue-400', secret: true },
  'ลับมาก':     { box: 'bg-orange-100 text-orange-800 border-orange-400', secret: true },
  'ลับที่สุด':  { box: 'bg-red-100 text-red-700 border-red-500', secret: true },
};

/** ตัวเลือกชั้นความลับสำหรับฟอร์ม/ตัวกรอง */
export const CONFIDENTIALITY_OPTIONS = ['ปกติ', 'ลับ', 'ลับมาก', 'ลับที่สุด'] as const;

/** ตัวเลือกวัตถุประสงค์ของหนังสือ */
export const PURPOSE_OPTIONS = [
  'เพื่อทราบ', 'เพื่อพิจารณา', 'เพื่ออนุมัติ', 'เพื่อดำเนินการ', 'เพื่อประสานงาน', 'เพื่อรายงานผล', 'อื่นๆ',
] as const;

/** หมวดหนังสือ (ทิศทาง) */
export const DOC_CATEGORY_OPTIONS = ['รับ', 'ส่ง', 'ภายใน'] as const;

/** วัตถุประสงค์แบบเต็ม (สำนวนหนังสือราชการ — อิง brmsarabanflow 22 รายการ) */
export const OBJECTIVE_OPTIONS = [
  'เพื่อทราบ', 'เพื่อโปรดทราบ', 'เพื่อโปรดพิจารณา', 'เพื่อโปรดดำเนินการ',
  'เพื่อโปรดทราบและดำเนินการต่อไป', 'เพื่อโปรดพิจารณาอนุมัติ', 'เพื่อโปรดพิจารณาลงนาม',
  'เพื่อโปรดพิจารณาอนุญาต', 'เพื่อโปรดพิจารณาสั่งการ', 'เพื่อให้นำเสนอหรือแจ้งต่อไป',
  'เพื่อถือปฏิบัติโดยทั่วกัน', 'เพื่อปรึกษาหารือ', 'เพื่อซักซ้อมความเข้าใจ', 'เพื่อชี้แจงข้อเท็จจริง',
  'เพื่อทราบและถือปฏิบัติ', 'เพื่อพิจารณาดำเนินการ', 'เพื่อโปรดพิจารณาอนุเคราะห์',
  'เพื่อโปรดพิจารณาประชาสัมพันธ์', 'เพื่อทราบและนำเงินไปชำระ', 'เพื่อโปรดพิจารณาเข้าร่วมประชุม',
  'จึงเรียนมาเพื่อทราบและดำเนินการต่อไป', 'จึงเรียนมาเพื่อดำเนินการต่อไป', 'อื่นๆ',
] as const;

/** ประเภทหนังสือ */
export const DOC_TYPE_OPTIONS = [
  'ทั่วไป', 'ความลับ', 'ร้องเรียน-ร้องทุกข์', 'บันทึกข้อความ', 'ประกาศ', 'คำสั่ง', 'รับรอง',
] as const;

/** Badge ชั้นความลับ — แสดงเฉพาะเมื่อไม่ใช่ "ปกติ" (กันรก) เว้นแต่ระบุ showNormal */
export function ConfidentialityBadge({
  level,
  size = 'md',
  showNormal = false,
  className,
}: {
  level?: string | null;
  size?: keyof typeof SIZE;
  showNormal?: boolean;
  className?: string;
}) {
  const key = level && CONFIDENTIALITY_TONE[level] ? level : 'ปกติ';
  if (key === 'ปกติ' && !showNormal) return null;
  const tone = CONFIDENTIALITY_TONE[key];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-bold whitespace-nowrap',
        SIZE[size], tone.box, className,
      )}
    >
      {tone.secret && <AlertTriangle className={cn(size === 'sm' ? 'h-3 w-3' : 'h-4 w-4')} />}
      {key}
    </span>
  );
}
