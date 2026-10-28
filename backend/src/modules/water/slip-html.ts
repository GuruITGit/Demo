import { GARUDA_BW } from './garuda-bw';
import { noticeFontCss } from './notice-fonts';
import * as QRCode from 'qrcode';

/**
 * HTML ใบเสร็จ/ใบแจ้งหนี้ค่าน้ำ 58mm (กว้าง 384px = 48mm printable) — เรนเดอร์เป็นรูปแล้วส่ง ESC/POS raster ให้ RawBT
 * เลย์เอาต์ตรงตามใบจริงของ อบต.ลำนางรอง (ครุฑ → ชื่อเอกสาร → เดือน → ชื่อ อบต. → ที่อยู่ → รายการ → รวม → ลงชื่อ → หมายเหตุ)
 * เรนเดอร์เป็นรูปทั้งใบ → ภาษาไทย + ครุฑ ออกครบ ไม่ต้องยุ่ง codepage เครื่องพิมพ์
 */

const MONTHS = ['', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const esc = (s: any) => String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!));
const money = (n: any) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function dateTimeTh(d?: Date | string | null): string {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(dt.getDate())}/${p(dt.getMonth() + 1)}/${dt.getFullYear() + 543} ${p(dt.getHours())}:${p(dt.getMinutes())} น.`;
}

/** วันครบกำหนดชำระ = ฐาน(วันจด/วันนี้) + จำนวนวัน → dd/mm/yy(พ.ศ.) */
function dueDateTh(base: Date | string | null | undefined, days: number): string {
  const dt = base ? new Date(base) : new Date();
  dt.setDate(dt.getDate() + days);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(dt.getDate())}/${p(dt.getMonth() + 1)}/${String(dt.getFullYear() + 543).slice(-2)}`;
}

export type SlipData = {
  kind: 'invoice' | 'receipt';
  org: { nameTh?: string; type?: string; subDistrict?: string; district?: string; province?: string; phone?: string; address?: string; hostnames?: string[] };
  docTitle?: string; headerText?: string; footerText?: string;
  expiryDays?: number; // ใบแจ้งหนี้: ชำระภายในกี่วัน (0 = ไม่แสดง)
  bill: {
    customerCode: string; fullName: string; villageNo?: number | null; address?: string | null;
    periodYear: number; periodMonth: number; billNo?: string;
    prevReading: number; currReading: number; units: number;
    waterAmount: string | number; serviceFee: string | number; totalAmount: string | number;
    garbageFee?: string | number; wastewaterFee?: string | number; tax?: string | number;
    readAt?: Date | string | null; paidAt?: Date | string | null;
    accessToken?: string | null; // รหัสเข้าถึงสาธารณะ 6 หลัก — ใช้ทำ QR บนใบที่พิมพ์จริง (เหมือนฝั่ง PDF)
  };
  arrearsMonths?: number; arrearsAmount?: number;
  signerName?: string; // ผู้เก็บ (ใบเสร็จ) / ผู้จด (ใบแจ้งหนี้)
};

export async function buildSlipHtml(d: SlipData): Promise<string> {
  const b = d.bill;
  const isReceipt = d.kind === 'receipt';
  const orgName = d.org.nameTh || d.org.type || 'องค์การบริหารส่วนตำบล';
  const addr = d.org.address?.trim() || [d.org.subDistrict && `ต.${d.org.subDistrict}`, d.org.district && `อ.${d.org.district}`, d.org.province && `จ.${d.org.province}`].filter(Boolean).join(' ');
  const title = d.docTitle?.trim() || (isReceipt ? 'ใบเสร็จรับเงินค่าน้ำประปา' : 'ใบแจ้งหนี้ค่าน้ำประปา');
  const monthLabel = `${MONTHS[b.periodMonth]}-${String(b.periodYear).slice(-2)}`;
  const totalLabel = isReceipt ? 'รวมชำระทั้งสิ้น' : 'ค่าน้ำเดือนนี้ทั้งสิ้น';
  const dateLabel = isReceipt ? 'วันรับเงิน' : 'วันที่จด';
  const dateVal = dateTimeTh(isReceipt ? (b.paidAt || new Date()) : b.readAt);
  const arrearsLabel = isReceipt ? 'ค้างชำระ' : 'ค้างชำระเดือนเก่า';
  const note = isReceipt
    ? 'กรุณาเก็บไว้เป็นหลักฐานว่าท่านได้ชำระเรียบร้อยแล้ว'
    : 'มีปัญหา/ขัดข้อง/สงสัย ให้แจ้งตามที่อยู่ด้านบน';
  const signRole = isReceipt ? 'ผู้เก็บ' : 'ผู้จด';

  const row = (l: string, r: string) => `<div class="r"><span>${esc(l)}</span><span>${esc(r)}</span></div>`;

  // ทั้งใบแจ้งหนี้และใบเสร็จ — QR สแกนแล้วเข้าพอร์ทัลสมาชิกทันที (เหมือนฝั่ง PDF ใน receipt-html.ts)
  // ใบแจ้งหนี้ (ก่อนจ่าย) = สแกนไปจ่ายได้เลย · ใบเสร็จ (หลังจ่ายแล้ว) = สแกนไปดูยอด/ประวัติย้อนหลังได้ทีหลัง
  let portalQr: string | null = null;
  if (b.accessToken && d.org.hostnames?.length) {
    const url = `https://${d.org.hostnames[0]}/citizen/water?t=${encodeURIComponent(b.accessToken)}`;
    portalQr = await QRCode.toDataURL(url, { margin: 1, width: 240, errorCorrectionLevel: 'M' });
  }

  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><style>
${noticeFontCss()}
* { margin:0; padding:0; box-sizing:border-box; }
.slip { width:384px; background:#fff; color:#000; font-family:'TH SarabunNew','TH Sarabun New',sans-serif;
  padding:10px 12px 18px; font-size:28px; line-height:1.28; }
.c { text-align:center; }
.garuda { width:96px; height:auto; display:block; margin:0 auto 2px; }
.title { font-size:33px; font-weight:700; margin-top:2px; }
.sub { font-size:25px; font-weight:700; }
.org { font-size:27px; margin-top:1px; }
.addr { font-size:23px; }
.hr { border-top:2px dashed #000; margin:6px 0; }
.r { display:flex; justify-content:space-between; gap:8px; }
.r span:last-child { text-align:right; white-space:nowrap; }
.total { text-align:center; font-size:36px; font-weight:700; margin:2px 0; }
.sign { font-size:24px; margin-top:6px; }
.note { font-size:23px; margin-top:4px; }
.qr { width:168px; height:168px; margin:4px auto 2px; display:block; }
</style></head>
<body><div class="slip">
  <img class="garuda" src="${GARUDA_BW}" alt="" />
  <div class="c title">${esc(title)}</div>
  ${!isReceipt ? `<div class="c sub">***(ไม่ใช่ใบเสร็จรับเงิน)***</div>` : ''}
  <div class="c">ประจำเดือน ${esc(monthLabel)}</div>
  ${b.billNo ? `<div class="c">เลขที่ ${esc(b.billNo)}</div>` : ''}
  <div class="c org">${esc(orgName)}</div>
  ${addr ? `<div class="c addr">${esc(addr)}</div>` : ''}
  ${d.org.phone ? `<div class="c addr">โทร ${esc(d.org.phone)}</div>` : ''}
  ${d.headerText ? `<div class="c addr">${esc(d.headerText).replace(/\n/g, '<br>')}</div>` : ''}
  <div class="hr"></div>
  <div>สมาชิก ${esc(b.customerCode)}${b.address ? ` บ้านเลขที่ ${esc(b.address)}` : (b.villageNo ? ` หมู่ ${b.villageNo}` : '')}</div>
  <div>${esc(b.fullName)}</div>
  ${addr ? `<div class="addr">${esc(addr)}</div>` : ''}
  <div class="hr"></div>
  ${row('เลขมิเตอร์เดิม', String(b.prevReading))}
  ${row('เลขมิเตอร์ใหม่', String(b.currReading))}
  ${row(dateLabel, dateVal)}
  ${row('จำนวนหน่วย', String(b.units))}
  ${row('ค่าน้ำประปา', money(b.waterAmount))}
  ${row('ค่าธรรมเนียม', money(b.serviceFee))}
  ${Number(b.garbageFee) > 0 ? row('ค่าขยะ', money(b.garbageFee)) : ''}
  ${Number(b.wastewaterFee) > 0 ? row('ค่าบำบัด', money(b.wastewaterFee)) : ''}
  ${Number(b.tax) > 0 ? row('ภาษีมูลค่าเพิ่ม', money(b.tax)) : ''}
  ${row(arrearsLabel, `${d.arrearsMonths || 0} เดือน`)}
  ${row('เป็นเงิน', money(d.arrearsAmount))}
  <div class="hr"></div>
  <div class="total">${totalLabel} ${money(b.totalAmount)} บาท</div>
  ${!isReceipt && d.expiryDays ? `<div class="c note">กรุณาชำระภายใน ${d.expiryDays} วัน (ครบกำหนด ${esc(dueDateTh(b.readAt, d.expiryDays))})</div>` : ''}
  ${portalQr ? `<div class="hr"></div>
  <div class="c note">${isReceipt ? 'สแกนเพื่อดูยอด/ประวัติการใช้น้ำออนไลน์' : 'สแกนเพื่อดูยอด/ชำระเงินออนไลน์'}</div>
  <img class="qr" src="${portalQr}" />
  <div class="c note">รหัส ${esc(b.accessToken)}</div>` : ''}
  <div class="sign">ลงชื่อ.......${esc(d.signerName || '')}.......${signRole}</div>
  <div class="note">หมายเหตุ ${esc(note)}</div>
  ${d.footerText ? `<div class="c note">${esc(d.footerText).replace(/\n/g, '<br>')}</div>` : ''}
</div></body></html>`;
}
