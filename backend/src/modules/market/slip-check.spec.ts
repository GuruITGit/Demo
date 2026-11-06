import { describe, it, expect, jest, beforeEach } from '@jest/globals';
jest.mock('../water/slip-verify', () => ({ verifySlip: jest.fn() }));
import { verifySlip } from '../water/slip-verify';
import { checkSlip, payeeLike } from './slip-check';
import type { PayConfig } from './pay-config';

const verify = verifySlip as unknown as jest.Mock<(...a: any[]) => Promise<any>>;
const cfg = (o: Partial<PayConfig> = {}) => ({ slipProvider: 'slip2go', slipToken: 'tok', payeeName: 'องค์การบริหารส่วนตำบลลำนางรอง', ...o } as PayConfig);
const slip = (o: any = {}) => ({ ok: true, amount: 100, transRef: 'REF1', receiverName: 'อบต.ลำนางรอง', receiverId: null, ...o });
const buf = Buffer.from('x');

describe('payeeLike (เทียบชื่อผู้รับ)', () => {
  it('ไม่สนคำนำหน้า/ช่องว่าง/เครื่องหมาย', () => {
    expect(payeeLike('องค์การบริหารส่วนตำบลลำนางรอง', 'อบต.ลำนางรอง')).toBe(true);
    expect(payeeLike('นายสมชาย ใจดี', 'สมชาย  ใจดี')).toBe(true);
  });
  it('ชื่อคนละคนไม่ผ่าน และค่าว่างไม่ผ่าน', () => {
    expect(payeeLike('อบต.ลำนางรอง', 'นายสมชาย ใจดี')).toBe(false);
    expect(payeeLike('', 'อบต.ลำนางรอง')).toBe(false);
    expect(payeeLike('อบต.ลำนางรอง', '')).toBe(false);
  });
});

describe('checkSlip (ตรวจสลิปเทียบบิล)', () => {
  beforeEach(() => verify.mockReset());

  it('ยังไม่เปิดตรวจ/ไม่มีโทเคน → ไม่ผ่านและไม่เรียกผู้ให้บริการ', async () => {
    const r = await checkSlip(cfg({ slipToken: '' as any }), buf, 'image/jpeg', 100);
    expect(r.ok).toBe(false);
    expect(verify).not.toHaveBeenCalled();
  });
  it('สลิปจริง ยอดตรง ผู้รับตรง → ผ่านพร้อมเลขอ้างอิง', async () => {
    verify.mockResolvedValue(slip());
    expect(await checkSlip(cfg(), buf, 'image/jpeg', 100)).toEqual({ ok: true, reason: '', transRef: 'REF1' });
  });
  it('ผู้ให้บริการตอบไม่ผ่าน (สลิปปลอม/อ่านไม่ได้) → ไม่ผ่านพร้อมเหตุผล', async () => {
    verify.mockResolvedValue({ ok: false, amount: null, transRef: null, receiverName: null, receiverId: null, error: 'สลิปเสีย' });
    const r = await checkSlip(cfg(), buf, 'image/jpeg', 100);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('สลิปเสีย');
  });
  it('ยอดไม่ตรง (ต่างเกิน 1 สตางค์) → ไม่ผ่าน แต่ต่างไม่เกินสตางค์ผ่าน', async () => {
    verify.mockResolvedValue(slip({ amount: 99 }));
    expect((await checkSlip(cfg(), buf, 'image/jpeg', 100)).ok).toBe(false);
    verify.mockResolvedValue(slip({ amount: 100.004 }));
    expect((await checkSlip(cfg(), buf, 'image/jpeg', 100)).ok).toBe(true);
  });
  it('โอนเข้าบัญชีอื่น → ไม่ผ่าน', async () => {
    verify.mockResolvedValue(slip({ receiverName: 'นายสมชาย ใจดี' }));
    const r = await checkSlip(cfg(), buf, 'image/jpeg', 100);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('บัญชีผู้รับ');
  });
  it('ไม่มีเลขอ้างอิงในสลิป → ไม่ผ่าน (กันตรวจสลิปซ้ำไม่ได้)', async () => {
    verify.mockResolvedValue(slip({ transRef: null }));
    expect((await checkSlip(cfg(), buf, 'image/jpeg', 100)).ok).toBe(false);
  });
});
