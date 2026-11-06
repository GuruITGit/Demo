import { describe, it, expect } from '@jest/globals';
import { prorate, prorateFactor } from './prorate';

describe('prorateFactor (คิดตามวันใช้งาน)', () => {
  it('เริ่มวันที่ 1 หรือก่อนงวด หรือไม่ทราบวัน = เต็ม', () => {
    expect(prorateFactor('2026-11-01', '2569-11')).toBe(1);
    expect(prorateFactor('2026-10-20', '2569-11')).toBe(1);
    expect(prorateFactor(null, '2569-11')).toBe(1);
    expect(prorateFactor('', '2569-11')).toBe(1);
  });
  it('เริ่มกลางเดือน = วันที่เหลือรวมวันเริ่ม ÷ วันในเดือน (พ.ย. มี 30 วัน เริ่ม 16 = 15/30 = ครึ่ง)', () => {
    expect(prorateFactor('2026-11-16', '2569-11')).toBe(0.5);
    expect(prorateFactor('2026-11-30', '2569-11')).toBeCloseTo(1 / 30);
  });
  it('เดือน 31 วัน / กุมภาพันธ์ปีอธิกสุรทิน ใช้จำนวนวันจริง', () => {
    expect(prorateFactor('2026-12-17', '2569-12')).toBeCloseTo(15 / 31);
    expect(prorateFactor('2028-02-15', '2571-02')).toBeCloseTo(15 / 29);
  });
  it('เริ่มหลังงวดนี้ = 0 (ยังไม่ออกบิลงวดนี้)', () => {
    expect(prorateFactor('2026-12-01', '2569-11')).toBe(0);
    expect(prorateFactor('2027-01-05', '2569-11')).toBe(0);
  });
  it('งวดผิดรูปแบบ = เต็ม ไม่ทำให้ออกบิลพัง', () => {
    expect(prorateFactor('2026-11-16', 'bad')).toBe(1);
  });
});

describe('prorate (ปัดสตางค์)', () => {
  it('ครึ่งเดือนของ 1,200 = 600 · 1 บาทครึ่งเดือน = 0.5 · ปัดสตางค์', () => {
    expect(prorate(1200, 0.5)).toBe(600);
    expect(prorate(1, 0.5)).toBe(0.5);
    expect(prorate(900, 15 / 31)).toBe(435.48);
  });
});
