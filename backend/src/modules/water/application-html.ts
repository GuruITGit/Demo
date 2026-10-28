import { GARUDA_BW } from './garuda-bw';
import { noticeFontCss } from './notice-fonts';
import { MONTH_TH } from './water.service';

/**
 * เอกสารกองการประปา: แบบคำขอใช้น้ำ + สัญญาการใช้น้ำประปา (A4 แนวตั้ง เรนเดอร์ที่ server)
 * เลียนฟอร์มระบบเก่า (หน้า /request "พิมพ์แบบคำขอใช้น้ำ" / "พิมพ์ใบสัญญา")
 * ถ้อยคำสัญญาเป็นแบบมาตรฐาน อบต. — ปรับให้ตรงต้นฉบับจริงได้ภายหลัง
 */

export type AppDoc = {
  org: { nameTh?: string; type?: string };
  customerCode: string;
  fullName: string;
  address?: string; soi?: string; road?: string; villageNo?: number | null;
  nationalId?: string;
  meterSerial?: string; meterSizeCode?: string;
  app: {
    age?: number | null; idExpiry?: string | null; occupation?: string; workplace?: string;
    purpose?: string; operateAt?: string; nearby?: string;
    pipeSize?: string; faucetSize?: string; faucetCount?: number | null;
    depositAmount?: string | number | null; receiver?: string; applyDate?: string | null;
    contractSigner?: string; witness1?: string; witness2?: string;
  };
};

const esc = (s: any) => String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!));
const money = (n: any) => (n || n === 0 ? Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');

/** ..... ยาว w สำหรับช่องเว้นให้เขียน (ถ้ามีค่าก็แสดงค่า) */
function slot(v: any, w = '120px'): string {
  const t = v === 0 || v ? esc(v) : '';
  return `<span class="slot" style="min-width:${w}">${t}</span>`;
}
function thaiDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${d.getDate()} ${MONTH_TH[d.getMonth() + 1]} ${d.getFullYear() + 543}`;
}
function fullAddr(d: AppDoc): string {
  return [d.address, d.soi && `ซอย${d.soi}`, d.road && `ถนน${d.road}`, d.villageNo && `หมู่ที่ ${d.villageNo}`].filter(Boolean).join(' ');
}
function orgName(d: AppDoc): string {
  return `${d.org.nameTh || d.org.type || ''}`.trim();
}

function shell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="th"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  ${noticeFontCss()}
  @page { size: A4; margin: 18mm 20mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'TH SarabunNew', 'TH SarabunPSK', sans-serif; font-size: 16px; line-height: 1.7; color: #000; }
  .head { text-align: center; }
  .head img { width: 52px; }
  .head .t { font-size: 20px; font-weight: 700; margin-top: 4px; }
  .head .s { font-size: 16px; }
  .slot { display: inline-block; border-bottom: 1px dotted #333; padding: 0 6px; text-align: center; }
  p { margin: 6px 0; text-indent: 0; }
  .row { margin: 5px 0; }
  .sign-area { margin-top: 34px; display: flex; justify-content: space-around; text-align: center; }
  .sign-area .box { width: 45%; }
  .sign-area .line { margin-top: 40px; }
  .witnesses { margin-top: 24px; display: flex; justify-content: space-around; text-align: center; font-size: 15px; }
  .clause { margin: 8px 0; text-indent: 2.5em; text-align: justify; }
  h2.doc { text-align: center; font-size: 19px; font-weight: 700; margin: 6px 0 14px; }
</style></head>
<body>${body}</body></html>`;
}

// ─────────────────────────── แบบคำขอใช้น้ำ
export function buildApplicationHtml(d: AppDoc): string {
  const a = d.app;
  const body = `
  <div class="head">
    <img src="${GARUDA_BW}" alt="ครุฑ" />
    <div class="t">แบบคำขอใช้น้ำประปา</div>
    <div class="s">กองการประปา ${esc(orgName(d))}</div>
  </div>
  <p style="text-align:right">วันที่ ${slot(thaiDate(a.applyDate), '160px')}</p>
  <p>เรียน  นายกองค์การบริหารส่วนตำบล</p>
  <p class="clause">ข้าพเจ้า ${slot(d.fullName, '260px')} อายุ ${slot(a.age, '40px')} ปี
     อาชีพ ${slot(a.occupation, '150px')} เลขประจำตัวประชาชน ${slot(d.nationalId, '180px')}</p>
  <p class="row">ที่อยู่ ${slot(fullAddr(d), '520px')}</p>
  <p class="row">สถานที่ทำงาน ${slot(a.workplace, '430px')}</p>
  <p class="clause">มีความประสงค์ ${slot(a.purpose || 'ขอใช้น้ำประปา', '240px')}
     โดยขอติดตั้ง ณ ${slot(a.operateAt, '230px')} ใกล้กับ ${slot(a.nearby, '200px')}</p>
  <p class="row">ขนาดท่อภายใน ${slot(a.pipeSize, '70px')} นิ้ว  ก๊อกน้ำขนาด ${slot(a.faucetSize, '70px')} นิ้ว
     จำนวน ${slot(a.faucetCount, '60px')} ตัว</p>
  <p class="row">รหัสผู้ใช้น้ำ ${slot(d.customerCode, '90px')}  หมายเลขมาตรวัดน้ำ ${slot(d.meterSerial, '170px')}
     ขนาดมาตร ${slot(d.meterSizeCode, '60px')}</p>
  <p class="clause">ทั้งนี้ ข้าพเจ้ายินยอมปฏิบัติตามระเบียบและเงื่อนไขการใช้น้ำประปาของ${esc(orgName(d))}ทุกประการ
     และยินยอมชำระเงินประกันการใช้มาตรวัดน้ำ จำนวน ${slot(money(a.depositAmount), '110px')} บาท</p>
  <div class="sign-area">
    <div class="box">
      <div class="line">ลงชื่อ ................................................ ผู้ขอใช้น้ำ</div>
      <div>(${esc(d.fullName)})</div>
    </div>
    <div class="box">
      <div class="line">ลงชื่อ ................................................ ผู้รับคำขอ</div>
      <div>(${slot(a.receiver, '160px')})</div>
    </div>
  </div>`;
  return shell('แบบคำขอใช้น้ำประปา', body);
}

// ─────────────────────────── สัญญาการใช้น้ำประปา
export function buildContractHtml(d: AppDoc): string {
  const a = d.app;
  const org = orgName(d);
  const body = `
  <div class="head">
    <img src="${GARUDA_BW}" alt="ครุฑ" />
    <div class="t">สัญญาการใช้น้ำประปา</div>
    <div class="s">กองการประปา ${esc(org)}</div>
  </div>
  <p style="text-align:right">ทำที่ ${esc(org)}</p>
  <p style="text-align:right">วันที่ ${slot(thaiDate(a.applyDate), '160px')}</p>
  <p class="clause">สัญญาฉบับนี้ทำขึ้นระหว่าง ${esc(org)} โดย ${slot(a.contractSigner, '220px')}
     ซึ่งต่อไปในสัญญานี้เรียกว่า "ผู้ให้ใช้น้ำ" ฝ่ายหนึ่ง กับ ${slot(d.fullName, '230px')}
     อายุ ${slot(a.age, '40px')} ปี อยู่บ้านเลขที่ ${slot(fullAddr(d), '320px')}
     ซึ่งต่อไปในสัญญานี้เรียกว่า "ผู้ใช้น้ำ" อีกฝ่ายหนึ่ง ทั้งสองฝ่ายตกลงทำสัญญากันดังต่อไปนี้</p>
  <p class="clause">ข้อ 1. ผู้ให้ใช้น้ำตกลงให้ผู้ใช้น้ำติดตั้งมาตรวัดน้ำหมายเลข ${slot(d.meterSerial, '160px')}
     ขนาด ${slot(d.meterSizeCode, '60px')} ณ ${slot(a.operateAt || fullAddr(d), '260px')}</p>
  <p class="clause">ข้อ 2. ผู้ใช้น้ำตกลงวางเงินประกันการใช้มาตรวัดน้ำไว้กับผู้ให้ใช้น้ำ เป็นเงิน
     ${slot(money(a.depositAmount), '110px')} บาท เพื่อเป็นประกันการชำระค่าน้ำและความเสียหายที่อาจเกิดขึ้น</p>
  <p class="clause">ข้อ 3. ผู้ใช้น้ำตกลงชำระค่าน้ำประปาตามอัตราและกำหนดเวลาที่ผู้ให้ใช้น้ำกำหนด
     หากค้างชำระผู้ให้ใช้น้ำมีสิทธิงดจ่ายน้ำและหักจากเงินประกันได้</p>
  <p class="clause">ข้อ 4. ผู้ใช้น้ำตกลงปฏิบัติตามระเบียบ ข้อบังคับ และประกาศเกี่ยวกับการใช้น้ำประปาของผู้ให้ใช้น้ำทุกประการ</p>
  <p class="clause">สัญญานี้ทำขึ้นสองฉบับ มีข้อความตรงกัน คู่สัญญาได้อ่านและเข้าใจข้อความโดยตลอดแล้ว
     จึงลงลายมือชื่อไว้เป็นสำคัญต่อหน้าพยาน</p>
  <div class="sign-area">
    <div class="box"><div class="line">ลงชื่อ ................................................ ผู้ให้ใช้น้ำ</div><div>(${slot(a.contractSigner, '150px')})</div></div>
    <div class="box"><div class="line">ลงชื่อ ................................................ ผู้ใช้น้ำ</div><div>(${esc(d.fullName)})</div></div>
  </div>
  <div class="witnesses">
    <div class="box">ลงชื่อ ................................ พยาน<div>(${slot(a.witness1, '150px')})</div></div>
    <div class="box">ลงชื่อ ................................ พยาน<div>(${slot(a.witness2, '150px')})</div></div>
  </div>`;
  return shell('สัญญาการใช้น้ำประปา', body);
}
