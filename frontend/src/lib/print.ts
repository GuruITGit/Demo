'use client';

export interface PrintColumn {
  label: string;
  key: string;
  align?: 'left' | 'center' | 'right';
  width?: string;
  render?: (row: any) => string;
}

export interface PrintConfig {
  title: string;
  subtitle?: string;
  orgName?: string;
  columns: PrintColumn[];
  rows: any[];
  footer?: string;
  landscape?: boolean;
}

function buildRow(row: any, cols: PrintColumn[]): string {
  return `<tr>${cols
    .map((c) => {
      const val = c.render ? c.render(row) : (row[c.key] ?? '-');
      return `<td style="text-align:${c.align ?? 'left'};padding:5px 8px;border:1px solid #ccc;font-size:12px;">${val}</td>`;
    })
    .join('')}</tr>`;
}

export function printTable(config: PrintConfig) {
  const { title, subtitle, orgName, columns, rows, footer, landscape = false } = config;

  const colHeaders = columns
    .map((c) => `<th style="background:#1e40af;color:#fff;padding:7px 8px;border:1px solid #1e3a8a;font-size:12px;text-align:${c.align ?? 'left'};${c.width ? `width:${c.width}` : ''}">${c.label}</th>`)
    .join('');

  const bodyRows = rows.map((r) => buildRow(r, columns)).join('');

  const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
  @page { size: ${landscape ? 'A4 landscape' : 'A4'}; margin: 1.5cm; }
  body { font-family: 'Sarabun', 'TH Sarabun New', 'Noto Sans Thai', Arial, sans-serif; font-size: 13px; color: #111; margin: 0; }
  .header { text-align: center; margin-bottom: 16px; }
  .header .org { font-size: 14px; font-weight: 700; }
  .header .title { font-size: 16px; font-weight: 700; margin-top: 4px; }
  .header .subtitle { font-size: 12px; color: #555; margin-top: 2px; }
  .print-date { text-align: right; font-size: 11px; color: #666; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; }
  tr:nth-child(even) td { background: #f8fafc; }
  .footer { margin-top: 12px; font-size: 11px; color: #666; border-top: 1px solid #ddd; padding-top: 6px; display: flex; justify-content: space-between; }
  .total-row { font-weight: 700; background: #eff6ff !important; }
</style>
</head>
<body>
<div class="print-date">พิมพ์เมื่อ: ${new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
<div class="header">
  ${orgName ? `<div class="org">${orgName}</div>` : ''}
  <div class="title">${title}</div>
  ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}
</div>
<table>
  <thead><tr>${colHeaders}</tr></thead>
  <tbody>${bodyRows}</tbody>
</table>
<div class="footer">
  <span>${footer ?? ''}</span>
  <span>จำนวนรายการทั้งหมด: ${rows.length} รายการ</span>
</div>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 400);
}

export function printDetail(config: {
  title: string;
  subtitle?: string;
  orgName?: string;
  sections: Array<{
    heading?: string;
    fields: Array<{ label: string; value: string | number | null | undefined; span?: boolean }>;
  }>;
  notes?: string;
}) {
  const { title, subtitle, orgName, sections, notes } = config;

  const sectionsHtml = sections
    .map((s) => {
      const fieldsHtml = s.fields
        .map((f) => {
          const cls = f.span ? 'col-span' : '';
          return `<div class="field ${cls}"><span class="label">${f.label}</span><span class="value">${f.value ?? '-'}</span></div>`;
        })
        .join('');
      return `<div class="section">
        ${s.heading ? `<div class="section-heading">${s.heading}</div>` : ''}
        <div class="fields">${fieldsHtml}</div>
      </div>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
  @page { size: A4; margin: 1.5cm; }
  body { font-family: 'Sarabun', 'TH Sarabun New', 'Noto Sans Thai', Arial, sans-serif; font-size: 13px; color: #111; margin: 0; }
  .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #1e40af; padding-bottom: 12px; }
  .header .org { font-size: 14px; font-weight: 700; }
  .header .title { font-size: 18px; font-weight: 700; margin-top: 4px; color: #1e40af; }
  .header .subtitle { font-size: 12px; color: #555; margin-top: 2px; }
  .print-date { text-align: right; font-size: 11px; color: #666; margin-bottom: 8px; }
  .section { margin-bottom: 16px; }
  .section-heading { font-weight: 700; font-size: 13px; background: #eff6ff; padding: 5px 10px; border-left: 3px solid #1e40af; margin-bottom: 8px; }
  .fields { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; }
  .field { display: flex; gap: 8px; font-size: 12px; padding: 3px 0; border-bottom: 1px solid #f0f0f0; }
  .field.col-span { grid-column: span 2; }
  .label { color: #555; min-width: 130px; flex-shrink: 0; }
  .value { font-weight: 500; }
  .notes { margin-top: 16px; font-size: 12px; color: #555; border-top: 1px dashed #ccc; padding-top: 8px; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 40px; text-align: center; }
  .sig-box { border-top: 1px solid #333; padding-top: 6px; font-size: 12px; }
</style>
</head>
<body>
<div class="print-date">พิมพ์เมื่อ: ${new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
<div class="header">
  ${orgName ? `<div class="org">${orgName}</div>` : ''}
  <div class="title">${title}</div>
  ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}
</div>
${sectionsHtml}
${notes ? `<div class="notes"><strong>หมายเหตุ:</strong> ${notes}</div>` : ''}
<div class="signatures">
  <div class="sig-box"><br/><br/>(................................)<br/>ผู้จัดทำ</div>
  <div class="sig-box"><br/><br/>(................................)<br/>ผู้ตรวจสอบ</div>
  <div class="sig-box"><br/><br/>(................................)<br/>ผู้อนุมัติ</div>
</div>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 400);
}
