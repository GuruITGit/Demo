import * as QRCode from 'qrcode';

/**
 * QR "Bill Payment" มาตรฐาน Thai QR Payment (EMVCo) — Tag 30
 * ต่างจากพร้อมเพย์ (Tag 29) ตรงที่ "มี Ref1/Ref2" → ธนาคารส่งรายการชำระกลับมาพร้อมเลขอ้างอิง
 * ทำให้ระบบ "กระทบยอดอัตโนมัติ" ได้ (จับคู่บิลจาก Ref1/Ref2 แล้วออกใบเสร็จให้เอง)
 *
 * ต้องใช้ Biller ID (Comp Code 15 หลัก) ที่ อบต. ได้จากการสมัคร KTB Bill Payment กับธนาคารกรุงไทย
 * โครงย่อยของ Tag 30:
 *   00 = AID 'A000000677010112' (Bill Payment)
 *   01 = Biller ID (Comp Code)
 *   02 = Ref1 (บังคับ — ใช้รหัสผู้ใช้น้ำ)
 *   03 = Ref2 (ตัวเลือก — ใช้งวด YYYYMM)
 */
function tlv(tag: string, value: string): string {
  return tag + value.length.toString().padStart(2, '0') + value;
}
function crc16(s: string): string {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = (crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** Ref1/Ref2 ตามสเปกต้องเป็นตัวพิมพ์ใหญ่+ตัวเลข (ตัดอักขระอื่น) */
function normRef(v?: string): string {
  return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** payload string ของ QR Bill Payment (นำไป encode เป็น QR) */
export function billPaymentPayload(billerId: string, ref1: string, ref2: string | undefined, amount?: number): string {
  const biller = String(billerId || '').replace(/\D/g, '');
  const r1 = normRef(ref1);
  let merchant = tlv('00', 'A000000677010112') + tlv('01', biller) + tlv('02', r1);
  const r2 = normRef(ref2);
  if (r2) merchant += tlv('03', r2);
  const hasAmount = !!amount && amount > 0;
  let p =
    tlv('00', '01') +
    tlv('01', hasAmount ? '12' : '11') +
    tlv('30', merchant) +
    tlv('58', 'TH') +
    tlv('53', '764');
  if (hasAmount) p += tlv('54', amount.toFixed(2));
  p += '6304';
  return p + crc16(p);
}

/** QR Bill Payment เป็น data URL (PNG) — คืน null ถ้าไม่มี Biller ID หรือ Ref1 */
export async function billPaymentQrDataUrl(
  billerId?: string, ref1?: string, ref2?: string, amount?: number,
): Promise<string | null> {
  const biller = String(billerId || '').replace(/\D/g, '');
  const r1 = normRef(ref1);
  if (!biller || !r1) return null;
  return QRCode.toDataURL(billPaymentPayload(biller, r1, ref2, amount), {
    margin: 1, width: 360, errorCorrectionLevel: 'M',
  });
}
