import * as QRCode from 'qrcode';

/**
 * สร้าง QR พร้อมเพย์ (มาตรฐาน EMVCo Thai QR Payment) สำหรับจ่ายค่าน้ำ
 * — โครง TLV (tag-length-value) + CRC16-CCITT ตามที่แกะมาจากระบบ vendor
 * รองรับปลายทาง: เบอร์มือถือ / เลขบัตร ปชช.(เลขผู้เสียภาษี) / e-wallet
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

/** เลือก sub-tag ของบัญชีพร้อมเพย์ + จัดรูปเลข (มือถือ → 0066xxxxxxxxx) */
function ppTarget(id: string, type?: string): { tag: string; value: string } {
  const d = (id || '').replace(/\D/g, '');
  if (type === 'ewallet' || d.length >= 15) return { tag: '03', value: d };
  if (type === 'natid' || d.length >= 13) return { tag: '02', value: d };
  const mobile = ('0000000000000' + d.replace(/^0/, '66')).slice(-13);
  return { tag: '01', value: mobile };
}

/** payload string ตามมาตรฐาน EMVCo (นำไป encode เป็น QR) */
export function promptpayPayload(id: string, amount?: number, type?: string): string {
  const t = ppTarget(id, type);
  const acc = tlv('00', 'A000000677010111') + tlv(t.tag, t.value);
  const hasAmount = !!amount && amount > 0;
  let p =
    tlv('00', '01') +
    tlv('01', hasAmount ? '12' : '11') +
    tlv('29', acc) +
    tlv('58', 'TH') +
    tlv('53', '764');
  if (hasAmount) p += tlv('54', amount.toFixed(2));
  p += '6304';
  return p + crc16(p);
}

/** QR พร้อมเพย์เป็น data URL (PNG) — ใส่ใน <img> ได้เลย; คืน null ถ้าไม่มีปลายทาง */
export async function promptpayQrDataUrl(id?: string, amount?: number, type?: string): Promise<string | null> {
  if (!id || !id.replace(/\D/g, '')) return null;
  return QRCode.toDataURL(promptpayPayload(id, amount, type), {
    margin: 1,
    width: 360,
    errorCorrectionLevel: 'M',
  });
}
