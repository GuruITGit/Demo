// หน้าเจ้าหน้าที่ (เดโม่) แยกตามหมวด: ค่าแผงตลาด (data-staff="market") · ค่าขยะบ้าน (data-staff="waste")
// ตรวจสลิป · รับเงินสด · ยอดค้างชำระ · ผังแผง/QR · ออก QR ประจำแผงหรือประจำบ้าน
// ใช้สถานะชุดเดียวกับหน้าประชาชน (localStorage 'market:payments') จึงเห็นรายการที่ประชาชนส่งมาบนเครื่องเดียวกัน
type StaffMode = 'market' | 'waste';
type StaffTab = 'overview' | 'manage' | 'payments';
type StaffSub = 'plan' | 'rates' | 'qr' | 'queue' | 'dues' | 'report';
const STAFF_MODE: StaffMode = document.body.dataset.staff === 'waste' ? 'waste' : 'market';
const STAFF_TITLE = STAFF_MODE === 'waste' ? 'ค่าเก็บขยะบ้าน' : 'ค่าแผงตลาด';
const TAB_ICON: Record<StaffTab, string> = { overview: 'overview', manage: STAFF_MODE === 'market' ? 'stall' : 'house', payments: 'payment' };
let staffTab: StaffTab = 'overview';
let staffSub: StaffSub = 'plan';
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

let staffPlanFilter: StallStatus | null = null;
function openStallStatus(s: StallStatus) { staffTab = 'manage'; staffSub = 'plan'; staffPlanFilter = s; staffPlanStall = null; render(); window.scrollTo({ top: 0 }); }
function setStallFilter(s: StallStatus | null) { staffPlanFilter = s; staffPlanStall = null; render(); }

function setStaffTab(t: StaffTab) { staffTab = t; staffPlanFilter = null; staffSub = subsOf(t)[0]?.[0] ?? staffSub; render(); window.scrollTo({ top: 0 }); }
function setStaffSub(s: StaffSub) { staffSub = s; render(); }

/** เมนูย่อยของแต่ละหมวดหลัก */
function subsOf(t: StaffTab): [StaffSub, string][] {
  if (t === 'manage') return STAFF_MODE === 'market' ? [['plan', 'ผังแผง'], ['rates', 'พื้นที่/ราคา'], ['qr', 'QR แผง']] : [['qr', 'QR บ้าน']];
  if (t === 'payments') {
    const n = staffGroups('pending').length + staffGroups('cash').length;
    return [['queue', n ? `รอตรวจ (${n})` : 'รอตรวจ'], ['dues', 'ค้างชำระ'], ['report', 'รายงาน']];
  }
  return [];
}
function pickStaffStall(id: string) { staffPlanStall = staffPlanStall === id ? null : id; render(); }

function staffMetric(label: string, value: string, sub: string, icon: string, tone = '') {
  return `<div class="staff-metric ${tone}"><div class="staff-metric-top"><small>${label}</small><span class="staff-metric-ico">${staffIcon(icon, 16)}</span></div><b>${value}</b><span>${sub}</span></div>`;
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
      <div class="staff-chips"><button type="button" class="staff-chip occupied" onclick="openStallStatus('occupied')">เช่า ${countStall('occupied')} ›</button><button type="button" class="staff-chip reserved" onclick="openStallStatus('reserved')">จอง ${countStall('reserved')} ›</button><button type="button" class="staff-chip available" onclick="openStallStatus('available')">ว่าง ${countStall('available')} ›</button></div></div>`
    : '';
  return `<div class="staff-head"><h1>ภาพรวม · ${STAFF_TITLE}</h1><p>ข้อมูลตัวอย่าง</p></div>${manageLinksHTML()}
  <div class="staff-ov">
  <section class="staff-ov-main">${duesSearchHTML(true)}</section>
  <aside class="staff-ov-side">
  <div class="staff-metrics">
    ${staffMetric('ยอดค้างทั้งหมด', `${money(dueTotal)} บาท`, `${dueCount} ราย`, 'tag')}
    ${staffMetric('รอตรวจสลิป', `${pend.length} รายการ`, `${money(pend.reduce((n, g) => n + g.total, 0))} บาท`, 'queue', 'tone-warn')}
    ${staffMetric('รอรับเงินสด', `${cash.length} รายการ`, `${money(cash.reduce((n, g) => n + g.total, 0))} บาท`, 'payment', 'tone-info')}
    ${staffMetric('ชำระแล้ว', `${money(paid)} บาท`, 'ยืนยันแล้ว', 'check')}
  </div>
  ${stallChips}
  <button type="button" class="staff-go" onclick="setStaffTab('payments')"><span class="staff-go-label">${staffIcon('queue', 18)}<span>ไปตรวจสอบการชำระ</span></span><span aria-hidden="true">›</span></button>
  </aside></div>`;
}

function queueCard(g: ReturnType<typeof staffGroups>[number], kind: 'pending' | 'cash') {
  const first = g.bills[0];
  const ref = escapeHTML(g.ref);
  const meta = kind === 'pending'
    ? `ส่งเมื่อ ${staffTime(g.rec?.at)} · ${escapeHTML(g.rec?.slipName || 'ไม่มีไฟล์สลิป (ข้อมูลตัวอย่าง)')}`
    : `เลขอ้างอิง ${escapeHTML(g.rec?.ref || '—')} · ${staffTime(g.rec?.at)}`;
  const actions = kind === 'pending'
    ? `<button type="button" class="secondary" onclick="staffSetRef('${ref}','pending','unpaid')">ตีกลับ</button><button type="button" onclick="staffSetRef('${ref}','pending','confirmed')">${staffIcon('check', 16)}<span>ยืนยันรับเงิน</span></button>`
    : `<button type="button" class="secondary" onclick="staffSetRef('${ref}','cash','unpaid')">ยกเลิกเลขอ้างอิง</button><button type="button" onclick="staffSetRef('${ref}','cash','confirmed')">${staffIcon('check', 16)}<span>รับเงินแล้ว</span></button>`;
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

let staffDuesQ = '';

/** ผู้จ่ายที่มียอดเปิดอยู่ แยกตามรายการเดียวกัน (ref) เรียงตามยอดค้างมากสุดก่อน */
/** ป้ายชื่อรายการ: ค่าขยะของแผงกับค่าขยะบ้านแยกกันชัดเจน */
const kindLabel = (b: Bill) => b.kind.includes('ขยะ') ? (b.payerType === 'household' ? 'ค่าขยะบ้าน' : 'ค่าขยะแผง') : b.kind;

/** ผู้จ่ายที่มียอดเปิดอยู่ · all = ทุกหมวด (ค่าแผงและค่าขยะบ้าน) ใช้กับการค้นหา */
function duesRows(all = false) {
  const open = DEMO.bills.filter(b => (all || inMode(b)) && (PAYABLE.includes(b.status) || b.status === 'pending' || b.status === 'cash'));
  const refs = [...new Set(open.map(b => b.ref))];
  return refs.map(ref => {
    const bills = open.filter(b => b.ref === ref);
    const due = bills.filter(b => PAYABLE.includes(b.status)).reduce((n, b) => n + b.amount, 0);
    const months = [...new Set(bills.map(b => b.month))];
    const pending = bills.some(b => b.status === 'pending' || b.status === 'cash');
    const haystack = [bills[0].merchant, staffPlace(bills[0]), bills[0].houseNo, bills[0].moo, ref, ...bills.map(b => `${b.month} ${b.kind} ${kindLabel(b)}`)].join(' ').toLowerCase();
    return { ref, first: bills[0], bills, due, months, pending, haystack };
  }).sort((a, b) => b.due - a.due);
}

/** ผลค้นหา: ทุกรายการที่ค้างของผู้จ่ายที่ตรงกับคำค้น · ไม่พิมพ์อะไร = รายชื่อแบบย่อ */
function duesListHTML(showAll = true) {
  const q = staffDuesQ.trim().toLowerCase();
  if (q) {
    const found = duesRows(true).filter(r => r.haystack.includes(q));
    if (!found.length) return `<div class="staff-empty">ไม่พบ “${escapeHTML(staffDuesQ.trim())}” ในรายการค้างชำระ</div>`;
    return found.map(r => `<article class="staff-card">
      <div class="staff-card-head"><div><b>${escapeHTML(r.first.merchant)}</b><small>${escapeHTML(staffPlace(r.first))} · ${escapeHTML(r.ref)}</small></div><b class="staff-amount">${money(r.due)} บาท</b></div>
      <ul class="staff-lines">${r.bills.map(b => `<li><span>${escapeHTML(kindLabel(b))} · ${escapeHTML(b.month)}<small class="staff-line-status">${statusText[b.status] || b.status}</small></span><b>${money(b.amount)}</b></li>`).join('')}</ul>
      <div class="staff-actions one"><button type="button" onclick="staffOpenDetail('${escapeHTML(r.ref)}')">${staffIcon('payment', 16)}<span>รายละเอียดและรับชำระ</span></button></div>
    </article>`).join('');
  }
  if (!showAll) return '<div class="staff-empty staff-empty-home">ผลการค้นหาจะแสดงที่นี่</div>';
  const rows = duesRows();
  if (!rows.length) return '<div class="staff-empty">ไม่มียอดค้าง</div>';
  return `<div class="staff-panel staff-table">${rows.map(r => `<button type="button" class="staff-hit" onclick="staffOpenDetail('${escapeHTML(r.ref)}')">
      <span class="staff-hit-main"><b>${escapeHTML(r.first.merchant)}</b><small>${escapeHTML(staffPlace(r.first))} · ${escapeHTML(r.ref)}</small><small>${escapeHTML(r.months.join(' · '))}</small></span>
      <span class="staff-hit-end"><b>${money(r.due)} บาท</b>${r.pending ? '<span class="staff-chip reserved">รอตรวจ/รับเงิน</span>' : ''}</span>
      <span class="staff-hit-go" aria-hidden="true">›</span>
    </button>`).join('')}</div>`;
}

const METHOD_TEXT: Record<string, string> = { qr: 'สแกน QR', app: 'แอปธนาคาร', cash: 'เงินสด' };

/** รายละเอียดของผู้จ่ายหนึ่งราย: ทุกรายการที่ค้าง สถานะ ข้อมูลการชำระล่าสุด และปุ่มรับเงิน/ตีกลับตามสถานะ */
/** รับเงินที่เทศบาลแทนผู้จ่าย (เงินสด หรือสแกน QR แล้วโอนเข้า): รายการที่ค้างทั้งหมดของผู้จ่ายนี้ → ชำระแล้ว */
function staffCollectCounter(ref: string, method: 'cash' | 'qr') {
  const all = loadPaymentRecords();
  const now = new Date().toISOString();
  const open = DEMO.bills.filter(b => b.ref === ref && PAYABLE.includes(b.status));
  const total = open.reduce((n, b) => n + b.amount, 0);
  const prefix = method === 'cash' ? 'CSH' : 'CQR';
  for (const b of open) {
    all[b.id] = { status: 'confirmed', method, ref: `${prefix}-${b.id.slice(-6)}`, at: now, amount: b.amount };
    b.status = 'confirmed';
  }
  writePaymentRecords(all);
  modal.close();
  toast(`รับเงิน${method === 'cash' ? 'สด' : 'ทางสแกน QR'} ${money(total)} บาท ที่เทศบาลแล้ว`);
  render();
}

type CounterStep = 'menu' | 'cash' | 'scan';

function staffDetailHTML(ref: string, step: CounterStep = 'menu') {
  const bills = DEMO.bills.filter(b => b.ref === ref);
  if (!bills.length) return '';
  const first = bills[0];
  const due = bills.filter(b => PAYABLE.includes(b.status)).reduce((n, b) => n + b.amount, 0);
  const pending = bills.some(b => b.status === 'pending');
  const cash = bills.some(b => b.status === 'cash');
  const rec = paymentRecordFor(first.id);
  const r = escapeHTML(ref);
  const back = `<button type="button" class="secondary" onclick="staffOpenDetail('${r}')">ย้อนกลับ</button>`;
  const counter = due <= 0 ? '' : step === 'cash'
    ? `${back}<button type="button" onclick="staffCollectCounter('${r}','cash')">${staffIcon('check', 16)}<span>ยืนยันรับเงินสด</span></button>`
    : step === 'scan'
      ? `${back}<button type="button" onclick="staffCollectCounter('${r}','qr')">${staffIcon('check', 16)}<span>ยืนยันโอนแล้ว</span></button>`
      : `<button type="button" class="secondary" onclick="staffOpenDetail('${r}','cash')">${staffIcon('payment', 16)}<span>รับเงินสด</span></button>${hasPromptpay() ? `<button type="button" onclick="staffOpenDetail('${r}','scan')">${staffIcon('qr', 16)}<span>สแกนจ่าย</span></button>` : ''}`;
  const scanBlock = step === 'scan' && due > 0
    ? `<div class="pay-qr staff-counter-qr">${qrSvg(promptpayPayload(PAYMENT.promptpayId, due, PAYMENT.promptpayType), 'QR พร้อมเพย์ ยอด ' + money(due) + ' บาท')}<b>${money(due)} บาท</b><small>ให้ผู้จ่ายสแกนด้วยแอปธนาคาร · โอนเข้า ${escapeHTML(PAYMENT.payeeName)}</small></div>`
    : '';
  const actions = [
    counter,
    pending ? `<button type="button" class="secondary" onclick="modal.close();staffSetRef('${r}','pending','unpaid')">ตีกลับ</button><button type="button" onclick="modal.close();staffSetRef('${r}','pending','confirmed')">${staffIcon('check', 16)}<span>ยืนยันรับเงิน</span></button>` : '',
    cash ? `<button type="button" class="secondary" onclick="modal.close();staffSetRef('${r}','cash','unpaid')">ยกเลิกเลขอ้างอิง</button><button type="button" onclick="modal.close();staffSetRef('${r}','cash','confirmed')">${staffIcon('check', 16)}<span>รับเงินแล้ว</span></button>` : '',
  ].join('');
  return `<div class="modal-inner"><div class="modal-top pay-top"><button type="button" class="pay-back" onclick="modal.close()">‹ กลับ</button><h2 id="modalTitle">${escapeHTML(first.merchant)}</h2><span></span></div>
  <div class="modal-body staff-detail">
    <small class="staff-meta">${escapeHTML(staffPlace(first))} · ${r}</small>
    <ul class="staff-lines">${bills.map(b => `<li><span>${escapeHTML(kindLabel(b))} · ${escapeHTML(b.month)}<small class="staff-line-status">${statusText[b.status] || b.status}</small></span><b>${money(b.amount)}</b></li>`).join('')}</ul>
    <div class="staff-detail-total"><span>ยอดค้างรวม</span><b>${money(due)} บาท</b></div>
    ${scanBlock}
    ${rec ? `<p class="staff-meta">ช่องทาง ${escapeHTML(METHOD_TEXT[rec.method] || rec.method)} · ${staffTime(rec.at)}${rec.ref ? ` · อ้างอิง ${escapeHTML(rec.ref)}` : ''}${rec.slipName ? ` · ${escapeHTML(rec.slipName)}` : ''}</p>` : ''}
  </div>${actions ? `<div class="modal-actions staff-actions">${actions}</div>` : ''}</div>`;
}

function staffOpenDetail(ref: string, step: CounterStep = 'menu') {
  const html = staffDetailHTML(ref, step);
  if (!html) return;
  modalContent.innerHTML = html;
  // มือถือ: เต็มจอ · คอม: กล่องกลางจอที่เห็นข้อมูลครบโดยไม่ต้องเลื่อน
  const wide = window.matchMedia('(min-width: 900px)').matches;
  modal.classList.toggle('pay-full', !wide);
  modal.classList.toggle('staff-dlg', wide);
  if (!modal.open) modal.showModal();
}

/** พิมพ์ค้นหาแล้วอัปเดตเฉพาะรายการ (ไม่ render ทั้งหน้า จึงไม่หลุดโฟกัสช่องค้นหา) */
function staffDuesSearch(v: string) {
  staffDuesQ = v;
  const list = document.getElementById('dues-list');
  if (list) list.innerHTML = duesListHTML(list.dataset.home !== '1');
  const hint = document.getElementById('dues-hint');
  if (hint) hint.textContent = duesHintText();
}

function duesHintText() {
  return staffDuesQ.trim() ? 'แสดงรายการค้างทั้งหมดของผู้ที่ตรงกับคำค้น' : 'พิมพ์ชื่อ แผง หรือบ้านเลขที่ เพื่อดูว่าค้างค่าอะไรบ้าง';
}

/** ช่องค้นหา + ผลลัพธ์ ใช้ทั้งหน้าภาพรวมและหน้ายอดค้างชำระ (home = หน้าภาพรวม ไม่แสดงรายการก่อนพิมพ์) */
function duesSearchHTML(home = false) {
  return `<label class="staff-search">${staffIcon('search', 18)}<input type="search" value="${escapeHTML(staffDuesQ)}" placeholder="ค้นหาชื่อ เลขแผง หรือบ้านเลขที่" autocomplete="off" oninput="staffDuesSearch(this.value)" aria-label="ค้นหายอดค้างชำระ"></label>
  <p class="staff-hint staff-search-hint" id="dues-hint">${duesHintText()}</p>
  <div id="dues-list" data-home="${home ? 1 : 0}">${duesListHTML(!home)}</div>`;
}

/** ตัวกรองรายงาน: ค้างตั้งแต่กี่เดือนขึ้นไป */
let staffReportMin = 1;
const REPORT_MIN_OPTIONS: [number, string][] = [[1, 'ค้างตั้งแต่ 1 เดือน'], [2, 'ค้าง 2 เดือนขึ้นไป'], [3, 'ค้าง 3 เดือนขึ้นไป']];
function setReportMin(n: number) { staffReportMin = n; render(); }

/** นับเฉพาะเดือนที่ยังไม่ชำระ (รายการที่รอตรวจหรือรอรับเงินสดไม่นับเป็นค้าง) */
function reportRows() {
  return duesRows()
    .map(r => ({ ...r, unpaidMonths: [...new Set(r.bills.filter(b => PAYABLE.includes(b.status)).map(b => b.month))] }))
    .filter(r => r.unpaidMonths.length >= staffReportMin && r.due > 0)
    .sort((a, b) => b.unpaidMonths.length - a.unpaidMonths.length || b.due - a.due);
}

function reportHTML() {
  const rows = reportRows();
  const total = rows.reduce((n, r) => n + r.due, 0);
  const label = REPORT_MIN_OPTIONS.find(([n]) => n === staffReportMin)?.[1] ?? '';
  const today = new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
  return `<div class="staff-report-bar no-print">
    <div class="staff-filter-row">${REPORT_MIN_OPTIONS.map(([n, l]) => `<button type="button" class="${staffReportMin === n ? 'active' : ''}" onclick="setReportMin(${n})">${l}</button>`).join('')}</div>
    <button type="button" class="staff-report-print" onclick="window.print()">${staffIcon('print', 16)}<span>พิมพ์รายงาน</span></button>
  </div>
  <div class="staff-report-sheet">
    <div class="staff-report-title"><b>รายงานยอดค้างชำระ · ${escapeHTML(STAFF_TITLE)}</b><small>${escapeHTML(label)} · ${rows.length} ราย · รวม ${money(total)} บาท · พิมพ์วันที่ ${today}</small></div>
    ${rows.length ? `<div class="staff-report-scroll"><table class="staff-report-table">
      <thead><tr><th>ลำดับ</th><th>ผู้จ่าย</th><th>แผง / บ้านเลขที่</th><th>เดือนที่ค้าง</th><th class="num">จำนวนเดือน</th><th class="num">ยอดค้าง (บาท)</th></tr></thead>
      <tbody>${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${escapeHTML(r.first.merchant)}</td><td>${escapeHTML(staffPlace(r.first))} · ${escapeHTML(r.ref)}</td><td>${escapeHTML(r.unpaidMonths.join(', '))}</td><td class="num">${r.unpaidMonths.length}</td><td class="num">${money(r.due)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="4">รวม ${rows.length} ราย</td><td class="num"></td><td class="num">${money(total)}</td></tr></tfoot>
    </table></div>` : '<div class="staff-empty">ไม่มีรายการตามเงื่อนไขนี้</div>'}
  </div>`;
}

function duesHTML() {
  const rows = duesRows();
  const total = rows.reduce((n, r) => n + r.due, 0);
  return `<div class="staff-head"><h1>ยอดค้างชำระ</h1><p>${rows.length} ราย · รวม ${money(total)} บาท</p></div>
  ${duesSearchHTML()}`;
}

function planHTML() {
  const filters: [StallStatus | null, string][] = [[null, 'ทั้งหมด'], ['occupied', 'เช่า'], ['reserved', 'จอง'], ['available', 'ว่าง']];
  const filterBar = `<div class="staff-filter-row">${filters.map(([v, l]) => `<button type="button" class="${staffPlanFilter === v ? 'active' : ''}" onclick="setStallFilter(${v ? `'${v}'` : 'null'})">${l}</button>`).join('')}</div>`;
  const sel = staffPlanStall ? DEMO.stalls.find(s => s.id === staffPlanStall) : undefined;
  const label: Record<StallStatus, string> = { available: 'ว่าง', reserved: 'จอง', occupied: 'เช่า' };
  const shown = staffPlanFilter ? DEMO.stalls.filter(s => s.status === staffPlanFilter) : DEMO.stalls;
  const rows = [...new Set(shown.map(s => s.row))];
  const detail = (() => {
    if (!sel) return '<p class="staff-hint">แตะแผงเพื่อดูผู้เช่าและยอดค้าง</p>';
    const due = DEMO.bills.filter(b => b.stall === sel.id && staffIsOpen(b));
    const total = due.filter(b => PAYABLE.includes(b.status)).reduce((n, b) => n + b.amount, 0);
    return `<div class="staff-card-head"><div><b>แผง ${sel.id}</b><small>${label[sel.status]}${sel.tenantName ? ` · ${escapeHTML(sel.tenantName)}` : ''}</small></div><b class="staff-amount">${money(total)} บาท</b></div>
      ${due.length ? `<ul class="staff-lines">${due.map(b => `<li><span>${escapeHTML(b.month)} · ${escapeHTML(b.kind)} · ${escapeHTML(statusText[b.status])}</span><b>${money(b.amount)}</b></li>`).join('')}</ul>` : '<p class="staff-hint">ไม่มียอดค้าง</p>'}`;
  })();
  return `${staffPlanFilter ? `<button type="button" class="staff-back" onclick="setStaffTab('overview')">${staffIcon('back', 16)}<span>กลับภาพรวม</span></button>` : ''}<div class="staff-head"><h1>ผังแผง</h1><p>สถานะแผงและยอดค้างรายแผง</p></div>
  ${filterBar}<div class="staff-legend"><span><i class="lg-available"></i>ว่าง</span><span><i class="lg-reserved"></i>จอง</span><span><i class="lg-occupied"></i>เช่า</span></div>
  <div class="staff-plan">${rows.map(row => `<section class="staff-plan-row"><b>แถว ${row}</b><div class="staff-plan-grid">${shown.filter(s => s.row === row).map(s => `<button type="button" class="staff-stall ${s.status} ${staffPlanStall === s.id ? 'selected' : ''}" aria-label="แผง ${s.id} ${label[s.status]}" onclick="pickStaffStall('${s.id}')">${s.id}</button>`).join('')}</div></section>`).join('')}</div>
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
  <div class="staff-toolbar"><span>${items.length} ดวง</span><button type="button" onclick="printStaffQr()">${staffIcon('print', 16)}<span>พิมพ์ทั้งหมด</span></button></div>
  <div class="staff-qr-grid">${items.map(i => `<article class="staff-qr-card">
    <div class="staff-qr">${qrSvg(qrText(i.code), i.title)}</div>
    <b>${escapeHTML(i.code)}</b><small>${escapeHTML(i.sub)}</small>
    <button type="button" class="secondary" onclick="saveStaffQr('${escapeHTML(i.code)}','${escapeHTML(i.title)}','${escapeHTML(i.sub)}')">${staffIcon('download', 16)}<span>บันทึกรูป</span></button>
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

/** ปุ่มไปหน้าจัดการค่าแผง / ค่าขยะ — ใช้ลิงก์เดียวกับเมนูสลับหน้าด้านบน */
function manageLinksHTML() {
  const href = (key: string) => Array.from(document.querySelectorAll<HTMLAnchorElement>('.staff-switch a')).find(a => a.getAttribute('href')?.includes(key))?.getAttribute('href') || '#';
  return `<div class="staff-manage-links"><a class="staff-manage-btn" href="${href('market')}">จัดการค่าแผง</a><a class="staff-manage-btn" href="${href('waste')}">จัดการค่าขยะ</a></div>`;
}

function render() {
  const pending = staffGroups('pending').length + staffGroups('cash').length;
  const tabs: [StaffTab, string, string][] = [
    ['overview', 'ภาพรวม', ''],
    ['manage', STAFF_MODE === 'market' ? 'จัดการแผง' : 'จัดการบ้าน', ''],
    ['payments', 'ตรวจชำระ', pending ? `<span class="staff-badge">${pending}</span>` : ''],
  ];
  const subs = subsOf(staffTab);
  const sub = subs.find(([s]) => s === staffSub)?.[0] ?? subs[0]?.[0];
  const views: Record<StaffSub, () => string> = { plan: planHTML, rates: ratesHTML, qr: qrHTML, queue: queueHTML, dues: duesHTML, report: reportHTML };
  const body = staffTab === 'overview' ? overviewHTML() : views[sub]();
  const subNav = subs.length > 1
    ? `<nav class="staff-subtabs" aria-label="เมนูย่อย">${subs.map(([v, label]) => `<button type="button" class="${sub === v ? 'active' : ''}" aria-current="${sub === v}" onclick="setStaffSub('${v}')">${label}</button>`).join('')}</nav>`
    : '';
  staffApp.innerHTML = homeBackHTML() + `<nav class="staff-tabs" aria-label="เมนูเจ้าหน้าที่" style="grid-template-columns:repeat(3,minmax(0,1fr))">${tabs.map(([t, label, badge]) => `<button type="button" class="${staffTab === t ? 'active' : ''}" aria-current="${staffTab === t}" onclick="setStaffTab('${t}')">${staffIcon(TAB_ICON[t])}<span>${label}</span>${badge}</button>`).join('')}</nav>${subNav}${body}
  <p class="help staff-foot">ระบบสาธิต · ข้อมูลและสถานะบันทึกเฉพาะเบราว์เซอร์นี้</p>`;
}

applySavedPayments();
render();
