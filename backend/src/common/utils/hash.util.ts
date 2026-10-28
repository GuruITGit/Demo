import * as bcrypt from 'bcrypt';
import { createHash, randomInt } from 'crypto';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

export function generateTrackingCode(length = 8): string {
  // ใช้ randomInt (CSPRNG) แทน Math.random เพื่อให้รหัสติดตามคาดเดาไม่ได้
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[randomInt(chars.length)];
  }
  return code;
}

/** สร้างรหัสผ่านชั่วคราวแบบสุ่มปลอดภัย (มีอักษรเล็ก/ใหญ่/ตัวเลข/สัญลักษณ์) */
export function generateTempPassword(length = 12): string {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let pw = '';
  for (let i = 0; i < length; i++) pw += chars[randomInt(chars.length)];
  // รับประกันความหลากหลายของอักขระตามนโยบายรหัสผ่าน
  return pw + 'A9!';
}
