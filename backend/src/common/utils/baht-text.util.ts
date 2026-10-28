/**
 * แปลงจำนวนเงินเป็นตัวอักษรไทย ตามแบบที่ใช้ในหนังสือราชการ
 *   101      → "หนึ่งร้อยเอ็ดบาทถ้วน"
 *   1234.50  → "หนึ่งพันสองร้อยสามสิบสี่บาทห้าสิบสตางค์"
 *
 * กติกาที่ต้องระวัง (ผิดแล้วหนังสือราชการเสียหาย):
 *   - หลักสิบ เลข 1 อ่าน "สิบ" ไม่ใช่ "หนึ่งสิบ" · เลข 2 อ่าน "ยี่สิบ" ไม่ใช่ "สองสิบ"
 *   - หลักหน่วยที่เป็น 1 และมีหลักอื่นนำหน้า อ่าน "เอ็ด" (11 = สิบเอ็ด, 101 = หนึ่งร้อยเอ็ด)
 *   - เกินหลักล้าน วนซ้ำด้วยคำว่า "ล้าน" (12,000,000 = สิบสองล้าน)
 *   - ปัดสตางค์เป็น 2 ตำแหน่งก่อนอ่านเสมอ ไม่งั้น 0.005 จะกลายเป็นศูนย์สตางค์
 */
const DIGITS = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
const PLACES = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];

/**
 * อ่านจำนวนเต็มไม่เกิน 6 หลัก (0-999,999)
 * @param hasHigherGroup มีกลุ่มหลักล้านนำหน้าอยู่หรือไม่ — ถ้ามี เลข 1 หลักหน่วยต้องอ่าน "เอ็ด"
 *        (1,000,001 = หนึ่งล้าน**เอ็ด**บาท ไม่ใช่ หนึ่งล้านหนึ่งบาท)
 */
function readGroup(n: number, hasHigherGroup = false): string {
  let out = '';
  const s = String(n);
  const len = s.length;
  for (let i = 0; i < len; i++) {
    const d = Number(s[i]);
    const place = len - i - 1; // 0=หน่วย 1=สิบ 2=ร้อย ...
    if (d === 0) continue;
    if (place === 1 && d === 1) out += 'สิบ';          // สิบ ไม่ใช่ หนึ่งสิบ
    else if (place === 1 && d === 2) out += 'ยี่สิบ';   // ยี่สิบ ไม่ใช่ สองสิบ
    else if (place === 0 && d === 1 && (len > 1 || hasHigherGroup)) out += 'เอ็ด'; // สิบเอ็ด / ร้อยเอ็ด / ล้านเอ็ด
    else out += DIGITS[d] + PLACES[place];
  }
  return out;
}

/** อ่านจำนวนเต็มใดๆ (รองรับหลักล้านขึ้นไปด้วยการวนซ้ำ) */
function readInteger(n: number): string {
  if (n === 0) return 'ศูนย์';
  const groups: number[] = [];
  while (n > 0) {
    groups.push(n % 1000000);
    n = Math.floor(n / 1000000);
  }
  // groups[0] = ล้านชั้นล่างสุด → ประกอบจากชั้นสูงลงมา
  let out = '';
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (g === 0) { if (i > 0) out += ''; continue; }
    out += readGroup(g, i < groups.length - 1);
    if (i > 0) out += 'ล้าน';
  }
  return out;
}

/**
 * @param amount จำนวนเงิน (บาท) — ติดลบจะขึ้นต้นด้วย "ลบ"
 * @returns ข้อความไทย เช่น "หนึ่งร้อยเอ็ดบาทถ้วน"
 */
export function bahtText(amount: number): string {
  if (!Number.isFinite(amount)) return '';
  const negative = amount < 0;
  const abs = Math.abs(amount);

  // ปัดเป็นสตางค์ก่อนแยกส่วน — บวก epsilon ตามสัดส่วนก่อนปัด เพราะ double เก็บ 1.005
  // ได้จริงเป็น 1.00499999... ถ้าปัดตรงๆ จะได้ 1.00 ทั้งที่ทางบัญชีต้องปัดครึ่งขึ้นเป็น 1.01
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
