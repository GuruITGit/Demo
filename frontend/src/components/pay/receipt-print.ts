import { PAY_METHOD, money } from '@/lib/payment-labels';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

export type ReceiptData = {
  orgName: string;
  receiptNo: string | null;
  payer: string;
  place: string;
  lines: { label: string; amount: string | number }[];
  method: string | null;
  paidAt: string | null;
};

/** พิมพ์ใบเสร็จรับเงิน (หน้าต่างใหม่) — คืน false ถ้าเบราว์เซอร์บล็อกป๊อปอัป · ชื่อ อบต. ดึงจากข้อมูลองค์กร ไม่ฝังในโค้ด */
export function printReceipt(r: ReceiptData): boolean {
  const w = window.open('', '_blank');
  if (!w) return false;
  const total = r.lines.reduce((s, l) => s + Number(l.amount), 0);
  const when = r.paidAt ? new Date(r.paidAt).toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' }) : '';
  w.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>ใบเสร็จ ${esc(r.receiptNo ?? '')}</title><style>
body{font-family:"Noto Sans Thai",Sarabun,sans-serif;max-width:120mm;margin:10mm auto;color:#111}
h1{font-size:15pt;text-align:center;margin:0}h2{font-size:12pt;text-align:center;margin:1mm 0 5mm;font-weight:normal}
.row{display:flex;justify-content:space-between;gap:6mm;font-size:11pt;padding:1.2mm 0}.row.line{border-bottom:1px dotted #aaa}
.total{border-top:1.5px solid #111;margin-top:3mm;padding-top:2mm;font-weight:bold;font-size:13pt}.muted{color:#555}
.sign{margin-top:14mm;text-align:center;font-size:10.5pt}.sign div{border-top:1px solid #111;width:60mm;margin:0 auto;padding-top:1.5mm}
@media print{body{margin:0 auto}}</style></head><body>
<h1>${esc(r.orgName)}</h1><h2>ใบเสร็จรับเงิน</h2>
<div class="row"><span class="muted">เลขที่ใบเสร็จ</span><b>${esc(r.receiptNo ?? '—')}</b></div>
<div class="row"><span class="muted">วันที่รับเงิน</span><span>${esc(when)}</span></div>
<div class="row"><span class="muted">ได้รับเงินจาก</span><span>${esc(r.payer)}</span></div>
<div class="row"><span class="muted">รายการของ</span><span>${esc(r.place)}</span></div>
<div style="margin-top:3mm">${r.lines.map((l) => `<div class="row line"><span>${esc(l.label)}</span><span>${money(l.amount)} บาท</span></div>`).join('')}</div>
<div class="row total"><span>รวมทั้งสิ้น</span><span>${money(total)} บาท</span></div>
<div class="row muted"><span>ชำระโดย</span><span>${esc(r.method ? PAY_METHOD[r.method] ?? r.method : '—')}</span></div>
<div class="sign"><div>เจ้าหน้าที่ผู้รับเงิน</div></div></body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
  return true;
}

export type ReportData = {
  orgName: string;
  title: string;
  /** บรรทัดเงื่อนไข เช่น "งวด: ทุกงวด · ผู้ตรวจ: ทั้งหมด" */
  subtitle?: string;
  columns: { label: string; align?: 'left' | 'right' | 'center' }[];
  rows: (string | number)[][];
  /** แถวสรุปท้ายตาราง เช่น ['', 'รวมทั้งสิ้น', '12,300'] */
  totalRow?: (string | number)[];
  signers?: string[];
};

/** พิมพ์รายงานแบบทางการ (หน้าต่างใหม่ A4): หัวกระดาษชื่อ อบต. · ชื่อรายงาน · วันที่พิมพ์ · ตาราง มีลำดับ · แถวรวม · ช่องลงนาม · เลขหน้า */
export function printReport(r: ReportData): boolean {
  const w = window.open('', '_blank');
  if (!w) return false;
  const now = new Date().toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' });
  const al = (i: number) => r.columns[i]?.align ?? 'left';
  const head = `<th style="width:10mm;text-align:center">ที่</th>${r.columns.map((c) => `<th style="text-align:${c.align ?? 'left'}">${esc(c.label)}</th>`).join('')}`;
  const body = r.rows.map((row, n) => `<tr><td style="text-align:center">${n + 1}</td>${row.map((v, i) => `<td style="text-align:${al(i)}">${esc(String(v))}</td>`).join('')}</tr>`).join('')
    || `<tr><td colspan="${r.columns.length + 1}" style="text-align:center;padding:8mm">ไม่มีรายการ</td></tr>`;
  const foot = r.totalRow ? `<tr class="tot"><td></td>${r.totalRow.map((v, i) => `<td style="text-align:${al(i)}">${esc(String(v))}</td>`).join('')}</tr>` : '';
  const signers = r.signers ?? ['ผู้จัดทำ', 'ผู้ตรวจสอบ', 'ผู้อนุมัติ'];
  w.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${esc(r.title)}</title><style>
@page{size:A4;margin:15mm 12mm 18mm}
body{font-family:"Noto Sans Thai",Sarabun,sans-serif;color:#111;font-size:10.5pt;margin:0}
h1{font-size:15pt;text-align:center;margin:0}h2{font-size:13pt;text-align:center;margin:1mm 0 0}
.sub{text-align:center;font-size:10pt;color:#444;margin:1mm 0}.meta{display:flex;justify-content:space-between;font-size:9.5pt;color:#444;margin:4mm 0 2mm;border-bottom:1.5px solid #111;padding-bottom:1.5mm}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #777;padding:1.4mm 2mm;font-size:9.5pt;vertical-align:top}
th{background:#eee;font-weight:bold}thead{display:table-header-group}tr{page-break-inside:avoid}.tot td{font-weight:bold;background:#f5f5f5}
.signs{display:flex;justify-content:space-around;margin-top:16mm;page-break-inside:avoid}.signs div{text-align:center;width:55mm;font-size:10pt}
.signs i{display:block;border-bottom:1px dotted #111;height:10mm;margin-bottom:1.5mm}</style></head><body>
<h1>${esc(r.orgName)}</h1><h2>${esc(r.title)}</h2>${r.subtitle ? `<div class="sub">${esc(r.subtitle)}</div>` : ''}
<div class="meta"><span>พิมพ์เมื่อ ${esc(now)}</span><span>จำนวน ${r.rows.length} รายการ</span></div>
<table><thead><tr>${head}</tr></thead><tbody>${body}${foot}</tbody></table>
<div class="signs">${signers.map((s) => `<div><i></i>(................................................)<br>${esc(s)}<br>วันที่ ......../......../........</div>`).join('')}</div>
</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
  return true;
}
