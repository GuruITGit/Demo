import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatThaiDate(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  const year = d.getFullYear() + 543;
  const month = d.toLocaleString('th-TH', { month: 'long' });
  const day = d.getDate();
  return `${day} ${month} ${year}`;
}

export function formatThaiDateTime(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  const year = d.getFullYear() + 543;
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hour}:${min}`;
}

/** ชื่อเดือนไทย — index ตามเลขเดือนจริง 1-12 (index 0 ไม่ใช้) */
export const THAI_MONTHS = [
  '', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
] as const;

export const THAI_MONTHS_SHORT = [
  '', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
] as const;

/** ชื่อเดือนไทยจากเลขเดือน 1-12 (คืนเลขเดิมถ้าอยู่นอกช่วง) */
export function thaiMonthName(month: number, short = false): string {
  return (short ? THAI_MONTHS_SHORT : THAI_MONTHS)[month] || String(month);
}

export function formatNumber(n: number | null | undefined): string {
  if (n == null) return '0';
  return n.toLocaleString('th-TH');
}

export function formatCurrency(n: number | null | undefined): string {
  if (n == null) return '0.00';
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export const STATUS_COLORS: Record<string, string> = {
  รอรับ: 'bg-yellow-100 text-yellow-800',
  รับแล้ว: 'bg-blue-100 text-blue-800',
  มอบหมาย: 'bg-indigo-100 text-indigo-800',
  ดำเนินการ: 'bg-orange-100 text-orange-800',
  เสร็จสิ้น: 'bg-green-100 text-green-800',
  ปิด: 'bg-gray-100 text-gray-600',
  ร่าง: 'bg-gray-100 text-gray-600',
  รอการอนุมัติ: 'bg-yellow-100 text-yellow-800',
  อนุมัติแล้ว: 'bg-green-100 text-green-800',
  ไม่อนุมัติ: 'bg-red-100 text-red-800',
  ส่งคืน: 'bg-orange-100 text-orange-800',
  ยกเลิก: 'bg-gray-100 text-gray-500',
  รอรับเรื่อง: 'bg-yellow-100 text-yellow-800',
  กำลังดำเนินการ: 'bg-blue-100 text-blue-800',
  รอข้อมูลเพิ่มเติม: 'bg-orange-100 text-orange-800',
  แก้ไขแล้ว: 'bg-green-100 text-green-800',
  ปฏิบัติงาน: 'bg-green-100 text-green-800',
  ลาออก: 'bg-gray-100 text-gray-600',
  ใช้งาน: 'bg-green-100 text-green-800',
  ชำรุด: 'bg-red-100 text-red-800',
  กำหนดการ: 'bg-blue-100 text-blue-800',
  เริ่มประชุม: 'bg-green-100 text-green-800',
  เสร็จแล้ว: 'bg-gray-100 text-gray-600',
};

export function statusColor(status: string): string {
  return STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600';
}
