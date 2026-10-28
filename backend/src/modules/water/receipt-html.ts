import { noticeFontCss } from './notice-fonts';
import * as QRCode from 'qrcode';

const MONTHS = ['', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const money = (n: any) => Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (s: any) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
const pad2 = (n: number) => String(n).padStart(2, '0');
/** วัน/เดือน/ปี(พ.ศ.) เวลา hh:mm น. */
const dateTimeTh = (d: Date) =>
  `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear() + 543} เวลา ${pad2(d.getHours())}:${pad2(d.getMinutes())} น.`;
const dateTh = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth() + 1]} ${d.getFullYear() + 543}`;

export type BillDocKind = 'invoice' | 'receipt';

export interface ReceiptData {
  kind?: BillDocKind; // invoice = ใบแจ้งหนี้ (ตอนจด), receipt = ใบเสร็จรับเงิน (หลังจ่าย)
  org: { nameTh?: string; type?: string; subDistrict?: string; district?: string; province?: string; phone?: string; address?: string; hostnames?: string[] };
  bill: {
    customerCode: string; fullName: string; villageNo?: number; address?: string;
    periodYear: number; periodMonth: number; billNo?: string;
    prevReading: number; currReading: number; units: number;
    unitPrice: string | number; waterAmount: string | number; serviceFee: string | number; totalAmount: string | number;
    garbageFee?: string | number; wastewaterFee?: string | number; tax?: string | number;
    readAt?: Date | string; receiptNo?: string; paidAt?: Date | string; payMethod?: string;
    accessToken?: string | null; // รหัสเข้าถึงสาธารณะ 6 หลัก — ใช้ทำ QR บนใบแจ้งหนี้
  };
  readerName?: string;    // ผู้จดมิเตอร์
  collectorName?: string; // พนักงานเก็บเงิน (ใบเสร็จ)
  headName?: string;      // หัวหน้าหน่วยงาน (ใบเสร็จ)
  docTitle?: string;      // ชื่อเอกสาร (admin ตั้งค่า) — override default
  headerText?: string;    // ข้อความหัวเอกสาร (admin ตั้งค่า)
  footerText?: string;    // ข้อความท้ายเอกสาร (admin ตั้งค่า)
  expiryDays?: number;    // ใบแจ้งหนี้: ชำระภายในกี่วัน (0 = ไม่แสดง)
}

/**
 * ใบแจ้งหนี้/ใบเสร็จค่าน้ำ 58mm (เครื่องพิมพ์ความร้อน / บันทึก PDF) — ฟอนต์ TH Sarabun ฝังในไฟล์
 * รูปแบบอิงฟอร์มจริงของระบบ vendor (สมาชิก/บ้านเลขที่ · เลขมิเตอร์เดิม-ใหม่ · วันที่จด · ค่าน้ำ · ค่าธรรมเนียม · รวม · ลงชื่อ)
 */
export async function buildBillDocHtml(d: ReceiptData): Promise<string> {
  const kind: BillDocKind = d.kind || 'receipt';
  const isReceipt = kind === 'receipt';
  const b = d.bill;
  const o = d.org || {};
  // nameTh เป็นชื่อเต็ม ("องค์การบริหารส่วนตำบล...") อยู่แล้ว จึงไม่ใส่ type ซ้ำ (กัน "อบตองค์การบริหารส่วนตำบล")
  const orgName = `กองการประปา ${o.nameTh || o.type || ''}`.trim();
  // ที่อยู่ที่ตั้งเองในระบบประปา ถ้ามี ไม่งั้นประกอบ ต./อ./จ. จากทะเบียนหน่วยงาน
  const addr = o.address?.trim() || [o.subDistrict && `ต.${o.subDistrict}`, o.district && `อ.${o.district}`, o.province && `จ.${o.province}`]
    .filter(Boolean).join(' ');
  const readAt = b.readAt ? new Date(b.readAt) : null;
  const paidAt = b.paidAt ? new Date(b.paidAt) : new Date();
  const method = b.payMethod === 'qr' ? 'QR/โอน' : b.payMethod === 'transfer' ? 'โอน' : 'เงินสด';
  const title = d.docTitle?.trim() || (isReceipt ? 'ใบเสร็จรับเงินค่าน้ำประปา' : 'ใบแจ้งหนี้ค่าน้ำประปา');

  const row = (l: string, r: string, bold = false) =>
    `<div class="r${bold ? ' b' : ''}"><span>${l}</span><span>${r}</span></div>`;

  // ทั้งใบแจ้งหนี้และใบเสร็จ — QR สแกนแล้วเข้าพอร์ทัลสมาชิกทันที (ไม่ต้องกรอกชื่อ+บ้าน)
  // ใบแจ้งหนี้ (ก่อนจ่าย) = สแกนไปจ่ายได้เลย · ใบเสร็จ (หลังจ่ายแล้ว) = สแกนไปดูยอด/ประวัติย้อนหลังได้ทีหลัง
  // + พิมพ์รหัส 6 หลักเป็นตัวหนังสือด้วย เผื่อไม่สแกน อยากพิมพ์เข้าเว็บเองทีหลัง (รหัสเดียวกับรหัสผู้ใช้น้ำ)
  let portalQr: string | null = null;
  if (b.accessToken && o.hostnames?.length) {
    const url = `https://${o.hostnames[0]}/citizen/water?t=${encodeURIComponent(b.accessToken)}`;
    portalQr = await QRCode.toDataURL(url, { margin: 1, width: 240, errorCorrectionLevel: 'M' });
  }

  return `<!doctype html><html lang="th"><head><meta charset="utf-8">
<style>
${noticeFontCss()}
@page { size: 58mm auto; margin: 0; }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 58mm; font-family: 'TH SarabunNew','TH Sarabun New', sans-serif; color: #000; }
.rc { padding: 3mm 3mm 5mm; font-size: 18px; line-height: 1.35; }
.c { text-align: center; }
.hd { font-size: 20px; font-weight: 700; }
.sm { font-size: 16px; }
.ttl { font-size: 21px; font-weight: 700; margin-top: 2px; }
.hr { border-top: 1px dashed #000; margin: 4px 0; }
.r { display: flex; justify-content: space-between; gap: 6px; }
.r span:last-child { text-align: right; white-space: nowrap; }
.b { font-weight: 700; }
.big { font-size: 24px; font-weight: 700; }
.mt { margin-top: 4px; }
.sign { margin-top: 10px; font-size: 16px; }
.foot { font-size: 14px; margin-top: 6px; }
.qr { width: 30mm; height: 30mm; margin: 2px 0; }
</style></head>
<body><div class="rc">
  <div class="c hd">${esc(orgName)}</div>
  ${addr ? `<div class="c sm">${esc(addr)}</div>` : ''}
  ${o.phone ? `<div class="c sm">โทร ${esc(o.phone)}</div>` : ''}
  ${d.headerText ? `<div class="c sm">${esc(d.headerText).replace(/\n/g, '<br>')}</div>` : ''}
  <div class="hr"></div>
  <div class="c ttl">${title}</div>
  <div class="c sm">ประจำเดือน ${MONTHS[b.periodMonth]} ${b.periodYear}</div>
  ${b.billNo ? `<div class="c sm">เลขที่ ${esc(b.billNo)}</div>` : ''}
  <div class="hr"></div>
  ${row(`สมาชิก ${esc(b.customerCode)}`, b.address ? `บ้านเลขที่ ${esc(b.address)}` : (b.villageNo ? `หมู่ ${b.villageNo}` : ''))}
  <div class="r"><span>${esc(b.fullName)}</span><span></span></div>
  ${addr ? `<div class="sm">${esc(addr)}</div>` : ''}
  <div class="hr"></div>
  ${row('เลขมิเตอร์เดิม', String(b.prevReading))}
  ${row('เลขมิเตอร์ใหม่', String(b.currReading))}
  ${readAt ? `<div class="sm mt">วันที่จด ${dateTimeTh(readAt)}</div>` : ''}
  ${row('จำนวนหน่วย', String(b.units) + ' หน่วย')}
  ${row('ค่าน้ำประปา', money(b.waterAmount))}
  ${row('ค่าธรรมเนียม', money(b.serviceFee))}
  ${Number(b.garbageFee) > 0 ? row('ค่าขยะ', money(b.garbageFee)) : ''}
  ${Number(b.wastewaterFee) > 0 ? row('ค่าบำบัดน้ำเสีย', money(b.wastewaterFee)) : ''}
  ${Number(b.tax) > 0 ? row('ภาษีมูลค่าเพิ่ม', money(b.tax)) : ''}
  <div class="hr"></div>
  <div class="r big"><span>รวมทั้งสิ้น</span><span>${money(b.totalAmount)} บาท</span></div>
  ${!isReceipt && d.expiryDays && readAt ? `<div class="sm mt">กรุณาชำระภายใน ${d.expiryDays} วัน (ครบกำหนด ${dateTh(new Date(readAt.getTime() + d.expiryDays * 86400000))})</div>` : ''}
  ${portalQr ? `<div class="hr"></div>
  <div class="c sm mt">${isReceipt ? 'สแกนเพื่อดูยอด/ประวัติการใช้น้ำออนไลน์' : 'สแกนเพื่อดูยอด/ชำระเงินออนไลน์'}</div>
  <div class="c"><img src="${portalQr}" class="qr" /></div>
  <div class="c sm">รหัส ${esc(b.accessToken)}</div>
  <div class="c foot">หรือพิมพ์รหัสนี้ที่เว็บเช็คค่าน้ำด้วยตัวเอง</div>` : ''}
  ${isReceipt ? `<div class="hr"></div>
  ${row('วันที่ชำระ', dateTh(paidAt))}
  ${row('ชำระโดย', method)}
  ${b.receiptNo ? row('เลขที่ใบเสร็จ', esc(b.receiptNo)) : ''}` : ''}
  <div class="hr"></div>
  ${isReceipt ? `
  <div class="c sign">ลงชื่อ....................................</div>
  <div class="c sm">(${esc(d.headName || '')})</div>
  <div class="c sm">หัวหน้าหน่วยงาน</div>
  <div class="c sign">ลงชื่อ....................................</div>
  <div class="c sm">(${esc(d.collectorName || '')})</div>
  <div class="c sm">พนักงานเก็บเงิน</div>`
  : `
  <div class="c sign">ลงชื่อ....................................ผู้จด</div>
  ${d.readerName ? `<div class="c sm">(${esc(d.readerName)})</div>` : ''}
  <div class="c foot">*ใบแจ้งหนี้ กรุณาชำระเงินตามยอดข้างต้น หากมีข้อสงสัย/มิเตอร์ไม่ตรง แจ้งตามที่อยู่ด้านบน</div>`}
  ${d.footerText ? `<div class="c foot">${esc(d.footerText).replace(/\n/g, '<br>')}</div>` : ''}
  <div class="c foot">ออกโดยระบบ Smart SAO</div>
</div></body></html>`;
}

/** เดิม: ใบเสร็จรับเงิน (คงไว้เพื่อความเข้ากันได้) */
export async function buildReceiptHtml(d: ReceiptData): Promise<string> {
  return buildBillDocHtml({ ...d, kind: 'receipt' });
}
