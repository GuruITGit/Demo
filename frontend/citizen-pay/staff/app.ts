// หน้าเจ้าหน้าที่ (เดโม่) แยกตามหมวด: ค่าแผงตลาด (data-staff="market") · ค่าขยะบ้าน (data-staff="waste")
// ตรวจสลิป · รับเงินสด · ยอดค้างชำระ · ผังแผง/QR · ออก QR ประจำแผงหรือประจำบ้าน
// ใช้สถานะชุดเดียวกับหน้าประชาชน (localStorage 'market:payments') จึงเห็นรายการที่ประชาชนส่งมาบนเครื่องเดียวกัน
type StaffMode = 'market' | 'waste';
type StaffTab = 'overview' | 'queue' | 'dues' | 'plan' | 'qr';
const STAFF_MODE: StaffMode = document.body.dataset.staff === 'waste' ? 'waste' : 'market';
const STAFF_TITLE = STAFF_MODE === 'waste' ? 'ค่าเก็บขยะบ้าน' : 'ค่าแผงตลาด';
let staffTab: StaffTab = 'overview';
let staffPlanStall: string | null = null;
const staffApp = document.getElementById('app') as HTMLElement;

const inMode = (b: Bill) => STAFF_MODE === 'market' ? b.payerType === 'stall' : b.payerType === 'household';
const staffPlace = (b: Bill) => b.payerType === 'household' ? `บ้านเลขที่ ${b.houseNo} หมู่ ${b.moo}` : b.stall ? `แผง ${b.stall}` : b.location || b.ref;
const staffTime = (at?: string) => at ? new Date(at).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const staffIsOpen = (b: Bill) => inMode(b) && (PAYABLE.includes(b.status) || b.status === 'pending' || b.status === 'cash');

/** กลุ่มรายการที่อยู่ในสถานะเดียวกันของผู้จ่ายคนเดียวกัน = 1 การส่งเข้ามา */
function staffGroups(status: BillStatus) {
  const items = DEMO.bills.filter(b => inMode(b) && b.status === status);
  return [...new Set(items.map(b => b.ref))].map(ref => {
    const bills = items.filter(b => b.ref === ref);
    return { ref, bills, total: bills.reduce((n, b) => n + b.amount, 0), rec: paymentRecordFor(bills[0].id) };
  });
}

/** เปลี่ยนสถานะรายการของผู้จ่ายหนึ่งราย แล้วบันทึกให้หน้าประชาชนเห็นด้วย */
function staffSetRef(ref: string, from: BillStatus, to: 'confirmed' | 'unpaid') {
  const all = loadPaymentRecords();
  const now = new Date().toISOString();
  for (const b of DEMO.bills.filter(x => x.ref === ref && x.status === from)) {
    const old = all[b.id];
    if (to === 'confirmed') all[b.id] = { status: 'confirmed', method: old?.method || 'qr', ref: old?.ref || `STF-${b.id.slice(-6)}`, at: now, amount: b.amount, slipName: old?.slipName };
    else all[b.id] = { status: 'rejected', method: old?.method || 'qr', ref: old?.ref || '', at: now, amount: b.amount };
    b.status = to;
  }
  writePaymentRecords(all);
  toast(to === 'confirmed' ? 'บันทึกการรับเงินแล้ว' : 'ตีกลับ/ยกเลิกรายการแล้ว · ผู้จ่ายเห็นเป็นยังไม่ชำระ');
  render();
}

function setStaffTab(t: StaffTab) { staffTab = t; render(); window.scrollTo({ top: 0 }); }
function pickStaffStall(id: string) { staffPlanStall = staffPlanStall === id ? null : id; render(); }

function staffMetric(label: string, value: string, sub: string, tone = '') {
  return `<div class="staff-metric ${tone}"><small>${label}</small><b>${value}</b><span>${sub}</span></div>`;
}

function overviewHTML() {
  const due = DEMO.bills.filter(staffIsOpen);
  const dueBills = due.filter(b => PAYABLE.includes(b.status));
  const dueTotal = dueBills.reduce((n, b) => n + b.amount, 0);
  const dueCount = new Set(dueBills.map(b => b.ref)).size;
  const pend = staffGroups('pending');
  const cash = staffGroups('cash');
  const paid = DEMO.bills.filter(b => inMode(b) && b.status === 'confirmed').reduce((n, b) => n + b.amount, 0);
  const countStall = (s: StallStatus) => DEMO.stalls.filter(x => x.status === s).length;
  const stallChips = STAFF_MODE === 'market'
    ? `<div class="staff-panel"><div class="staff-panel-head"><b>สถานะผังแผง</b><span>${DEMO.stalls.length} ช่อง</span></div>
      <div class="staff-chips"><span class="staff-chip occupied">เช่า ${countStall('occupied')}</span><span class="staff-chip reserved">จอง ${countStall('reserved')}</span><span class="staff-chip available">ว่าง ${countStall('available')}</span></div></div>`
    : '';
  return `<div class="staff-head"><h1>ภาพรวม${STAFF_TITLE}</h1><p>ข้อมูลตัวอย่าง</p></div>
  <div class="staff-metrics">
    ${staffMetric('ยอดค้างทั้งหมด', `${money(dueTotal)} บาท`, `${dueCount} ราย`)}
    ${staffMetric('รอตรวจสลิป', `${pend.length} รายการ`, `${money(pend.reduce((n, g) => n + g.total, 0))} บาท`, 'tone-warn')}
    ${staffMetric('รอรับเงินสด', `${cash.length} รายการ`, `${money(cash.reduce((n, g) => n + g.total, 0))} บาท`, 'tone-info')}
    ${staffMetric('ชำระแล้ว', `${money(paid)} บาท`, 'ยืนยันแล้ว')}
  </div>
  ${stallChips}
  <button type="button" class="staff-link" onclick="setStaffTab('queue')">ไปตรวจรายการรอดำเนินการ ›</button>`;
}

function queueCard(g: ReturnType<typeof staffGroups>[number], kind: 'pending' | 'cash') {
  const first = g.bills[0];
  const ref = escapeHTML(g.ref);
  const meta = kind === 'pending'
    ? `ส่งเมื่อ ${staffTime(g.rec?.at)} · ${escapeHTML(g.rec?.slipName || 'ไม่มีไฟล์สลิป (ข้อมูลตัวอย่าง)')}`
    : `เลขอ้างอิง ${escapeHTML(g.rec?.ref || '—')} · ${staffTime(g.rec?.at)}`;
  const actions = kind === 'pending'
    ? `<button type="button" class="secondary" onclick="staffSetRef('${ref}','pending','unpaid')">ตีกลับ</button><button type="button" onclick="staffSetRef('${ref}','pending','confirmed')">ยืนยันรับเงิน</button>`
    : `<button type="button" class="secondary" onclick="staffSetRef('${ref}','cash','unpaid')">ยกเลิกเลขอ้างอิง</button><button type="button" onclick="staffSetRef('${ref}','cash','confirmed')">รับเงินแล้ว</button>`;
  return `<article class="staff-card">
    <div class="staff-card-head"><div><b>${escapeHTML(first.merchant)}</b><small>${escapeHTML(staffPlace(first))} · ${ref}</small></div><b class="staff-amount">${money(g.total)} บาท</b></div>
    <ul class="staff-lines">${g.bills.map(b => `<li><span>${escapeHTML(b.month)} · ${escapeHTML(b.kind)}</span><b>${money(b.amount)}</b></li>`).join('')}</ul>
    <small class="staff-meta">${meta}</small>
    <div class="staff-actions">${actions}</div>
  </article>`;
}

function queueHTML() {
  const pend = staffGroups('pending');
  const cash = staffGroups('cash');
  return `<div class="staff-head"><h1>รายการรอดำเนินการ</h1><p>ตรวจสลิปและรับเงินสด แล้วบันทึกให้ผู้จ่ายเห็น</p></div>
  <h2 class="staff-section">สลิปโอนรอตรวจ <span>${pend.length}</span></h2>
  ${pend.length ? pend.map(g => queueCard(g, 'pending')).join('') : '<div class="staff-empty">ไม่มีสลิปรอตรวจ</div>'}
  <h2 class="staff-section">เงินสดรอรับ <span>${cash.length}</span></h2>
  ${cash.length ? cash.map(g => queueCard(g, 'cash')).join('') : '<div class="staff-empty">ไม่มีรายการรอรับเงินสด</div>'}`;
}

function duesHTML() {
  const open = DEMO.bills.filter(staffIsOpen);
  const refs = [...new Set(open.map(b => b.ref))];
  const rows = refs.map(ref => {
    const bills = open.filter(b => b.ref === ref);
    const due = bills.filter(b => PAYABLE.includes(b.status)).reduce((n, b) => n + b.amount, 0);
    const months = [...new Set(bills.map(b => b.month))];
    const pending = bills.some(b => b.status === 'pending' || b.status === 'cash');
    return { ref, first: bills[0], due, months, pending };
  }).sort((a, b) => b.due - a.due);
  const total = rows.reduce((n, r) => n + r.due, 0);
  return `<div class="staff-head"><h1>ยอดค้างชำระ</h1><p>${rows.length} ราย · รวม ${money(total)} บาท</p></div>
  <div class="staff-panel staff-table">
    ${rows.length ? rows.map(r => `<div class="staff-row">
      <div><b>${escapeHTML(r.first.merchant)}</b><small>${escapeHTML(staffPlace(r.first))}</small><small>${escapeHTML(r.months.join(' · '))}</small></div>
      <div class="staff-row-end"><b>${money(r.due)} บาท</b>${r.pending ? '<span class="staff-chip reserved">รอตรวจ/รับเงิน</span>' : ''}</div>
    </div>`).join('') : '<div class="staff-empty">ไม่มียอดค้าง</div>'}
  </div>`;
}

function planHTML() {
  const sel = staffPlanStall ? DEMO.stalls.find(s => s.id === staffPlanStall) : undefined;
  const label: Record<StallStatus, string> = { available: 'ว่าง', reserved: 'จอง', occupied: 'เช่า' };
  const rows = [...new Set(DEMO.stalls.map(s => s.row))];
  const detail = (() => {
    if (!sel) return '<p class="staff-hint">แตะแผงเพื่อดูผู้เช่าและยอดค้าง</p>';
    const due = DEMO.bills.filter(b => b.stall === sel.id && staffIsOpen(b));
    const total = due.filter(b => PAYABLE.includes(b.status)).reduce((n, b) => n + b.amount, 0);
    return `<div class="staff-card-head"><div><b>แผง ${sel.id}</b><small>${label[sel.status]}${sel.tenantName ? ` · ${escapeHTML(sel.tenantName)}` : ''}</small></div><b class="staff-amount">${money(total)} บาท</b></div>
      ${due.length ? `<ul class="staff-lines">${due.map(b => `<li><span>${escapeHTML(b.month)} · ${escapeHTML(b.kind)} · ${escapeHTML(statusText[b.status])}</span><b>${money(b.amount)}</b></li>`).join('')}</ul>` : '<p class="staff-hint">ไม่มียอดค้าง</p>'}`;
  })();
  return `<div class="staff-head"><h1>ผังแผง</h1><p>สถานะแผงและยอดค้างรายแผง</p></div>
  <div class="staff-legend"><span><i class="lg-available"></i>ว่าง</span><span><i class="lg-reserved"></i>จอง</span><span><i class="lg-occupied"></i>เช่า</span></div>
  <div class="staff-plan">${rows.map(row => `<section class="staff-plan-row"><b>แถว ${row}</b><div class="staff-plan-grid">${DEMO.stalls.filter(s => s.row === row).map(s => `<button type="button" class="staff-stall ${s.status} ${staffPlanStall === s.id ? 'selected' : ''}" aria-label="แผง ${s.id} ${label[s.status]}" onclick="pickStaffStall('${s.id}')">${s.id}</button>`).join('')}</div></section>`).join('')}</div>
  <div class="staff-panel staff-detail">${detail}</div>`;
}

// ---------- QR ประจำแผง/บ้าน ----------
/** ข้อความใน QR: แผงใช้รหัสแผง (A06) · บ้านใช้บ้านเลขที่+หมู่ (18 หมู่ 2) — แปลงเป็น UTF-8 ให้ตัวอ่าน QR อ่านภาษาไทยได้ */
const qrText = (code: string) => unescape(encodeURIComponent(code));

/** รายการที่ต้องออก QR: แผงทุกช่อง หรือบ้านที่มีในข้อมูล (ไม่ซ้ำ) */
function qrItems() {
  if (STAFF_MODE === 'market') return DEMO.stalls.map(s => ({ code: s.id, title: `แผง ${s.id}`, sub: s.tenantName || 'ว่าง' }));
  const seen = new Set<string>();
  return DEMO.bills.filter(b => b.payerType === 'household').filter(b => (seen.has(b.ref) ? false : seen.add(b.ref))).map(b => ({ code: `${b.houseNo} หมู่ ${b.moo}`, title: `บ้านเลขที่ ${b.houseNo} หมู่ ${b.moo}`, sub: b.merchant }));
}

function qrHTML() {
  const items = qrItems();
  const heading = STAFF_MODE === 'market' ? 'QR ประจำแผง' : 'QR ประจำบ้าน';
  const hint = STAFF_MODE === 'market' ? 'ติดหน้าแผง ประชาชนสแกนเพื่อดูยอดค้างของแผงนั้น' : 'ติดหน้าบ้าน ประชาชนสแกนเพื่อดูค่าขยะของบ้านนั้น';
  return `<div class="staff-head"><h1>${heading}</h1><p>${hint}</p></div>
  <div class="staff-toolbar"><span>${items.length} ดวง</span><button type="button" onclick="printStaffQr()">พิมพ์ทั้งหมด</button></div>
  <div class="staff-qr-grid">${items.map(i => `<article class="staff-qr-card">
    <div class="staff-qr">${qrSvg(qrText(i.code), i.title)}</div>
    <b>${escapeHTML(i.code)}</b><small>${escapeHTML(i.sub)}</small>
    <button type="button" class="secondary" onclick="saveStaffQr('${escapeHTML(i.code)}','${escapeHTML(i.title)}','${escapeHTML(i.sub)}')">บันทึกรูป</button>
  </article>`).join('')}</div>`;
}

/** ภาพ PNG ของ QR พร้อมหัวข้อ (ไม่มีชื่อบัญชีรับเงิน เพราะเป็น QR ประจำที่ ไม่ใช่ QR โอนเงิน) */
function drawQrPng(code: string, title: string, sub: string): Promise<Blob | null> {
  const q = qrModules(qrText(code)); const n = q.getModuleCount(); const cell = 10; const m = 4; const size = (n + m * 2) * cell;
  const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size + 120;
  const ctx = canvas.getContext('2d'); if (!ctx) return Promise.resolve(null);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#111';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) ctx.fillRect((c + m) * cell, (r + m) * cell, cell, cell);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#0c4a6e'; ctx.font = 'bold 34px "Noto Sans Thai", sans-serif'; ctx.fillText(title, size / 2, size + 50);
  ctx.fillStyle = '#555'; ctx.font = '24px "Noto Sans Thai", sans-serif'; ctx.fillText(sub, size / 2, size + 92);
  return new Promise(ok => canvas.toBlob(b => ok(b), 'image/png'));
}

async function saveStaffQr(code: string, title: string, sub: string) {
  const blob = await drawQrPng(code, title, sub);
  if (!blob) return toast('สร้างรูป QR ไม่สำเร็จ');
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = `qr-${STAFF_MODE}-${code.replace(/[^\w]+/g, '-')}.png`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast('บันทึกรูป QR แล้ว');
}

/** หน้าพิมพ์ทั้งหมดในหน้าต่างใหม่ (ปริ้นติดหน้าแผง/บ้าน) */
function printStaffQr() {
  const items = qrItems();
  const w = window.open('', '_blank');
  if (!w) return toast('เปิดหน้าพิมพ์ไม่ได้ · อนุญาตป็อปอัปของเว็บนี้แล้วลองใหม่');
  const cards = items.map(i => `<article class="card"><div class="qr">${qrSvg(qrText(i.code), i.title)}</div><b>${escapeHTML(i.code)}</b><small>${escapeHTML(i.title)}</small><small>${escapeHTML(i.sub)}</small></article>`).join('');
  w.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>QR ${STAFF_TITLE}</title><style>body{font-family:"Noto Sans Thai",sans-serif;margin:12mm;color:#111}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8mm}.card{border:1px solid #999;border-radius:6px;padding:6mm;text-align:center;break-inside:avoid}.qr svg{width:50mm;height:50mm;display:block;margin:0 auto}.card b{display:block;font-size:14pt;margin-top:3mm}.card small{display:block;font-size:10pt;color:#333}</style></head><body><div class="grid">${cards}</div></body></html>`);
  w.document.close(); w.focus(); w.print();
}

function render() {
  const pending = staffGroups('pending').length + staffGroups('cash').length;
  const tabs: [StaffTab, string, string][] = [
    ['overview', 'ภาพรวม', ''],
    ['queue', 'รอตรวจ', pending ? `<span class="staff-badge">${pending}</span>` : ''],
    ['dues', 'ค้างชำระ', ''],
    ...(STAFF_MODE === 'market' ? [['plan', 'ผังแผง', ''] as [StaffTab, string, string]] : []),
    ['qr', STAFF_MODE === 'market' ? 'QR แผง' : 'QR บ้าน', ''],
  ];
  const view: Record<StaffTab, () => string> = { overview: overviewHTML, queue: queueHTML, dues: duesHTML, plan: planHTML, qr: qrHTML };
  const body = view[staffTab]();
  staffApp.innerHTML = `<nav class="staff-tabs" aria-label="เมนูเจ้าหน้าที่" style="grid-template-columns:repeat(${tabs.length},minmax(0,1fr))">${tabs.map(([t, label, badge]) => `<button type="button" class="${staffTab === t ? 'active' : ''}" aria-current="${staffTab === t}" onclick="setStaffTab('${t}')">${label}${badge}</button>`).join('')}</nav>${body}
  <p class="help staff-foot">ระบบสาธิต · ข้อมูลและสถานะบันทึกเฉพาะเบราว์เซอร์นี้</p>`;
}

applySavedPayments();
render();
