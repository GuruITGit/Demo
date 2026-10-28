import { GARUDA_BW } from './garuda-bw';
import { noticeFontCss } from './notice-fonts';
import { MONTH_TH } from './water.service';

/**
 * ข้อมูลหน่วยงานบนหนังสือ — มาจากหน้าตั้งค่าระบบประปาของแต่ละ อบต.
 * ไม่มีค่าเริ่มต้นเป็นชื่อ อบต. ใด อบต. หนึ่ง: ช่องไหนไม่ได้ตั้งจะเว้นช่องว่างไว้เขียนมือ
 * หรือประกอบจากชื่อหน่วยงานให้ (เช่น ตำแหน่งผู้ลงนาม = "นายก" + ชื่อหน่วยงาน)
 */
export type NoticeOrg = {
  name?: string;          // ชื่อหน่วยงานเต็ม
  addressLine?: string;   // บรรทัดที่อยู่ใต้ชื่อ (อำเภอ จังหวัด รหัสไปรษณีย์)
  phone?: string;         // โทร./โทรสาร ท้ายหน้า
  docPrefix?: string;     // เลขที่หนังสือ เช่น "บร 85405"
  division?: string;      // กองที่รับผิดชอบ เช่น "กองช่าง"
  signerName?: string;    // ชื่อผู้ลงนามในวงเล็บ
  signerTitle?: string;   // ตำแหน่งใต้ชื่อ
  dueDays?: number;       // ให้ชำระภายในกี่วัน
};

export type NoticeForPdf = {
  org?: NoticeOrg;
  docNumber: number | null;
  docYear: number;
  noticeDate: string;
  fullName: string;
  customerCode: string;
  periodMonth: number;
  periodYear: number;
  amount: string | number;
  amountText: string;
  signatureImage?: string; // รูปลายเซ็นนายก (dataURL/URL) — วางในช่องลงนาม (ว่าง = เว้นว่างให้เซ็นมือ)
};

const money = (n: any) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 2026-07-15 → "15   กรกฎาคม   2569" (เว้นวรรคแบบหนังสือราชการ) */
function thaiLongDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()}   ${MONTH_TH[d.getMonth() + 1]}   ${d.getFullYear() + 543}`;
}

/**
 * หนังสือแจ้งเตือนค้างชำระค่าน้ำ — เรนเดอร์เป็น PDF ที่ server
 * (พิมพ์จากเบราว์เซอร์ตรงๆ แต่ละเครื่องได้ขอบกระดาษ/ขนาด/หัวท้ายไม่เหมือนกัน)
 *
 * ทุกค่าถอดจาก word/document.xml ของไฟล์ต้นฉบับที่ อบต. ส่งมา — ห้ามเดา:
 *
 *   กระดาษ  A4 · ขอบบน 993tw=1.75cm · ซ้าย/ขวา/ล่าง 1440tw=2.54cm
 *   ฟอนต์   TH SarabunIT๙ 16pt (w:sz 32) ทั้งฉบับ · เว้นก่อนย่อหน้า 240tw=12pt
 *   ครุฑ    2.27 × 2.35cm · ลอยที่ 6.96cm จากขอบซ้ายพื้นที่พิมพ์ · ยกขึ้นเหนือย่อหน้า 1.82cm
 *   วันที่   ดันด้วย tab 6 ครั้ง = 7.62cm
 *   ย่อหน้าเนื้อความ 1-2  tab 2 ครั้ง = 2.54cm เฉพาะบรรทัดแรก (ind 0)
 *   ย่อหน้า "อนึ่ง"/"จึงเรียนมา"  ind left=1.27cm firstLine=1.27cm (บรรทัดถัดไปเยื้อง 1.27)
 *   "ขอแสดงความนับถือ"  ind left=6.35cm ชิดซ้าย (ไม่ใช่จัดกึ่งกลาง)
 *   "(ชื่อผู้ลงนาม)"      ind left=5.08 + firstLine=1.27 = 6.35cm
 *   "นายกองค์การฯ"       jc=center (กึ่งกลางพื้นที่พิมพ์)
 *   ท้ายกระดาษ           ชิดซ้าย ขนาด 16pt เท่าเนื้อความ
 *
 *   ตัวหนา: ชื่อเดือน · ทั้งท่อน "ยอดค้างชำระ จำนวนเงิน ... บาท (-...-)"
 *   ตัวหนา+ขีดเส้นใต้: "งดส่งน้ำ โดยไม่แจ้งให้ทราบล่วงหน้า"
 */
const NOTICE_STYLE = `
  ${noticeFontCss()}
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    /* ใช้ฟอนต์ที่ฝังมากับระบบเป็นหลัก — ได้หน้าตาเหมือนกันทุกเครื่อง ไม่ขึ้นกับฟอนต์ที่ติดตั้งไว้ */
    font-family: 'TH SarabunNew', 'TH SarabunIT๙', 'TH SarabunPSK', sans-serif;
    font-size: 16pt;
    line-height: 1.35;
    color: #000;
  }
  .page {
    position: relative;
    width: 210mm; height: 297mm;
    padding: 1.75cm 2.54cm 2.54cm;
    display: flex; flex-direction: column;
    overflow: hidden;
  }
  .page:not(:last-child) { page-break-after: always; }`;

/** เนื้อหนังสือ 1 ฉบับ (div.page) — ใช้ซ้ำทั้งฉบับเดี่ยวและยกล็อต */
function noticePage(n: NoticeForPdf): string {
  const esc = (s: any) => String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!));
  const slot = (v: any, w: string) => (v || v === 0 ? esc(v) : `<span style="display:inline-block;width:${w}"></span>`);
  const o = n.org || {};
  const orgName = o.name?.trim() || '';
  // "กิจการประปา กองช่าง อบต.X" — ไม่ตั้งกองก็ข้ามไป ไม่ต้องเดาให้
  const unit = ['กิจการประปา', o.division?.trim(), orgName].filter(Boolean).join(' ');
  const dueDays = Number.isFinite(Number(o.dueDays)) && Number(o.dueDays) > 0 ? Number(o.dueDays) : 7;
  const signerTitle = o.signerTitle?.trim() || (orgName ? `นายก${orgName}` : '');
  const footUnit = [o.division?.trim(), orgName].filter(Boolean).join(' ');
  return `<div class="page">
  <img class="garuda" src="${GARUDA_BW}" alt="">

  <div class="head">
    <div>ที่ ${slot(o.docPrefix, '2cm')}/${slot(n.docNumber, '2.5cm')}</div>
    <div class="head-addr">
      <div>${slot(orgName, '6cm')}</div>
      ${o.addressLine?.trim() ? `<div>${esc(o.addressLine.trim())}</div>` : ''}
    </div>
  </div>

  <div class="date">${esc(thaiLongDate(n.noticeDate))}</div>

  <div style="margin-top:12pt"><span class="label">เรื่อง</span>แจ้งเตือนขอให้ชำระเงินค่าน้ำประปา</div>
  <div style="margin-top:12pt"><span class="label">เรียน</span>${esc(n.fullName)}</div>

  <p class="p1" style="margin-top:12pt">${esc(unit)}
    ขอส่งแจ้งเตือนขอให้ชำระเงินค่าน้ำประปา ของผู้ใช้น้ำเลขที่ ${esc(n.customerCode)}
    เนื่องจากท่านมียอดค้างชำระค่าน้ำประปา ประจำเดือน <b>${esc(MONTH_TH[n.periodMonth])}</b>  ${esc(n.periodYear)}
    <b>ยอดค้างชำระ จำนวนเงิน ${money(n.amount)} บาท (-${esc(n.amountText)}-)</b></p>

  <p class="p1" style="margin-top:12pt">ดังนั้น ${esc(unit)}
    จึงขอแจ้งให้ท่านชำระค่าน้ำประปาค้างจ่ายในวันและเวลาราชการ ให้ท่านนำเงินมาชำระ ณ ${esc(unit)}
    ภายใน ${dueDays} วัน นับถัดจากวันที่ได้รับหนังสือนี้ หากท่านไม่ชำระตามระยะเวลาที่กำหนด
    ${esc(orgName)}จะทำการ<b><u>งดส่งน้ำ โดยไม่แจ้งให้ทราบล่วงหน้า</u></b>
    หวังว่าจะได้รับความร่วมมือจากท่านด้วยดีเช่นเคย</p>

  <p class="p2" style="margin-top:12pt">อนึ่ง ต้องขออภัยหากท่านได้ชำระเป็นที่เรียบร้อยแล้ว ก่อนที่จะได้รับหนังสือฉบับนี้</p>

  <p class="p2" style="margin-top:12pt">จึงเรียนมาเพื่อทราบและดำเนินการต่อไป</p>

  <div class="sign-1" style="margin-top:12pt">ขอแสดงความนับถือ</div>
  <div class="sign-space">${n.signatureImage ? `<img src="${n.signatureImage}" alt="" style="height:2.6cm;object-fit:contain;display:block;margin-left:5cm" />` : ''}</div>
  <div class="sign-1">(${slot(o.signerName, '5cm')})</div>
  <div class="sign-center">${esc(signerTitle)}</div>

  <div class="foot">
    ${footUnit ? `<div>${esc(footUnit)}</div>` : ''}
    ${o.phone?.trim() ? `<div>โทร./โทรสาร  ${esc(o.phone.trim())}</div>` : ''}
  </div>
</div>`;
}

function noticeDoc(pages: string): string {
  return `<!DOCTYPE html>
<html lang="th"><head><meta charset="utf-8">
<style>${NOTICE_STYLE}
  .garuda {
    position: absolute;
    left: calc(2.54cm + 6.96cm);
    top: 0.2cm;
    width: 2.27cm; height: 2.35cm;
    object-fit: contain;
  }
  .head { position: relative; height: 2.5cm; }
  .head-addr { position: absolute; left: 9.3cm; top: 0; white-space: nowrap; }
  .date { margin-left: 7.62cm; margin-top: 6pt; }
  .label { display: inline-block; width: 1.7cm; }
  .p1 { margin: 0; text-indent: 2.54cm; }
  .p2 { margin: 0; margin-left: 1.27cm; text-indent: 1.27cm; }
  .sign-1 { margin-left: 6.35cm; }
  .sign-space { height: 3cm; flex-shrink: 0; }
  .sign-center { text-align: center; }
  .foot { margin-top: auto; flex-shrink: 0; }
  b { font-weight: 700; }
  u { text-decoration: underline; text-underline-offset: 3px; }
</style></head>
<body>${pages}</body></html>`;
}

/** หนังสือแจ้งเตือนหลายฉบับใน PDF เดียว (ทวงยกล็อต) */
export function buildBulkNoticeHtml(notices: NoticeForPdf[]): string {
  return noticeDoc(notices.map(noticePage).join(''));
}

export function buildNoticeHtml(n: NoticeForPdf): string {
  return noticeDoc(noticePage(n));
}
