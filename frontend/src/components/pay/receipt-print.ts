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
