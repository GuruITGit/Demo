import { useWaterAuthStore } from '@/stores/water-auth.store';

/** เช็ค capability ประปาต่อโมดูล (admin ผ่านหมด) */
export const useWaterCap = (cap: string) => useWaterAuthStore((s) => s.hasCap(cap));

/** สิทธิ์เขียนงานประปา (จด/รับเงิน/ทะเบียน/ตั้งค่า) — ในหน้าที่ผู้ใช้เข้าถึงได้อยู่แล้ว (sidebar กรองตาม cap) */
export const useCanManage = () =>
  useWaterAuthStore((s) => s.hasCap('reading') || s.hasCap('payment') || s.hasCap('customers') || s.hasCap('settings') || s.hasCap('slips') || s.hasCap('notices'));

/** สิทธิ์ออกหนังสือแจ้งค้างชำระ */
export const useCanNotice = () => useWaterAuthStore((s) => s.hasCap('notices'));
