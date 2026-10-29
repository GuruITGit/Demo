'use client';
import qrcode from 'qrcode-generator';

/**
 * QR ประจำแผง/ประจำบ้าน (ค่าแผงตลาด · ค่าเก็บขยะบ้าน)
 * ข้อมูลใน QR = ลิงก์หน้าประชาชนพร้อมรหัสแผง / บ้านเลขที่+หมู่ เท่านั้น — ไม่มีชื่อ/ยอดเงิน (ประชาชนยังต้องกรอกชื่อยืนยันเองก่อนเห็นบิล)
 * ลิงก์เป็น ASCII ล้วน ใช้ได้กับแอปกล้องทั่วไป ไม่ต้องสแกนผ่านเว็บ
 */
export type QrItem = { code: string; title: string; sub: string; text: string };

/** ลิงก์ของ QR แผง: /citizen/market?stall=A06 */
export const stallQrUrl = (origin: string, stallCode: string) => `${origin}/citizen/market?stall=${encodeURIComponent(stallCode)}`;
/** ลิงก์ของ QR บ้าน: /citizen/waste?house=18&moo=2 */
export const houseQrUrl = (origin: string, houseNo: string, moo: string) =>
  `${origin}/citizen/waste?house=${encodeURIComponent(houseNo)}&moo=${encodeURIComponent(moo)}`;

function qrModel(text: string) {
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  return q;
}

/** SVG ของ QR (สีดำบนขาว มีขอบขาว 4 โมดูล) */
export function qrSvgString(text: string, label = 'QR'): string {
  const q = qrModel(text);
  const n = q.getModuleCount();
  const m = 4;
  const size = n + m * 2;
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + m},${r + m}h1v1h-1z`;
  const safe = label.replace(/[<>&"]/g, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="${safe}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

export function QrSvg({ text, label, className }: { text: string; label?: string; className?: string }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: qrSvgString(text, label) }} />;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

/** บันทึก QR เป็นรูป PNG พร้อมหัวข้อ (ใช้ติดหน้าแผง/หน้าบ้าน) */
export async function downloadQrPng(item: QrItem, filePrefix: string) {
  const q = qrModel(item.text);
  const n = q.getModuleCount();
  const cell = 10;
  const m = 4;
  const size = (n + m * 2) * cell;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size + 130;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('สร้างรูป QR ไม่สำเร็จ');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) ctx.fillRect((c + m) * cell, (r + m) * cell, cell, cell);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#111';
  ctx.font = 'bold 40px "Noto Sans Thai", Sarabun, sans-serif';
  ctx.fillText(item.title, size / 2, size + 52);
  ctx.fillStyle = '#555';
  ctx.font = '26px "Noto Sans Thai", Sarabun, sans-serif';
  ctx.fillText(item.sub, size / 2, size + 100);
  const blob: Blob | null = await new Promise((ok) => canvas.toBlob((b) => ok(b), 'image/png'));
  if (!blob) throw new Error('สร้างรูป QR ไม่สำเร็จ');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filePrefix}-${item.code.replace(/[^\w]+/g, '-')}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** เปิดหน้าพิมพ์ QR หลายดวง (A4 แถวละ 3) ในหน้าต่างใหม่ — คืน false ถ้าเบราว์เซอร์บล็อกป๊อปอัป */
export function printQrSheet(items: QrItem[], heading: string, orgName: string): boolean {
  const w = window.open('', '_blank');
  if (!w) return false;
  const cards = items
    .map((i) => `<article class="card"><div class="qr">${qrSvgString(i.text, i.title)}</div><b>${esc(i.title)}</b><small>${esc(i.sub)}</small><small class="hint">สแกนเพื่อดูและชำระ${esc(heading)}</small></article>`)
    .join('');
  w.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>QR ${esc(heading)}</title><style>
body{font-family:"Noto Sans Thai",Sarabun,sans-serif;margin:10mm;color:#111}
h1{font-size:16pt;margin:0 0 2mm}p.org{margin:0 0 6mm;color:#555;font-size:11pt}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6mm}
.card{border:1px solid #999;border-radius:3mm;padding:5mm;text-align:center;break-inside:avoid}
.qr svg{width:100%;height:auto;display:block}
b{display:block;font-size:15pt;margin-top:2mm}small{display:block;color:#444;font-size:10pt}small.hint{color:#777;font-size:8.5pt;margin-top:1mm}
@media print{body{margin:6mm}}</style></head><body><h1>QR ${esc(heading)}</h1><p class="org">${esc(orgName)} · ${items.length} ดวง</p><div class="grid">${cards}</div></body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
  return true;
}
