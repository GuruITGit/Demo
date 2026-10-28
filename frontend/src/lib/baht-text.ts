/**
 * แปลงจำนวนเงินเป็นตัวอักษรไทย — สำเนาของ backend/src/common/utils/baht-text.util.ts
 * ใช้แสดงตัวอย่างสดขณะพิมพ์เท่านั้น ค่าที่บันทึกจริงคำนวณที่ server เสมอ
 * (แก้ที่ไหนต้องแก้ทั้งสองที่ ไม่งั้นตัวอย่างกับหนังสือที่ออกจะไม่ตรงกัน)
 */
const DIGITS = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
const PLACES = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];

function readGroup(n: number, hasHigherGroup = false): string {
  let out = '';
  const s = String(n);
  const len = s.length;
  for (let i = 0; i < len; i++) {
    const d = Number(s[i]);
    const place = len - i - 1;
    if (d === 0) continue;
    if (place === 1 && d === 1) out += 'สิบ';
    else if (place === 1 && d === 2) out += 'ยี่สิบ';
    else if (place === 0 && d === 1 && (len > 1 || hasHigherGroup)) out += 'เอ็ด';
    else out += DIGITS[d] + PLACES[place];
  }
  return out;
}

function readInteger(n: number): string {
  if (n === 0) return 'ศูนย์';
  const groups: number[] = [];
  while (n > 0) { groups.push(n % 1000000); n = Math.floor(n / 1000000); }
  let out = '';
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (g === 0) continue;
    out += readGroup(g, i < groups.length - 1);
    if (i > 0) out += 'ล้าน';
  }
  return out;
}

export function bahtText(amount: number): string {
  if (!Number.isFinite(amount)) return '';
  const negative = amount < 0;
  const abs = Math.abs(amount);
  const totalSatang = Math.round(abs * 100 * (1 + Number.EPSILON));
  const baht = Math.floor(totalSatang / 100);
  const satang = totalSatang % 100;

  let out = '';
  if (baht === 0 && satang === 0) out = 'ศูนย์บาทถ้วน';
  else if (satang === 0) out = readInteger(baht) + 'บาทถ้วน';
  else if (baht === 0) out = readGroup(satang) + 'สตางค์';
  else out = readInteger(baht) + 'บาท' + readGroup(satang) + 'สตางค์';

  return (negative ? 'ลบ' : '') + out;
}

export const MONTH_TH: Record<number, string> = {
  1: 'มกราคม', 2: 'กุมภาพันธ์', 3: 'มีนาคม', 4: 'เมษายน', 5: 'พฤษภาคม', 6: 'มิถุนายน',
  7: 'กรกฎาคม', 8: 'สิงหาคม', 9: 'กันยายน', 10: 'ตุลาคม', 11: 'พฤศจิกายน', 12: 'ธันวาคม',
};

/** 2026-07-15 → "15   กรกฎาคม   2569" (เว้นวรรคแบบหนังสือราชการ) */
export function thaiLongDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()}   ${MONTH_TH[d.getMonth() + 1]}   ${d.getFullYear() + 543}`;
}
