import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { houseKey, houseKeyOk } from './house-key';

describe('house-key (รหัสลับ QR ประจำบ้าน)', () => {
  const env = { ...process.env };
  afterEach(() => { process.env = { ...env }; });

  it('คีย์เดิมให้ผลเดิม ยาว 24 ตัว และไม่สนตัวพิมพ์เล็ก/ใหญ่ของรหัสครัวเรือน', () => {
    process.env.JWT_SECRET = 's'.repeat(40);
    expect(houseKey('org1', 'HH-001')).toBe(houseKey('org1', 'hh-001'));
    expect(houseKey('org1', 'HH-001')).toHaveLength(24);
  });
  it('ต่างบ้าน ต่างองค์กร หรือต่าง secret ได้คีย์ไม่เหมือนกัน', () => {
    process.env.JWT_SECRET = 'a'.repeat(40);
    const k = houseKey('org1', 'HH-001');
    expect(houseKey('org1', 'HH-002')).not.toBe(k);
    expect(houseKey('org2', 'HH-001')).not.toBe(k);
    process.env.JWT_SECRET = 'b'.repeat(40);
    expect(houseKey('org1', 'HH-001')).not.toBe(k);
  });
  it('houseKeyOk รับเฉพาะคีย์ถูกต้อง ปฏิเสธว่าง/สั้น/ผิด/ของบ้านอื่น', () => {
    process.env.JWT_SECRET = 'c'.repeat(40);
    const k = houseKey('org1', 'HH-001');
    expect(houseKeyOk('org1', 'HH-001', k)).toBe(true);
    expect(houseKeyOk('org1', 'HH-001', '')).toBe(false);
    expect(houseKeyOk('org1', 'HH-001', k.slice(0, 10))).toBe(false);
    expect(houseKeyOk('org1', 'HH-001', 'x'.repeat(24))).toBe(false);
    expect(houseKeyOk('org1', 'HH-002', k)).toBe(false);
  });
  it('production ไม่มี JWT_SECRET = โยน error ไม่ใช้ค่าเดา', () => {
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = 'production';
    expect(() => houseKey('org1', 'HH-001')).toThrow();
  });
});
