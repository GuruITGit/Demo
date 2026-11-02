import { createHmac, timingSafeEqual } from 'crypto';

/** รหัสลับของ QR ประจำบ้าน = HMAC(JWT_SECRET, org+รหัสครัวเรือน) — เดาไม่ได้ ไม่ต้องเก็บในฐานข้อมูล
 *  สแกน QR ที่ติดบ้านแล้วเห็นยอดได้เลยโดยไม่ต้องพิมพ์ชื่อ (ถือ QR = เป็นเจ้าของบ้าน) · เปลี่ยน JWT_SECRET = QR เก่าใช้ไม่ได้ทั้งหมด */
export const houseKey = (orgId: string, ref: string) =>
  createHmac('sha256', process.env.JWT_SECRET || 'dev-jwt-secret').update(`waste-house:${orgId}:${ref.toUpperCase()}`).digest('hex').slice(0, 24);

export const houseKeyOk = (orgId: string, ref: string, key: string) => {
  const a = Buffer.from(houseKey(orgId, ref)), b = Buffer.from(String(key || ''));
  return a.length === b.length && timingSafeEqual(a, b);
};
