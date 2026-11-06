import { createHmac, timingSafeEqual } from 'crypto';

/** รหัสลับของ QR ประจำบ้าน = HMAC(JWT_SECRET, org+รหัสครัวเรือน) — เดาไม่ได้ ไม่ต้องเก็บในฐานข้อมูล
 *  สแกน QR ที่ติดบ้านแล้วเห็นยอดได้เลยโดยไม่ต้องพิมพ์ชื่อ (ถือ QR = เป็นเจ้าของบ้าน) · เปลี่ยน JWT_SECRET = QR เก่าใช้ไม่ได้ทั้งหมด */
/** production ต้องมี JWT_SECRET จริง — ไม่ถอยไปใช้ค่าเดาได้ (main.ts หยุดบูตอยู่แล้ว ที่นี่กันซ้ำอีกชั้น) */
const secret = () => {
  const v = process.env.JWT_SECRET;
  if (!v && process.env.NODE_ENV === 'production') throw new Error('ต้องตั้ง JWT_SECRET เพื่อสร้างรหัส QR ประจำบ้าน');
  return v || 'dev-jwt-secret';
};
export const houseKey = (orgId: string, ref: string) =>
  createHmac('sha256', secret()).update(`waste-house:${orgId}:${ref.toUpperCase()}`).digest('hex').slice(0, 24);

export const houseKeyOk = (orgId: string, ref: string, key: string) => {
  const a = Buffer.from(houseKey(orgId, ref)), b = Buffer.from(String(key || ''));
  return a.length === b.length && timingSafeEqual(a, b);
};
