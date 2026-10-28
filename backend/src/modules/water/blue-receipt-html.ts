import { noticeFontCss } from './notice-fonts';

/**
 * ใบเสร็จรับเงินค่าน้ำ "สีฟ้า" — กระดาษต่อเนื่องที่พิมพ์ฟอร์มมาแล้ว (ใช้ส่ง สตง.)
 * เราพิมพ์เฉพาะข้อความ/ตรา/ลายเซ็นลงช่อง ไม่วาดเส้นฟอร์ม
 *
 * ขนาดหน้า + พิกัดทุกช่องยกมาจากไฟล์ที่ระบบเดิม (Prapa On Mobile แบบ "ใหญ่") ส่งออกจริง เพื่อให้ลงช่องบนกระดาษชุดเดิมของ อบต. ได้ทันที
 * หน้า 377.8 × 289.4 มม. · หน้าละ 3 ใบ (ระยะห่าง 102 มม.) · แต่ละใบ = ต้นขั้ว (ซ้าย) · ตัวจริง (กลาง) · สำเนา (ขวา)
 * พิกัด y = เส้นฐานตัวอักษร (มม. จากขอบบนของใบ) · ฟอนต์ TH SarabunNew 16pt ตัวเดียวกับระบบเดิม
 */
export interface BlueReceipt {
  customerCode: string;
  fullName: string;
  address: string;       // บ้านเลขที่/หมู่ + ต./อ./จ.
  meterSerial?: string | null;
  periodYear: number;    // พ.ศ.
  periodMonth: number;
  prevReading: number;
  currReading: number;
  units: number;
  waterAmount: number;
  serviceFee: number;
  tax: number;
  garbageFee: number;
  wastewaterFee: number;
  total: number;
  amountText: string;    // จำนวนเงินตัวอักษร
  prevReadAt?: Date | string | null;
  currReadAt?: Date | string | null;
  paidAt?: Date | string | null;
}

export interface BlueReceiptDoc {
  orgName: string;
  orgAddress: string;    // ต./อ./จ. บรรทัดใต้ชื่อหน่วยงาน
  receipts: BlueReceipt[];
  sealImage?: string | null;
  signatureImage?: string | null;
  offsetX?: number;      // มม. บวก = เลื่อนไปขวา
  offsetY?: number;      // มม. บวก = เลื่อนลง
}

export const BLUE_PAGE = { width: '377.8mm', height: '289.4mm' };
const SLOT_PITCH = 102;
const PER_PAGE = 3;
/** Chromium วางกล่องข้อความ line-height:0 ให้เส้นฐานต่ำกว่า top 1.06 มม. (วัดจาก PDF ที่ได้จริง) */
const BASELINE = 1.06;

const MONTHS = ['', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const esc = (s: any) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const n2 = (n: number) => Number(n || 0).toFixed(2);
/** ยอดรวม: จำนวนเต็มไม่มีทศนิยม (แบบระบบเดิม "53") มีเศษสตางค์ = 2 ตำแหน่ง */
const totalTxt = (n: number) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2, maximumFractionDigits: 2 });
/** วว/ดด/ปปปป (พ.ศ.) ตามเวลาไทย — เซิร์ฟเวอร์เป็น UTC */
const dmy = (d?: Date | string | null) => {
  if (!d) return '';
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) return '';
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(t);
  const v = (k: string) => p.find((x) => x.type === k)?.value || '';
  return `${v('day')}/${v('month')}/${Number(v('year')) + 543}`;
};

type Cell = [x: number, y: number, text: string, center?: boolean];

function cells(r: BlueReceipt, d: BlueReceiptDoc): Cell[] {
  const period = `${MONTHS[r.periodMonth] || ''}-${String(r.periodYear).slice(-2)}`;
  const fees = `${n2(r.garbageFee)}/${n2(r.wastewaterFee)}`;
  const feeLabel = 'ค่าขยะฯ/ค่าบำบัด';
  const total = totalTxt(r.total);
  return [
    // ── ต้นขั้ว
    [30, 5, r.fullName], [50, 13, r.customerCode], [50, 23, period],
    [35, 40, n2(r.serviceFee)], [75, 40, n2(r.tax)],
    [23, 49, String(r.currReading)], [53, 49, String(r.prevReading)], [80, 49, String(r.units)],
    [65, 58, feeLabel], [70, 67, fees], [25, 67, total],
    // ── ตัวจริง
    [155, 13, period], [233, 13, r.customerCode], [275, 13, r.meterSerial?.trim() || '-'],
    [130, 25, r.fullName], [130, 35, r.address],
    [231.6, 42, feeLabel], [267.2, 42, fees],
    [115, 58, String(r.currReading), true], [143, 58, String(r.prevReading), true], [166, 58, String(r.units), true],
    [194, 58, n2(r.waterAmount), true], [217, 58, n2(r.serviceFee), true], [245, 58, n2(r.tax), true], [273, 58, total, true],
    [115, 68, dmy(r.prevReadAt), true], [142, 68, dmy(r.currReadAt), true],
    [170, 68, r.amountText], [170, 76, d.orgName], [170, 80, d.orgAddress],
    [273, 85, dmy(r.paidAt), true],
    // ── สำเนา
    [355, 13, r.customerCode], [350, 21, period], [330, 37, n2(r.serviceFee)], [377, 37, n2(r.tax)],
    [330, 45, r.fullName], [360, 55, feeLabel], [325, 70, total], [365, 70, fees],
  ];
}

/** รูป [x, y, กว้าง, สูง] (มุมซ้ายบน มม.) */
const SEALS: [number, number, number, number][] = [[85, 0, 20, 20], [295, 0, 20, 20]];
const SIGNS: [number, number, number, number][] = [[55, 70, 20, 10], [117, 68, 20, 10]];

function slotHtml(r: BlueReceipt, d: BlueReceiptDoc, top: number): string {
  const txt = cells(r, d)
    .filter(([, , t]) => t)
    .map(([x, y, t, c]) => `<i${c ? ' class="c"' : ''} style="left:${x}mm;top:${(top + y - BASELINE).toFixed(2)}mm">${esc(t)}</i>`)
    .join('');
  // รูปใช้ class (ฝังข้อมูลรูปครั้งเดียวใน <style>) — ถ้าใส่ <img src=dataURL> ทุกใบ 139 ใบ = HTML หลายสิบ MB จน Chromium ค้าง
  const img = (on: boolean, cls: string, boxes: typeof SEALS) => on
    ? boxes.map(([x, y, w, h]) => `<b class="${cls}" style="left:${x}mm;top:${top + y}mm;width:${w}mm;height:${h}mm"></b>`).join('')
    : '';
  return txt + img(!!cssUrl(d.sealImage), 'seal', SEALS) + img(!!cssUrl(d.signatureImage), 'sign', SIGNS);
}

/** ค่า url() ใน CSS — รับเฉพาะ data:image / http(s) และตัดอักขระที่หลุดออกจากสตริงได้ */
const cssUrl = (src?: string | null) =>
  src && /^(data:image\/|https?:\/\/)/.test(src) ? `url("${src.replace(/["\\\n\r]/g, '')}")` : null;

export function buildBlueReceiptHtml(d: BlueReceiptDoc): string {
  const pages: string[] = [];
  for (let i = 0; i < d.receipts.length; i += PER_PAGE) {
    const slots = d.receipts.slice(i, i + PER_PAGE).map((r, k) => slotHtml(r, d, k * SLOT_PITCH)).join('');
    pages.push(`<section class="pg"><div class="in">${slots}</div></section>`);
  }
  const ox = Number(d.offsetX) || 0;
  const oy = Number(d.offsetY) || 0;
  return `<!doctype html><html lang="th"><head><meta charset="utf-8">
<style>
${noticeFontCss()}
@page { size: ${BLUE_PAGE.width} ${BLUE_PAGE.height}; margin: 0; }
* { margin: 0; padding: 0; }
body { font-family: 'TH SarabunNew', sans-serif; color: #000; }
.pg { position: relative; width: ${BLUE_PAGE.width}; height: ${BLUE_PAGE.height}; overflow: hidden; break-after: page; }
.pg:last-child { break-after: auto; }
.in { position: absolute; inset: 0; transform: translate(${ox}mm, ${oy}mm); }
i { position: absolute; font-size: 16pt; line-height: 0; font-style: normal; white-space: pre; }
i.c { transform: translateX(-50%); }
b { position: absolute; background: center / contain no-repeat; }
${cssUrl(d.sealImage) ? `.seal { background-image: ${cssUrl(d.sealImage)}; }` : ''}
${cssUrl(d.signatureImage) ? `.sign { background-image: ${cssUrl(d.signatureImage)}; }` : ''}
</style></head><body>${pages.join('')}</body></html>`;
}
