import { GARUDA_BW } from './garuda-bw';
import { noticeFontCss } from './notice-fonts';
import { MONTH_TH } from './water.service';

/**
 * รายงานราชการของกองการประปา (เรนเดอร์ PDF ที่ server ให้กระดาษเหมือนกันทุกเครื่อง)
 *  - ป.17  บัญชีลูกหนี้ค่าน้ำประปา (รายลูกหนี้ที่ยังค้างชำระ + แยกประเภทค่า + รวมค้าง)
 *  - ป.32  รายงานเงินรายรับค่าน้ำประปา (เงินรับแยกวัน×ผู้รับเงิน + แยกประเภท)
 * ครุฑใช้ตัวขาว-ดำเดียวกับหนังสือค้างชำระ (garuda-bw) — อย่าสลับกับครุฑแดงของสารบรรณ
 */

export type ReportOrg = { nameTh?: string; type?: string; signatureImage?: string };

const esc = (s: any) => String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!));
const money = (n: any) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num0 = (n: any) => (n ? Number(n).toLocaleString('en-US') : '');
const mMoney = (n: any) => (Number(n || 0) === 0 ? '' : money(n)); // ช่องว่างเมื่อ 0 (อ่านง่ายในตาราง)

/** วันนี้แบบไทยยาว "15 กรกฎาคม 2569" */
function thaiToday(): string {
  const d = new Date();
  return `${d.getDate()} ${MONTH_TH[d.getMonth() + 1]} ${d.getFullYear() + 543}`;
}

/** โครง A4 แนวนอน + ครุฑ + ชื่อหน่วยงาน + หัวเรื่อง + ตาราง + ลายเซ็น */
function page(opts: {
  org: ReportOrg; title: string; formCode: string; periodLine: string;
  table: string; footNote?: string;
}): string {
  const orgName = `กองการประปา ${opts.org.nameTh || opts.org.type || ''}`.trim();
  return `<!DOCTYPE html>
<html lang="th"><head><meta charset="utf-8">
<style>
  ${noticeFontCss()}
  @page { size: A4 landscape; margin: 12mm 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'TH SarabunNew', 'TH SarabunPSK', sans-serif; font-size: 14px; color: #000; }
  .head { text-align: center; }
  .head img { width: 46px; height: auto; }
  .org { font-size: 17px; font-weight: 700; margin-top: 2px; }
  .title { font-size: 18px; font-weight: 700; margin-top: 4px; }
  .form-code { font-size: 13px; color: #333; }
  .period { text-align: center; font-size: 15px; margin: 2px 0 10px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #000; padding: 2px 5px; font-size: 13px; }
  th { background: #f0f0f0; text-align: center; font-weight: 700; }
  td.n { text-align: right; font-variant-numeric: tabular-nums; }
  td.c { text-align: center; }
  tr.total td { font-weight: 700; background: #f7f7f7; }
  .sign { margin-top: 26px; display: flex; justify-content: space-around; text-align: center; font-size: 14px; }
  .sign .box { width: 34%; }
  .sign .line { margin-top: 34px; }
  .foot { margin-top: 6px; font-size: 12px; color: #444; }
</style></head>
<body>
  <div class="head">
    <img src="${GARUDA_BW}" alt="ครุฑ" />
    <div class="org">${esc(orgName)}</div>
    <div class="title">${esc(opts.title)}</div>
    <div class="form-code">(${esc(opts.formCode)})</div>
  </div>
  <div class="period">${esc(opts.periodLine)}</div>
  ${opts.table}
  ${opts.footNote ? `<div class="foot">${opts.footNote}</div>` : ''}
  <div class="sign">
    <div class="box">ผู้จัดทำ${opts.org.signatureImage ? `<img src="${opts.org.signatureImage}" alt="" style="height:1.4cm;object-fit:contain;display:block;margin:0 auto -0.5cm" />` : ''}<div class="line">(...........................................)</div><div>เจ้าหน้าที่การเงินและบัญชี</div></div>
    <div class="box">ผู้ตรวจสอบ<div class="line">(...........................................)</div><div>ผู้อำนวยการกองการประปา</div></div>
  </div>
  <div class="foot" style="text-align:right">พิมพ์เมื่อ ${thaiToday()}</div>
</body></html>`;
}

// ─────────────────────────────── ป.17 บัญชีลูกหนี้ค่าน้ำ
export type ArRow = {
  customerCode: string; fullName: string; villageNo: number | null;
  unpaidCount: number; water: number; service: number; wastewater: number;
  garbage: number; tax: number; outstanding: number; carry?: number; balance?: number;
};
export function buildArLedgerHtml(d: {
  org: ReportOrg; periodLabel: string; mode?: 'period' | 'outstanding'; rows: ArRow[];
  totals: { water: number; service: number; wastewater: number; garbage: number; tax: number;
    outstanding: number; carry?: number; billed?: number; collected?: number; balance?: number };
}): string {
  const t = d.totals;
  let table: string;

  if (d.mode === 'period') {
    // ป.17 บัญชียกยอด: ยอดยกมา + ค้างงวดนี้ + คงค้างยกไป
    const body = d.rows.map((r, i) => `
      <tr>
        <td class="c">${i + 1}</td><td class="c">${esc(r.customerCode)}</td><td>${esc(r.fullName)}</td>
        <td class="c">${r.villageNo ?? ''}</td>
        <td class="n">${mMoney(r.carry)}</td>
        <td class="n">${mMoney(r.outstanding)}</td>
        <td class="n">${money(r.balance ?? r.outstanding)}</td>
      </tr>`).join('');
    table = `<table>
      <thead><tr>
        <th style="width:34px">ลำดับ</th><th style="width:64px">รหัส</th><th>ชื่อ-สกุล</th><th style="width:40px">หมู่</th>
        <th style="width:110px">ยอดยกมา</th><th style="width:110px">ค้างงวดนี้</th><th style="width:120px">คงค้างยกไป</th>
      </tr></thead>
      <tbody>
        ${body || `<tr><td class="c" colspan="7">— ไม่มีลูกหนี้ค้างชำระ —</td></tr>`}
        <tr class="total">
          <td class="c" colspan="4">รวม ${d.rows.length.toLocaleString()} ราย</td>
          <td class="n">${mMoney(t.carry)}</td><td class="n">${mMoney(t.outstanding)}</td><td class="n">${money(t.balance ?? t.outstanding)}</td>
        </tr>
      </tbody>
    </table>`;
  } else {
    const body = d.rows.map((r, i) => `
      <tr>
        <td class="c">${i + 1}</td><td class="c">${esc(r.customerCode)}</td><td>${esc(r.fullName)}</td>
        <td class="c">${r.villageNo ?? ''}</td><td class="c">${r.unpaidCount || ''}</td>
        <td class="n">${mMoney(r.water)}</td><td class="n">${mMoney(r.service)}</td><td class="n">${mMoney(r.wastewater)}</td>
        <td class="n">${mMoney(r.garbage)}</td><td class="n">${mMoney(r.tax)}</td><td class="n">${money(r.outstanding)}</td>
      </tr>`).join('');
    table = `<table>
      <thead><tr>
        <th style="width:34px">ลำดับ</th><th style="width:60px">รหัส</th><th>ชื่อ-สกุล</th>
        <th style="width:38px">หมู่</th><th style="width:52px">งวดค้าง</th>
        <th style="width:78px">ค่าน้ำ</th><th style="width:70px">ค่าบริการ</th><th style="width:70px">ค่าบำบัด</th>
        <th style="width:64px">ค่าขยะ</th><th style="width:60px">ภาษี</th><th style="width:90px">รวมค้างชำระ</th>
      </tr></thead>
      <tbody>
        ${body || `<tr><td class="c" colspan="11">— ไม่มีลูกหนี้ค้างชำระ —</td></tr>`}
        <tr class="total">
          <td class="c" colspan="5">รวม ${d.rows.length.toLocaleString()} ราย</td>
          <td class="n">${mMoney(t.water)}</td><td class="n">${mMoney(t.service)}</td><td class="n">${mMoney(t.wastewater)}</td>
          <td class="n">${mMoney(t.garbage)}</td><td class="n">${mMoney(t.tax)}</td><td class="n">${money(t.outstanding)}</td>
        </tr>
      </tbody>
    </table>`;
  }
  return page({
    org: d.org, title: 'บัญชีลูกหนี้ค่าน้ำประปา', formCode: 'แบบ ป.17',
    periodLine: d.periodLabel, table,
    footNote: d.mode === 'period'
      ? 'หมายเหตุ: ยอดยกมา = ค้างชำระสะสมก่อนงวดนี้ · คงค้างยกไป = ยอดยกมา + ค้างงวดนี้'
      : 'หมายเหตุ: จำนวนเงินเป็นยอดที่ยังค้างชำระ แยกตามประเภทค่าบริการ',
  });
}

// ─────────────────────────────── ป.32 รายงานเงินรายรับ
export type P32Row = {
  date: string; collector: string; count: number;
  water: number; service: number; wastewater: number; garbage: number; tax: number; total: number;
};
export function buildP32Html(d: {
  org: ReportOrg; periodLabel: string; rows: P32Row[];
  totals: { count: number; water: number; service: number; wastewater: number; garbage: number; tax: number; total: number };
}): string {
  const fmtDate = (iso: string) => {
    const dt = new Date(iso);
    return Number.isNaN(dt.getTime()) ? iso : `${dt.getDate()} ${MONTH_TH[dt.getMonth() + 1]} ${dt.getFullYear() + 543}`;
  };
  const body = d.rows.map((r, i) => `
    <tr>
      <td class="c">${i + 1}</td>
      <td class="c">${esc(fmtDate(r.date))}</td>
      <td>${esc(r.collector)}</td>
      <td class="c">${num0(r.count)}</td>
      <td class="n">${mMoney(r.water)}</td>
      <td class="n">${mMoney(r.service)}</td>
      <td class="n">${mMoney(r.wastewater)}</td>
      <td class="n">${mMoney(r.garbage)}</td>
      <td class="n">${mMoney(r.tax)}</td>
      <td class="n">${money(r.total)}</td>
    </tr>`).join('');
  const t = d.totals;
  const table = `<table>
    <thead><tr>
      <th style="width:34px">ลำดับ</th><th style="width:110px">วันที่รับเงิน</th><th>ผู้รับเงิน</th>
      <th style="width:60px">จำนวนราย</th>
      <th style="width:90px">ค่าน้ำ</th><th style="width:78px">ค่าบริการ</th><th style="width:78px">ค่าบำบัด</th>
      <th style="width:70px">ค่าขยะ</th><th style="width:66px">ภาษี</th><th style="width:100px">รวมรับ</th>
    </tr></thead>
    <tbody>
      ${body || `<tr><td class="c" colspan="10">— ไม่มีรายการรับเงินในงวดนี้ —</td></tr>`}
      <tr class="total">
        <td class="c" colspan="3">รวมทั้งสิ้น</td>
        <td class="c">${num0(t.count)}</td>
        <td class="n">${mMoney(t.water)}</td><td class="n">${mMoney(t.service)}</td><td class="n">${mMoney(t.wastewater)}</td>
        <td class="n">${mMoney(t.garbage)}</td><td class="n">${mMoney(t.tax)}</td><td class="n">${money(t.total)}</td>
      </tr>
    </tbody>
  </table>`;
  return page({
    org: d.org, title: 'รายงานเงินรายรับค่าน้ำประปา', formCode: 'แบบ ป.32',
    periodLine: d.periodLabel, table,
  });
}

// ── ป.32 ทะเบียนคุมเงินรายรับ (รายใบเสร็จ) — แต่ละใบเสร็จ 1 บรรทัด ตามฟอร์มราชการ
export type P32RegisterRow = {
  receiptNo?: string; paidAt: string; customerCode: string; fullName: string; villageNo?: number | null;
  water: number; service: number; wastewater: number; garbage: number; tax: number; total: number; collector: string;
};
export function buildP32RegisterHtml(d: {
  org: ReportOrg; periodLabel: string; sortLabel: string; rows: P32RegisterRow[];
  totals: { count: number; water: number; service: number; wastewater: number; garbage: number; tax: number; total: number };
}): string {
  const fmtDate = (iso: string) => {
    const dt = new Date(iso);
    return Number.isNaN(dt.getTime()) ? esc(iso) : `${dt.getDate()}/${dt.getMonth() + 1}/${(dt.getFullYear() + 543) % 100}`;
  };
  const body = d.rows.map((r, i) => `
    <tr>
      <td class="c">${i + 1}</td>
      <td class="c">${esc(r.receiptNo || '-')}</td>
      <td class="c">${fmtDate(r.paidAt)}</td>
      <td class="c">${esc(r.customerCode)}</td>
      <td>${esc(r.fullName)}</td>
      <td class="c">${r.villageNo ?? '-'}</td>
      <td class="n">${mMoney(r.water)}</td>
      <td class="n">${mMoney(r.service)}</td>
      <td class="n">${mMoney(r.wastewater)}</td>
      <td class="n">${mMoney(r.garbage)}</td>
      <td class="n">${mMoney(r.tax)}</td>
      <td class="n">${money(r.total)}</td>
      <td>${esc(r.collector)}</td>
    </tr>`).join('');
  const t = d.totals;
  const table = `<table>
    <thead><tr>
      <th style="width:30px">ลำดับ</th><th style="width:78px">เลขที่ใบเสร็จ</th><th style="width:64px">วันที่</th>
      <th style="width:52px">รหัส</th><th>ชื่อ-สกุล</th><th style="width:34px">หมู่</th>
      <th style="width:66px">ค่าน้ำ</th><th style="width:60px">ค่าบริการ</th><th style="width:58px">ค่าบำบัด</th>
      <th style="width:52px">ค่าขยะ</th><th style="width:50px">ภาษี</th><th style="width:74px">รวม</th><th style="width:120px">ผู้รับเงิน</th>
    </tr></thead>
    <tbody>
      ${body || `<tr><td class="c" colspan="13">— ไม่มีรายการรับเงินในงวดนี้ —</td></tr>`}
      <tr class="total">
        <td class="c" colspan="6">รวมทั้งสิ้น ${num0(t.count)} ฉบับ</td>
        <td class="n">${mMoney(t.water)}</td><td class="n">${mMoney(t.service)}</td><td class="n">${mMoney(t.wastewater)}</td>
        <td class="n">${mMoney(t.garbage)}</td><td class="n">${mMoney(t.tax)}</td><td class="n">${money(t.total)}</td><td></td>
      </tr>
    </tbody>
  </table>`;
  return page({
    org: d.org, title: 'ทะเบียนคุมเงินรายรับค่าน้ำประปา', formCode: 'แบบ ป.32',
    periodLine: `${d.periodLabel} · ${d.sortLabel}`, table,
  });
}

/* ═══════════════════ ป.31 ทะเบียนการอ่านมาตรวัดน้ำ ═══════════════════ */
export type P31Row = {
  customerCode: string; fullName: string; villageNo?: number | null;
  prevReading: number; currReading: number; units: number;
  readAt?: string | null; readerName?: string | null;
};

export function buildP31Html(d: { org: ReportOrg; periodLabel: string; rows: P31Row[]; totalUnits: number }): string {
  const fmtDate = (iso?: string | null) => {
    if (!iso) return '';
    const dt = new Date(iso);
    return Number.isNaN(dt.getTime()) ? '' : `${dt.getDate()} ${MONTH_TH[dt.getMonth() + 1]} ${dt.getFullYear() + 543}`;
  };
  const body = d.rows.map((r, i) => `
    <tr>
      <td class="c">${i + 1}</td>
      <td class="c">${esc(r.customerCode)}</td>
      <td>${esc(r.fullName)}</td>
      <td class="c">${r.villageNo ? esc(r.villageNo) : ''}</td>
      <td class="n">${num0(r.prevReading)}</td>
      <td class="n">${num0(r.currReading)}</td>
      <td class="n">${num0(r.units)}</td>
      <td class="c">${esc(fmtDate(r.readAt))}</td>
      <td>${esc(r.readerName || '')}</td>
    </tr>`).join('');
  const table = `<table>
    <thead><tr>
      <th style="width:34px">ลำดับ</th><th style="width:90px">เลขที่ผู้ใช้น้ำ</th><th>ชื่อผู้ใช้น้ำ</th>
      <th style="width:44px">หมู่</th>
      <th style="width:90px">เลขมาตรครั้งก่อน</th><th style="width:90px">เลขมาตรครั้งนี้</th><th style="width:74px">หน่วยที่ใช้</th>
      <th style="width:104px">วันที่จดมาตร</th><th style="width:150px">ผู้จดมาตร</th>
    </tr></thead>
    <tbody>
      ${body || `<tr><td class="c" colspan="9">— ไม่มีข้อมูลการอ่านมาตรในงวดนี้ —</td></tr>`}
      <tr class="total">
        <td class="c" colspan="6">รวมหน่วยที่ใช้ทั้งสิ้น</td>
        <td class="n">${num0(d.totalUnits)}</td>
        <td colspan="2"></td>
      </tr>
    </tbody>
  </table>`;
  return page({ org: d.org, title: 'ทะเบียนการอ่านมาตรวัดน้ำ', formCode: 'แบบ ป.31', periodLine: d.periodLabel, table });
}

/* ═══════════════════ รายงานภาษีขาย (VAT) ═══════════════════ */
export type VatRow = {
  paidAt: string; receiptNo?: string | null; fullName: string;
  base: number; tax: number; total: number;
};

export function buildVatHtml(d: { org: ReportOrg; periodLabel: string; rows: VatRow[]; totals: { base: number; tax: number; total: number } }): string {
  const fmtDate = (iso: string) => {
    const dt = new Date(iso);
    return Number.isNaN(dt.getTime()) ? iso : `${dt.getDate()} ${MONTH_TH[dt.getMonth() + 1]} ${dt.getFullYear() + 543}`;
  };
  const body = d.rows.map((r, i) => `
    <tr>
      <td class="c">${i + 1}</td>
      <td class="c">${esc(fmtDate(r.paidAt))}</td>
      <td class="c">${esc(r.receiptNo || '')}</td>
      <td>${esc(r.fullName)}</td>
      <td class="n">${money(r.base)}</td>
      <td class="n">${money(r.tax)}</td>
      <td class="n">${money(r.total)}</td>
    </tr>`).join('');
  const t = d.totals;
  const table = `<table>
    <thead><tr>
      <th style="width:34px">ลำดับ</th><th style="width:110px">วัน/เดือน/ปี</th><th style="width:120px">เลขที่ใบเสร็จ</th>
      <th>ชื่อผู้ซื้อสินค้า/บริการ</th>
      <th style="width:120px">มูลค่าก่อนภาษี</th><th style="width:110px">ภาษีมูลค่าเพิ่ม</th><th style="width:120px">รวมเงิน</th>
    </tr></thead>
    <tbody>
      ${body || `<tr><td class="c" colspan="7">— ไม่มีรายการภาษีขายในงวดนี้ —</td></tr>`}
      <tr class="total">
        <td class="c" colspan="4">รวมทั้งสิ้น</td>
        <td class="n">${money(t.base)}</td><td class="n">${money(t.tax)}</td><td class="n">${money(t.total)}</td>
      </tr>
    </tbody>
  </table>`;
  return page({ org: d.org, title: 'รายงานภาษีขาย (ภาษีมูลค่าเพิ่ม)', formCode: 'ภ.พ.30 — ภาษีขาย', periodLine: d.periodLabel, table });
}
