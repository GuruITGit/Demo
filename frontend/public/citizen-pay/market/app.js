/** ปุ่มขนาดตัวหนังสือบนหัวเว็บ (มือถือตัวเล็กเกินไป) — กดวนได้ 3 ขนาด · จำค่าไว้ใน localStorage · เก็บไม่ได้ก็ใช้ขนาดปกติ */
const TEXT_SIZE_STEPS = [1, 1.15, 1.3];
const TEXT_SIZE_LABELS = ['Aa', 'Aa+', 'Aa++'];
const TEXT_SIZE_KEY = 'citizen:textSize';
function readTextSizeStep() {
    try {
        const v = Number(localStorage.getItem(TEXT_SIZE_KEY));
        return Number.isInteger(v) && v >= 0 && v < TEXT_SIZE_STEPS.length ? v : 0;
    }
    catch {
        return 0;
    }
}
function applyTextSizeStep(step) {
    // zoom ทั้งหน้า (ใช้ var --text-scale) — ตัวอักษร ปุ่ม และช่องกรอกขยายพร้อมกัน
    document.documentElement.style.setProperty('--text-scale', String(TEXT_SIZE_STEPS[step]));
    const btn = document.getElementById('textSizeBtn');
    if (btn) {
        const next = (step + 1) % TEXT_SIZE_STEPS.length;
        btn.textContent = TEXT_SIZE_LABELS[step];
        btn.setAttribute('aria-label', `ขนาดตัวหนังสือ ${TEXT_SIZE_LABELS[step]} กดเพื่อเปลี่ยนเป็น ${TEXT_SIZE_LABELS[next]}`);
    }
}
function initTextSizeControl() {
    const header = document.querySelector('.sao-header-in');
    if (!header || document.getElementById('textSizeBtn'))
        return;
    let step = readTextSizeStep();
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'textSizeBtn';
    btn.className = 'text-size-btn';
    btn.addEventListener('click', () => {
        step = (step + 1) % TEXT_SIZE_STEPS.length;
        try {
            localStorage.setItem(TEXT_SIZE_KEY, String(step));
        }
        catch { /* ไม่ต้องจำก็ได้ */ }
        applyTextSizeStep(step);
    });
    header.appendChild(btn);
    applyTextSizeStep(step);
}
initTextSizeControl();
/** ลิงก์กลับหน้าหลักบนทุกหน้าค่าแผง/ขยะ/เจ้าหน้าที่ — เดโม่ Vercel กลับไป "/" · ระบบจริงกลับไป /citizen */
/** กล่องติดต่อเจ้าหน้าที่ท้ายหน้า (เบอร์ฉุกเฉิน) — ไม่มีเบอร์ = ไม่แสดง */
function contactFooterHTML() {
    const phone = PAYMENT.contactPhone;
    if (!phone)
        return '';
    return `<div class="contact-box"><b>ติดต่อเจ้าหน้าที่</b><span>${escapeHTML(PAYMENT.cashPlace)}</span><a href="tel:${escapeHTML(phone.replace(/[^0-9+]/g, ''))}">โทร ${escapeHTML(phone)}</a><small>มีเหตุฉุกเฉินหรือติดปัญหาการชำระ โทรหาเจ้าหน้าที่ได้ตามเวลาทำการ</small></div>`;
}
/** เดโม่: คีย์เทียบชื่อ ตัดคำนำหน้า/ช่องว่าง (ตรงกับ nameKey ฝั่ง backend) */
const demoNameKey = (n) => n.replace(/\s+/g, '').replace(/^(นางสาว|น\.ส\.|นาย|นาง|เด็กชาย|เด็กหญิง|คุณ)/, '').toLowerCase();
function homeBackHTML() {
    const demo = location.pathname.includes('/citizen-pay/') || location.hostname.endsWith('vercel.app');
    return `<a class="home-back" href="${demo ? '/' : '/citizen'}">‹ กลับหน้าหลัก</a>`;
}
const modal = document.getElementById('modal');
const modalContent = document.getElementById('modalContent');
const money = n => Number(n).toLocaleString('th-TH', { maximumFractionDigits: 2 });
const escapeHTML = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
let noticeTimer;
function toast(message) { const notice = window.document.querySelector('.toast'); if (!notice)
    return; notice.textContent = message; notice.classList.add('show'); window.clearTimeout(noticeTimer); noticeTimer = window.setTimeout(() => notice.classList.remove('show'), 2600); }
const statusText = { unpaid: 'ยังไม่ชำระ', pending: 'รอตรวจสอบ', cash: 'รอจ่ายเงินสด', confirmed: 'ยืนยันแล้ว', mismatch: 'ยอดไม่ตรง' };
const PAYABLE = ['unpaid', 'mismatch'];
const statusClass = s => s === 'cash' ? 'pending' : s;
// ---------- ค้นหา + เลือกเดือนที่จะจ่าย ----------
let searchTerm = '';
const selectedBills = new Set();
let autoSelectedTerm = null;
function resetSelection() { selectedBills.clear(); autoSelectedTerm = null; }
function searchTokens(text) { return text.toLowerCase().split(/\s+/).filter(Boolean); }
function matchesAllTokens(text, tokens) { const hay = text.toLowerCase(); return tokens.every(token => hay.includes(token)); }
function groupBillsByPayerMonth(items) { const keys = [...new Set(items.map(b => `${b.payerType}:${b.ref}:${b.month}`))]; return keys.map(key => { const bills = items.filter(b => `${b.payerType}:${b.ref}:${b.month}` === key); return { month: bills[0].month, bills }; }); }
function toggleMonth(ids, on) { for (const id of ids.split('|')) {
    const bill = DEMO.bills.find(b => b.id === id);
    if (!bill || !PAYABLE.includes(bill.status))
        continue;
    on ? selectedBills.add(id) : selectedBills.delete(id);
} render(); }
function searchBills(q) { searchTerm = q.trim(); resetSelection(); render(); }
/** รายการบิลแยกเดือน + ยอดรวม + ปุ่มจ่าย (หรือข้อความ "ไม่พบ"/"พิมพ์เพื่อค้นหา") */
function billListHTML(o) {
    const { matches } = o;
    if (searchTerm !== autoSelectedTerm) {
        autoSelectedTerm = searchTerm;
        selectedBills.clear();
        matches.filter(b => PAYABLE.includes(b.status)).forEach(b => selectedBills.add(b.id));
    }
    // แสดงเดือนที่ยังค้าง + เดือนที่ส่งไปแล้วรอผล (จะได้เห็นว่าส่งแล้ว ไม่ใช่หายไปเฉยๆ)
    const grouped = groupBillsByPayerMonth(matches).filter(g => g.bills.some(b => ['unpaid', 'mismatch', 'pending', 'cash'].includes(b.status)));
    const totalDue = matches.filter(b => PAYABLE.includes(b.status)).reduce((n, b) => n + b.amount, 0);
    const rows = grouped.map(g => {
        const payable = g.bills.filter(b => PAYABLE.includes(b.status));
        const ids = payable.map(b => b.id);
        const checked = ids.length > 0 && ids.every(id => selectedBills.has(id));
        const due = payable.reduce((n, b) => n + b.amount, 0);
        const cashBill = g.bills.find(b => b.status === 'cash');
        const cashRef = cashBill ? paymentRecordFor(cashBill.id)?.ref : '';
        const pending = g.bills.some(b => b.status === 'pending');
        const side = payable.length ? `<label class="month-select"><input type="checkbox" ${checked ? 'checked' : ''} onchange="toggleMonth('${ids.join('|')}',this.checked)"><span>จ่ายเดือนนี้</span></label>`
            : cashRef ? `<button type="button" class="status pending cash-ref-btn" onclick="showCashTicket('${escapeHTML(cashRef)}')">รอจ่ายเงินสด · ดูเลขอ้างอิง</button>`
                : `<span class="status ${pending ? 'pending' : 'confirmed'}">${pending ? 'รอตรวจสอบ' : 'ชำระแล้ว'}</span>`;
        return `<article class="bill-card month-card"><div class="month-card-head"><div class="month-card-info"><b>${escapeHTML(g.month)}</b><small>${escapeHTML(g.bills[0].merchant)} · ${escapeHTML(o.payerLabel(g.bills[0]))}</small></div>${side}</div>${(n => n ? `<p class="bill-note">หมายเหตุ: ${escapeHTML(n)}</p>` : '')(g.bills.find(b => b.note)?.note)}<div class="charge-lines">${g.bills.map(b => `<div class="charge-line"><span>${escapeHTML(o.chargeLabel(b))}</span><b>${money(b.amount)} บาท</b><em class="status ${statusClass(b.status)}">${statusText[b.status]}</em></div>`).join('')}</div>${payable.length ? `<div class="month-due"><span>ยอดค้างเดือนนี้</span><b>${money(due)} บาท</b></div>` : ''}</article>`;
    }).join('');
    const total = [...selectedBills].reduce((n, id) => n + (DEMO.bills.find(b => b.id === id)?.amount || 0), 0);
    const body = !searchTerm ? `<div class="search-prompt"><span>⌕</span><b>${escapeHTML(o.promptText)}</b><small>ยอดค้างจะแสดงแยกตามเดือน</small></div>`
        : !grouped.length ? '<div class="empty"><span>✅</span>ไม่พบรายการค้างชำระที่ตรงกับข้อมูลนี้</div>'
            : `<div class="panel"><div class="bill-title"><div><b>ยอด${escapeHTML(o.title)}</b><small>${escapeHTML(searchTerm)}</small></div></div>${rows}<div class="due-total-row"><span>ยอดค้างรวมทุกเดือน</span><b>${money(totalDue)} บาท</b></div></div>${selectedBills.size ? `<div class="pay-summary"><div><span>ยอดที่เลือกจ่าย</span><br><b>${money(total)} บาท</b></div><div class="pay-method-actions"><button type="button" class="pay-now" onclick="openPayment()">จ่ายเงิน <span aria-hidden="true">›</span></button></div></div>` : ''}`;
    return body + (PAYMENT.demo ? '<p class="help" style="text-align:center;padding:5px 12px">ระบบสาธิต · ยอดเงินเป็นตัวอย่าง</p>' : '');
}
/** หัวหน้า + ช่องค้นหา (ใช้ทั้งสองหน้า) */
function searchHeaderHTML(h1, label, placeholder, hint, headingClass = '') {
    return `<div class="page-heading${headingClass}"><h1>${h1}</h1><p>ค้นหา${label} · ไม่ต้องเข้าสู่ระบบ</p></div><form class="search-card" onsubmit="event.preventDefault();searchBills(this.query.value)"><label for="query">${label}</label><div class="search-row"><input id="query" name="query" value="${escapeHTML(searchTerm)}" placeholder="${placeholder}"><button type="submit">ค้นหา</button></div><p class="help">${hint}</p></form>`;
}
const PAYMENT = {
    demo: true,
    promptpayId: '0000000000',
    promptpayType: 'mobile',
    payeeName: 'บัญชีรับเงิน อบต. (ตัวอย่าง)',
    // เลขบัญชีตัวอย่าง — ต้องแก้เป็นเลขบัญชีจริงของ อบต. ก่อนใช้งานจริง
    accountBank: 'ธนาคาร (ตัวอย่าง)',
    accountNo: '000-0-00000-0',
    cashPlace: 'งานการเงิน ที่ทำการ อบต.',
    cashHours: 'จันทร์–ศุกร์ 08:30–16:30 น. (เว้นวันหยุดราชการ)',
    // เบอร์ตัวอย่างของเดโม่ — ระบบจริงใช้ค่าที่ อบต. ตั้งไว้ (ว่าง = ไม่แสดงกล่อง)
    contactPhone: '044-000-000',
    // URL scheme เปิดแอปธนาคาร — แอปเปิดขึ้นมาเฉยๆ ไม่กรอกยอดให้ (ธนาคารไม่มี deeplink กลาง) · ต้องทดสอบบนมือถือจริงทุกตัว
    banks: [
        { name: 'กสิกรไทย', short: 'K+', color: '#138F2D', scheme: 'kplus://' },
        { name: 'ไทยพาณิชย์', short: 'SCB', color: '#4E2A84', scheme: 'scbeasy://' },
        { name: 'กรุงไทย', short: 'KTB', color: '#1BA5E1', scheme: 'ktbnext://' },
        { name: 'กรุงเทพ', short: 'BBL', color: '#1E4598', scheme: 'bualuang://' },
        { name: 'กรุงศรี', short: 'KMA', color: '#FEC43B', ink: '#4A3B00', scheme: 'kma://' },
        { name: 'ออมสิน', short: 'GSB', color: '#EB198D', scheme: 'mymo://' },
    ],
};
// เชื่อมหน้าประชาชน (static) กับ API จริง: /v1/citizen/pay/* (สาธารณะ ไม่ต้องล็อกอิน)
// ถ้าเข้าถึง API ไม่ได้ (เช่นเดโม่บน Vercel) payApi คืน null แล้วหน้าจะใช้ข้อมูลตัวอย่างเดิม
const PAY_API = '/v1/citizen/pay';
class PayApiError extends Error {
    constructor(message, status) { super(message); this.status = status; }
}
const MONTH_TH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
/** "2569-10" → "ตุลาคม 2569" */
const periodToThai = (p) => { const [y, m] = String(p).split('-'); return `${MONTH_TH[Number(m) - 1] ?? m} ${y}`; };
/** เรียก API สาธารณะ: คืนค่า data · null = เข้าถึงไม่ได้ (ไม่ใช่ JSON) · โยน PayApiError เมื่อ backend ตอบว่าผิดพลาด */
async function payApi(path, init) {
    let r;
    try {
        r = await fetch(PAY_API + path, init);
    }
    catch {
        return null;
    }
    const j = await r.json().catch(() => null);
    if (!j || typeof j !== 'object')
        return null;
    if (!r.ok || j.success === false)
        throw new PayApiError(j?.error?.message || 'ทำรายการไม่สำเร็จ', r.status);
    return j.data;
}
/** ใช้ค่าช่องทางรับเงิน/ราคาจากระบบจริง เขียนทับค่าตั้งต้นใน PAYMENT */
function applyPayConfig(c) {
    Object.assign(PAYMENT, {
        promptpayId: c.promptpayId || '', promptpayType: c.promptpayType || 'mobile', payeeName: c.payeeName || '',
        accountBank: c.accountBank || '', accountNo: c.accountNo || '', cashPlace: c.cashPlace || PAYMENT.cashPlace, cashHours: c.cashHours || PAYMENT.cashHours, contactPhone: c.contactPhone || '',
        demo: false,
    });
}
const PAY_STORE = 'market:payments';
let payMethod = 'qr';
let payBillIds = [];
let payRef = '';
let slipFile = null;
let slipPreviewUrl = '';
// ---------- เก็บสถานะ (เครื่องนี้) ----------
function loadPaymentRecords() {
    try {
        const raw = JSON.parse(localStorage.getItem(PAY_STORE) || '{}');
        if (!raw || typeof raw !== 'object')
            return {};
        const out = {};
        for (const [id, r] of Object.entries(raw)) {
            if (r && ['pending', 'cash', 'confirmed', 'rejected'].includes(r.status) && typeof r.ref === 'string')
                out[id] = r;
        }
        return out;
    }
    catch {
        return {};
    }
}
function writePaymentRecords(all) { try {
    localStorage.setItem(PAY_STORE, JSON.stringify(all));
}
catch { } }
/** เรียกครั้งเดียวก่อน render แรก — คืนสถานะ "รอตรวจสอบ/รอจ่ายเงินสด" ที่เคยส่งจากเครื่องนี้ */
function applySavedPayments() {
    const all = loadPaymentRecords();
    for (const b of DEMO.bills) {
        const r = all[b.id];
        if (r) {
            b.status = r.status === 'rejected' ? 'unpaid' : r.status;
            if (r.status === 'rejected' && r.note)
                b.note = r.note;
        }
    }
}
function paymentRecordFor(billId) { return loadPaymentRecords()[billId]; }
// ---------- QR พร้อมเพย์ (EMVCo Thai QR) — ยกมาจาก backend/src/modules/water/promptpay-qr.ts ----------
function tlv(tag, value) { return tag + value.length.toString().padStart(2, '0') + value; }
function crc16(s) {
    let crc = 0xffff;
    for (let i = 0; i < s.length; i++) {
        crc ^= s.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++)
            crc = (crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1) & 0xffff;
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
}
function promptpayPayload(id, amount, type) {
    const d = (id || '').replace(/\D/g, '');
    const t = type === 'ewallet' || d.length >= 15 ? { tag: '03', value: d }
        : type === 'natid' || d.length >= 13 ? { tag: '02', value: d }
            : { tag: '01', value: ('0000000000000' + d.replace(/^0/, '66')).slice(-13) };
    const hasAmount = amount > 0;
    let p = tlv('00', '01') + tlv('01', hasAmount ? '12' : '11') + tlv('29', tlv('00', 'A000000677010111') + tlv(t.tag, t.value)) + tlv('58', 'TH') + tlv('53', '764');
    if (hasAmount)
        p += tlv('54', amount.toFixed(2));
    p += '6304';
    return p + crc16(p);
}
const hasPromptpay = () => (PAYMENT.promptpayId || '').replace(/\D/g, '').length >= 10;
/** เลขบัญชีรับเงิน + ปุ่มคัดลอก (ใช้ใต้ QR และในหน้าจ่ายเงินสด) */
function accountBlockHTML() {
    return `<div class="pay-account"><div><small>${escapeHTML(PAYMENT.accountBank)}</small><b>${escapeHTML(PAYMENT.accountNo)}</b><small>${escapeHTML(PAYMENT.payeeName)}</small></div><button type="button" class="secondary small" onclick="copyAccountNo()">คัดลอกเลขบัญชี</button></div>`;
}
function copyAccountNo() {
    const text = PAYMENT.accountNo;
    const done = () => toast('คัดลอกเลขบัญชีแล้ว');
    const fallback = () => {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand('copy');
            done();
        }
        catch {
            toast('คัดลอกไม่สำเร็จ · เลขบัญชี ' + text);
        }
        ta.remove();
    };
    if (navigator.clipboard?.writeText)
        navigator.clipboard.writeText(text).then(done, fallback);
    else
        fallback();
}
function qrModules(text) { const q = qrcode(0, 'M'); q.addData(text); q.make(); return q; }
function qrSvg(text, label) {
    const q = qrModules(text);
    const n = q.getModuleCount();
    const m = 2;
    let d = '';
    for (let r = 0; r < n; r++)
        for (let c = 0; c < n; c++)
            if (q.isDark(r, c))
                d += `M${c + m} ${r + m}h1v1h-1z`;
    return `<svg class="qr-svg" viewBox="0 0 ${n + m * 2} ${n + m * 2}" role="img" aria-label="${escapeHTML(label)}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#111"/></svg>`;
}
/** รูป PNG ของ QR + ยอด สำหรับบันทึกลงเครื่องแล้วเปิดในแอปธนาคาร */
function qrPngBlob(text, caption) {
    const q = qrModules(text);
    const n = q.getModuleCount();
    const cell = 10;
    const m = 4;
    const size = (n + m * 2) * cell;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size + 90;
    const ctx = canvas.getContext('2d');
    if (!ctx)
        return Promise.resolve(null);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#111';
    for (let r = 0; r < n; r++)
        for (let c = 0; c < n; c++)
            if (q.isDark(r, c))
                ctx.fillRect((c + m) * cell, (r + m) * cell, cell, cell);
    ctx.textAlign = 'center';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(caption, size / 2, size + 40);
    ctx.font = '20px sans-serif';
    ctx.fillStyle = '#555';
    ctx.fillText(PAYMENT.payeeName, size / 2, size + 74);
    return new Promise(ok => canvas.toBlob(b => ok(b), 'image/png'));
}
// ---------- ขั้นตอนจ่าย ----------
const selectedPayableBills = () => DEMO.bills.filter(b => selectedBills.has(b.id) && (b.status === 'unpaid' || b.status === 'mismatch'));
const payTotal = () => payBillIds.reduce((n, id) => n + (DEMO.bills.find(b => b.id === id)?.amount || 0), 0);
function newPaymentRef(prefix) {
    const d = new Date();
    const ymd = `${String(d.getFullYear() + 543).slice(-2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    return `${prefix}-${ymd}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
}
const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
modal.addEventListener('close', () => modal.classList.remove('pay-full'));
function openPayment() {
    const items = selectedPayableBills();
    if (!items.length)
        return toast('เลือกเดือนที่ต้องการจ่ายก่อนค่ะ');
    payBillIds = items.map(b => b.id);
    payMethod = hasPromptpay() ? (isMobile() ? 'app' : 'qr') : 'cash';
    clearSlip();
    renderPaymentModal();
    modal.showModal();
}
function setPayMethod(m) { payMethod = m; renderPaymentModal(); }
function slipBoxHTML(optional) {
    const label = slipFile ? 'เปลี่ยนรูปสลิป' : optional ? 'แนบรูปสลิป (ถ้ามี)' : 'แนบรูปสลิป (จำเป็น)';
    return `<div class="slip-box"><label class="upload scan-upload">${label}<input type="file" accept="image/*" onchange="pickSlip(this)"></label>${slipFile ? `<div class="slip-preview"><img src="${slipPreviewUrl}" alt="สลิปที่แนบ"><span>${escapeHTML(slipFile.name)}</span></div>` : ''}</div>`;
}
function renderPaymentModal() {
    const items = DEMO.bills.filter(b => payBillIds.includes(b.id));
    const total = payTotal();
    const grouped = groupBillsByPayerMonth(items);
    const methods = hasPromptpay() ? [['qr', 'สแกน QR'], ['app', 'แอปธนาคาร'], ['cash', 'เงินสด']] : [['cash', 'เงินสด']];
    const tabs = `<div class="pay-methods" role="tablist">${methods.map(([m, label]) => `<button type="button" role="tab" aria-selected="${payMethod === m}" class="${payMethod === m ? 'active' : ''}" onclick="setPayMethod('${m}')">${label}</button>`).join('')}</div>`;
    const summary = `<div class="pay-hero"><small>ยอดที่ต้องชำระ · ${grouped.length} เดือน</small><b>${money(total)} บาท</b></div><div class="payment-months">${grouped.map(g => `<div><span>${escapeHTML(g.month)}</span><b>${money(g.bills.reduce((n, b) => n + b.amount, 0))} บาท</b></div>`).join('')}</div>`;
    const demoNote = PAYMENT.demo ? `<p class="privacy-note">ระบบสาธิต · เลขพร้อมเพย์เป็นเลขตัวอย่าง โอนจริงไม่ได้</p>` : '';
    let body = '', actions = '';
    if (payMethod === 'cash') {
        body = `<div class="cash-info"><b>จ่ายเงินสดที่ ${escapeHTML(PAYMENT.cashPlace)}</b><small>${escapeHTML(PAYMENT.cashHours)}</small><ol><li>กด “ขอเลขอ้างอิง” ด้านล่าง</li><li>แสดงเลขอ้างอิง (หรือ QR) ให้เจ้าหน้าที่</li><li>รับใบเสร็จจากเจ้าหน้าที่</li></ol></div>${accountBlockHTML()}${slipBoxHTML(true)}`;
        actions = `<button class="secondary" onclick="modal.close()">กลับ</button><button onclick="submitCashPayment()">ขอเลขอ้างอิง</button>`;
    }
    else {
        const payload = promptpayPayload(PAYMENT.promptpayId, total, PAYMENT.promptpayType);
        const qrBlock = `<div class="pay-qr">${qrSvg(payload, 'QR พร้อมเพย์ ยอด ' + money(total) + ' บาท')}<b>${money(total)} บาท</b><small>โอนเข้า ${escapeHTML(PAYMENT.payeeName)}</small></div>`;
        const slip = slipBoxHTML(false);
        if (payMethod === 'qr') {
            const save = `<button type="button" class="secondary small save-qr" onclick="saveQrImage()">บันทึกรูป QR ลงเครื่อง</button>`;
            body = qrBlock + accountBlockHTML() + save + `<p class="help">เปิดแอปธนาคาร → สแกน → ส่องที่ QR นี้ (ยอดเงินกรอกให้อัตโนมัติ) หรือบันทึกรูปแล้วเลือกจาก “รูปภาพ/อัลบั้ม” ในแอป</p>` + slip;
        }
        else {
            // แตะโลโก้ = เด้งเข้าแอปทันที · แอปไม่รับยอดจากเว็บ → ในแอปให้สแกน QR จากรูปที่บันทึกไว้
            const logos = `<p class="bank-title">แตะธนาคารที่ใช้ เพื่อเปิดแอป</p><div class="bank-grid">${PAYMENT.banks.map((b, i) => `<button type="button" class="bank-tile" onclick="openBankApp(${i})" aria-label="เปิดแอป${escapeHTML(b.name)}">${b.logo ? `<img src="${escapeHTML(b.logo)}" alt="">` : `<span class="bank-logo" style="background:${b.color};color:${b.ink || '#fff'}">${escapeHTML(b.short)}</span>`}<span>${escapeHTML(b.name)}</span></button>`).join('')}</div>${isMobile() ? '' : '<p class="help">เปิดแอปได้บนมือถือเท่านั้น · บนคอมพิวเตอร์ให้ใช้แท็บ “สแกน QR”</p>'}`;
            body = logos + slip;
        }
        actions = `<button class="secondary" onclick="modal.close()">กลับ</button><button onclick="submitTransferPayment()" ${slipFile ? '' : 'disabled'}>โอนแล้ว ส่งสลิป</button>`;
    }
    modal.classList.add('pay-full');
    modalContent.innerHTML = `<div class="modal-inner"><div class="modal-top pay-top"><button type="button" class="pay-back" onclick="modal.close()">‹ กลับ</button><h2 id="modalTitle">ชำระเงิน</h2><span></span></div><div class="modal-body">${summary}${tabs}${body}${demoNote}</div><div class="modal-actions">${actions}</div></div>`;
}
async function saveQrImage() {
    const total = payTotal();
    const blob = await qrPngBlob(promptpayPayload(PAYMENT.promptpayId, total, PAYMENT.promptpayType), `${money(total)} บาท`);
    if (!blob)
        return toast('สร้างรูป QR ไม่สำเร็จ');
    const file = new File([blob], `qr-ค่าแผง-${money(total)}.png`, { type: 'image/png' });
    const nav = navigator;
    // มือถือ: เปิดแผ่นแชร์ → "บันทึกรูปภาพ" (iPhone ดาวน์โหลดตรงไม่ได้)
    if (nav.canShare?.({ files: [file] })) {
        try {
            await navigator.share({ files: [file], title: 'QR ชำระค่าแผง' });
            return;
        }
        catch (e) {
            if (e.name === 'AbortError')
                return;
        }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('บันทึกรูป QR แล้ว');
}
function openBankApp(i) {
    const bank = PAYMENT.banks[i];
    if (!bank)
        return;
    if (!isMobile())
        return toast('เปิดแอปธนาคารได้บนมือถือเท่านั้น');
    let left = false;
    const onHide = () => { if (document.hidden)
        left = true; };
    document.addEventListener('visibilitychange', onHide);
    window.location.href = bank.scheme;
    setTimeout(() => { document.removeEventListener('visibilitychange', onHide); if (!left)
        toast(`เปิด ${bank.name} ไม่ได้ · เครื่องอาจไม่มีแอปนี้ ลองเปิดแอปเอง`); }, 1800);
}
function clearSlip() { if (slipPreviewUrl)
    URL.revokeObjectURL(slipPreviewUrl); slipFile = null; slipPreviewUrl = ''; }
function pickSlip(input) {
    const f = input.files?.[0];
    if (!f)
        return;
    if (!f.type.startsWith('image/'))
        return toast('แนบได้เฉพาะรูปภาพ');
    if (f.size > 10 * 1024 * 1024)
        return toast('รูปใหญ่เกิน 10 MB');
    clearSlip();
    slipFile = f;
    slipPreviewUrl = URL.createObjectURL(f);
    renderPaymentModal();
}
let billSubmitter = null;
function recordPayment(status, ref) {
    const all = loadPaymentRecords();
    const at = new Date().toISOString();
    const amount = payTotal();
    for (const id of payBillIds) {
        const b = DEMO.bills.find(x => x.id === id);
        if (!b)
            continue;
        b.status = status;
        all[id] = { status, method: payMethod, ref, at, amount, slipName: slipFile?.name, meta: { t: b.payerType, s: b.stall || b.ref, k: b.kind, m: b.month } };
    }
    writePaymentRecords(all);
}
async function submitTransferPayment() {
    if (!slipFile)
        return toast('แนบรูปสลิปก่อนส่งค่ะ');
    if (billSubmitter) {
        const res = await billSubmitter(payBillIds, 'transfer', slipFile);
        if (!res)
            return;
        clearSlip();
        resetSelection();
        modal.close();
        toast(res.status === 'paid' ? 'ตรวจสลิปผ่านแล้ว · ชำระเรียบร้อย' : res.reason ? `ส่งสลิปแล้ว · ${res.reason}` : 'ส่งสลิปแล้ว · รอเจ้าหน้าที่ตรวจสอบ');
        render();
        return;
    }
    recordPayment('pending', newPaymentRef('TRF'));
    clearSlip();
    resetSelection();
    modal.close();
    toast('ส่งสลิปแล้ว · รอเจ้าหน้าที่ตรวจสอบ');
    render();
}
async function submitCashPayment() {
    if (billSubmitter) {
        const total = payTotal();
        const res = await billSubmitter(payBillIds, 'cash', null);
        if (!res)
            return;
        clearSlip();
        resetSelection();
        render();
        showCashTicket(newPaymentRef('CSH'), total);
        return;
    }
    payRef = newPaymentRef('CSH');
    const total = payTotal();
    recordPayment('cash', payRef);
    clearSlip();
    resetSelection();
    render();
    showCashTicket(payRef, total);
}
/** ใบนัดจ่ายเงินสด — เปิดซ้ำได้จากการ์ดเดือนที่สถานะ "รอจ่ายเงินสด" */
function showCashTicket(ref, amount) {
    const ids = Object.entries(loadPaymentRecords()).filter(([, r]) => r.ref === ref).map(([id]) => id);
    const total = amount ?? ids.reduce((n, id) => n + (DEMO.bills.find(b => b.id === id)?.amount || 0), 0);
    modalContent.innerHTML = `<div class="modal-inner"><div class="modal-top"><h2 id="modalTitle">เลขอ้างอิงจ่ายเงินสด</h2><button class="close-btn" onclick="modal.close()" aria-label="ปิด">×</button></div><div class="modal-body"><div class="pay-qr">${qrSvg(ref, 'QR เลขอ้างอิง ' + ref)}<b class="cash-ref">${escapeHTML(ref)}</b><small>ยอด ${money(total)} บาท</small></div><div class="cash-info"><b>นำไปจ่ายที่ ${escapeHTML(PAYMENT.cashPlace)}</b><small>${escapeHTML(PAYMENT.cashHours)}</small><small>แคปหน้าจอนี้ไว้ แสดงให้เจ้าหน้าที่ตอนจ่าย</small></div></div><div class="modal-actions"><button class="secondary" onclick="cancelCashPayment('${escapeHTML(ref)}')">เปลี่ยนวิธีจ่าย</button><button onclick="modal.close()">เรียบร้อย</button></div></div>`;
    if (!modal.open)
        modal.showModal();
}
function cancelCashPayment(ref) {
    const all = loadPaymentRecords();
    for (const [id, r] of Object.entries(all)) {
        if (r.ref !== ref || r.status !== 'cash')
            continue;
        delete all[id];
        const b = DEMO.bills.find(x => x.id === id);
        if (b && b.status === 'cash')
            b.status = 'unpaid';
    }
    writePaymentRecords(all);
    modal.close();
    toast('ยกเลิกเลขอ้างอิงแล้ว · เลือกวิธีจ่ายใหม่ได้');
    render();
}
let qrStream = null, qrFrame = 0, qrOnCode = () => { };
function loadScript(src) { return new Promise((ok, fail) => { const s = document.createElement('script'); s.src = src; s.onload = () => ok(); s.onerror = () => fail(new Error(src)); document.head.appendChild(s); }); }
function stopQrCamera() { if (qrFrame)
    cancelAnimationFrame(qrFrame); qrFrame = 0; qrStream?.getTracks().forEach(track => track.stop()); qrStream = null; }
function finishQrScan(raw) { stopQrCamera(); modal.close(); qrOnCode(raw); }
function qrDemoPick(code) { finishQrScan(code); }
function qrPickHTML() { return '<label class="qr-demo qr-pick">เลือกรูป QR จากเครื่อง<input type="file" accept="image/*" hidden onchange="pickQrImage(this)"></label>'; }
// iPhone/Safari/Firefox ไม่มี BarcodeDetector → อ่านเฟรมกล้องด้วย jsQR (โหลดเฉพาะตอนต้องใช้)
async function jsQrDetector() { if (typeof jsQR === 'undefined')
    await loadScript('/citizen-pay/shared/vendor/jsQR.js'); const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d', { willReadFrequently: true }); return { async detect(source) { const v = source; if (!ctx || !v.videoWidth)
        return []; const scale = Math.min(1, 640 / Math.max(v.videoWidth, v.videoHeight)); canvas.width = Math.round(v.videoWidth * scale); canvas.height = Math.round(v.videoHeight * scale); ctx.drawImage(v, 0, 0, canvas.width, canvas.height); const img = ctx.getImageData(0, 0, canvas.width, canvas.height); const hit = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' }); return hit ? [{ rawValue: hit.data }] : []; } }; }
async function readQrFrame(video, detector) { if (!qrStream)
    return; if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    try {
        const code = (await detector.detect(video))[0]?.rawValue;
        if (code) {
            finishQrScan(code);
            return;
        }
    }
    catch {
        stopQrCamera();
        modal.close();
        toast('อ่าน QR ไม่สำเร็จ · ลองเลือกรูป QR จากเครื่อง');
        return;
    }
} qrFrame = requestAnimationFrame(() => void readQrFrame(video, detector)); }
// เลือกรูป QR จากอัลบั้ม/กล้องของมือถือ → อ่านด้วย jsQR แล้วส่งค่าเข้า onCode เหมือนสแกนสด
async function pickQrImage(input) { const file = input.files?.[0]; input.value = ''; if (!file)
    return; if (!file.type.startsWith('image/'))
    return toast('เลือกได้เฉพาะรูปภาพ'); if (file.size > 10 * 1024 * 1024)
    return toast('รูปใหญ่เกิน 10 MB'); try {
    if (typeof jsQR === 'undefined')
        await loadScript('/citizen-pay/shared/vendor/jsQR.js');
}
catch {
    return toast('โหลดตัวอ่าน QR ไม่สำเร็จ');
} const url = URL.createObjectURL(file); try {
    const img = await new Promise((ok, fail) => { const el = new Image(); el.onload = () => ok(el); el.onerror = () => fail(new Error('image')); el.src = url; });
    const scale = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx)
        throw new Error('context');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const hit = jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: 'attemptBoth' });
    if (!hit)
        return toast('ไม่พบ QR ในรูปนี้ · ลองเลือกรูปที่เห็น QR ชัดขึ้น');
    finishQrScan(hit.data);
}
catch {
    toast('เปิดรูปนี้ไม่ได้ · ลองเลือกรูปอื่น');
}
finally {
    URL.revokeObjectURL(url);
} }
function qrFallbackContent(o, message) { return `<div class="modal-inner"><div class="modal-top"><h2 id="modalTitle">${escapeHTML(o.title)}</h2><button class="close-btn" onclick="modal.close()" aria-label="ปิด">×</button></div><div class="modal-body"><p class="help">${escapeHTML(message)}</p>${qrPickHTML()}<button class="qr-demo" onclick="qrDemoPick('${escapeHTML(o.demoCode)}')">${escapeHTML(o.demoLabel)}</button></div></div>`; }
async function startQrScan(o) { qrOnCode = o.onCode; const Detector = window.BarcodeDetector; if (!navigator.mediaDevices?.getUserMedia) {
    modalContent.innerHTML = qrFallbackContent(o, 'เบราว์เซอร์นี้เปิดกล้องสแกนไม่ได้ · เลือกรูป QR จากเครื่องหรือลองยอดตัวอย่าง');
    modal.showModal();
    return;
} modalContent.innerHTML = `<div class="modal-inner"><div class="modal-top"><h2 id="modalTitle">${escapeHTML(o.title)}</h2><button class="close-btn" onclick="modal.close()" aria-label="ปิด">×</button></div><div class="modal-body"><video id="qrVideo" class="qr-video" autoplay playsinline muted></video><p class="help">${escapeHTML(o.help)}</p>${qrPickHTML()}<button class="qr-demo" onclick="qrDemoPick('${escapeHTML(o.demoCode)}')">${escapeHTML(o.demoLabel)}</button></div></div>`; modal.showModal(); try {
    const detector = Detector ? new Detector({ formats: ['qr_code'] }) : await jsQrDetector();
    qrStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    if (!modal.open) {
        stopQrCamera();
        return;
    }
    const video = modalContent.querySelector('#qrVideo');
    if (!video) {
        stopQrCamera();
        return;
    }
    video.srcObject = qrStream;
    await video.play();
    qrFrame = requestAnimationFrame(() => void readQrFrame(video, detector));
}
catch {
    stopQrCamera();
    modalContent.innerHTML = qrFallbackContent(o, 'เปิดกล้องไม่ได้ · ตรวจสิทธิ์กล้อง หรือเลือกรูป QR จากเครื่อง');
    if (!modal.open)
        modal.showModal();
} }
modal.addEventListener('close', stopQrCamera);
// เดโม่: ซิงก์ข้อมูลฝั่งประชาชน (คีย์ localStorage ด้านล่าง) ข้ามเครื่องผ่านตาราง demo_kv ใน Supabase
// ไม่มีค่า KV_CONFIG (ไม่ได้ตั้ง env / ระบบจริง) = ไม่ทำอะไรเลย · ดึงจากฐานกลางก่อน แล้วค่อยเขียนกลับเมื่อมีการเปลี่ยนแปลง
// ไฟล์นี้เป็น script ไม่ใช่ module (หน้า static รวมด้วย outFile) จึงห่อใน IIFE และตั้ง window.smartKvInit ให้หน้า Next เรียกได้
(function () {
    const KV_KEYS = ['market:payments', 'lamplaimat:demo-reservations', 'lamplaimat:demo-outside-apps', 'lamplaimat:demo-stalls', 'lamplaimat:outside-locations', 'market:rates'];
    const RELOAD_FLAG = 'kv:reloaded';
    const rawSet = Storage.prototype.setItem;
    const rawRemove = Storage.prototype.removeItem;
    let cfg = null;
    let pulling = false;
    let ready = false; // ยังไม่ดึงข้อมูลกลาง = ยังไม่ส่งอะไรขึ้น (กันทับข้อมูลใหม่ด้วยค่าเก่า)
    const timers = {};
    const headersOf = (c) => ({ apikey: c.key, 'Content-Type': 'application/json' });
    function localValue(k) {
        const raw = localStorage.getItem(k);
        if (raw === null)
            return null;
        try {
            return JSON.parse(raw);
        }
        catch {
            return null;
        }
    }
    function push(k) {
        if (!cfg)
            return;
        const body = JSON.stringify([{ key: k, value: localValue(k), updated_at: new Date().toISOString() }]);
        fetch(`${cfg.url}/rest/v1/demo_kv`, { method: 'POST', headers: { ...headersOf(cfg), Prefer: 'resolution=merge-duplicates' }, body }).catch(() => { });
    }
    function schedule(k) {
        if (pulling || !ready || !KV_KEYS.includes(k))
            return;
        clearTimeout(timers[k]);
        timers[k] = setTimeout(() => push(k), 300);
    }
    function installShim() {
        Storage.prototype.setItem = function (k, v) { rawSet.call(this, k, v); if (this === localStorage)
            schedule(k); };
        Storage.prototype.removeItem = function (k) { rawRemove.call(this, k); if (this === localStorage)
            schedule(k); };
    }
    /** ดึงข้อมูลกลางลงเครื่อง · ถ้ามีค่าเปลี่ยน (หน้าเปิดค่าไว้ตั้งแต่ก่อนดึง) โหลดหน้าใหม่ 1 ครั้ง */
    async function initKv(c) {
        if (!c?.url || !c.key || typeof localStorage === 'undefined')
            return;
        cfg = c;
        installShim();
        try {
            const list = encodeURIComponent(KV_KEYS.map((k) => `"${k}"`).join(','));
            const r = await fetch(`${c.url}/rest/v1/demo_kv?select=key,value&key=in.(${list})`, { headers: headersOf(c), cache: 'no-store' });
            if (!r.ok)
                return;
            const remote = new Map((await r.json()).map((x) => [x.key, x.value]));
            let changed = false;
            pulling = true;
            try {
                for (const k of KV_KEYS) {
                    if (remote.has(k)) {
                        const v = remote.get(k);
                        const next = v === null ? null : JSON.stringify(v);
                        if (next === localStorage.getItem(k))
                            continue;
                        changed = true;
                        if (next === null)
                            rawRemove.call(localStorage, k);
                        else
                            rawSet.call(localStorage, k, next);
                    }
                    else if (localStorage.getItem(k) !== null)
                        push(k); // ฐานกลางยังไม่มีค่านี้ → ส่งของในเครื่องขึ้นไป
                }
            }
            finally {
                pulling = false;
            }
            ready = true;
            try {
                if (changed && !sessionStorage.getItem(RELOAD_FLAG)) {
                    sessionStorage.setItem(RELOAD_FLAG, '1');
                    location.reload();
                    return;
                }
                sessionStorage.removeItem(RELOAD_FLAG);
            }
            catch { /* โหมดส่วนตัว: ไม่รีโหลดซ้ำ */ }
        }
        catch { /* เชื่อมฐานกลางไม่ได้ → ใช้ข้อมูลในเครื่อง ไม่ส่งขึ้น */ }
    }
    const w = window;
    w.smartKvInit = initKv;
    if (w.KV_CONFIG)
        void initKv(w.KV_CONFIG);
})();
// ราคาที่เจ้าหน้าที่ตั้งไว้ (ค่าเช่าแผงประจำรายแถว + ค่าขยะแผง) เก็บในเครื่องนี้ (localStorage) · หน้าประชาชนอ่านตอนเปิดหน้า
// ค่าที่ไม่ถูกต้องจะถูกข้าม แล้วใช้ค่าตั้งต้นแทน · ยังไม่มี backend
const MARKET_RATES_KEY = 'market:rates';
function applyStoredRates(planRows, rates) {
    try {
        const raw = JSON.parse(localStorage.getItem(MARKET_RATES_KEY) || 'null');
        if (!raw || typeof raw !== 'object')
            return;
        for (const row of planRows) {
            const value = Number(raw.rows?.[row.id]);
            if (Number.isFinite(value) && value >= 0)
                row.monthlyRate = value;
        }
        const waste = Number(raw.stallWaste);
        if (Number.isFinite(waste) && waste >= 0)
            rates.stallWaste = waste;
    }
    catch { }
}
function saveStoredRates(planRows, rates) {
    const rows = {};
    for (const row of planRows)
        rows[row.id] = Number(row.monthlyRate) || 0;
    try {
        localStorage.setItem(MARKET_RATES_KEY, JSON.stringify({ rows, stallWaste: rates.stallWaste }));
    }
    catch { }
}
const MARKET_PLAN = ['A', 'B', 'C', 'D', 'E'].map((id, index) => ({ id, count: 10, monthlyRate: [1200, 900, 1500, 1200, 1050][index] }));
// ข้อมูลจำลอง: ผู้เช่า/ผู้จองของแต่ละล็อก (ชื่อสมมติ ไม่ใช่ข้อมูลจริง)
const TENANT_BY_STALL = {
    A01: 'นางสาวศิริพร ทองดี', A02: 'นายประเสริฐ ศรีสุข', A03: 'นางอำไพ บุญรอด', A04: 'นายธนพล วงศ์ษา', A05: 'นายบุญมี คำไหล',
    A06: 'นางสมใจ ใจดี', A08: 'นางสาวกัญญา พิมพ์ดี', B02: 'นายวิทยา แซ่ลี้', B04: 'นางมะลิ แสงทอง', B05: 'นางสาวนภัส ใจงาม',
    B07: 'นายสมชาย ไทยเจริญ', C03: 'นายวิชัย ผักสด', C06: 'นางพัชรี ขำดี', C08: 'นายอนันต์ ทองสุข', D01: 'นางจันทร์เพ็ญ สุขใจ',
    D07: 'นางสาวปิยนุช รักงาม', E04: 'นางสาวอรทัย ศรีงาม', E09: 'นางราตรี ผักสด'
};
const OCCUPIED_STALLS = new Set(['A01', 'A02', 'A03', 'A05', 'A06', 'A08', 'B02', 'B04', 'B07', 'C03', 'C06', 'D01', 'E09']);
const RESERVED_STALLS = new Set(['A04', 'B05', 'C08', 'D07', 'E04']);
const DEMO = {
    rates: { regularRent: 1200, stallWaste: 30 },
    outsideLocations: [
        { id: 'LOC-01', name: 'ลานหน้าตลาด', rentRate: 500, rentPeriod: 'monthly', enabled: true, deleted: false, tenants: [{ name: 'นางบัวผัน เจริญสุข', paid: false }, { name: 'นายทองใบ ศรีสว่าง', paid: true }, { name: 'นางสาวลัดดา แก้วกาญจน์', paid: true }] },
        { id: 'LOC-02', name: 'ลานชุมชน', rentRate: 80, rentPeriod: 'daily', enabled: true, deleted: false, tenants: [{ name: 'นางสาวรัตนา ฟ้าใส', paid: false }, { name: 'นายสุรชัย ทองคำ', paid: true }] }
    ],
    planRows: MARKET_PLAN,
    bills: [
        // ---- แผง A ----
        { id: 'INV-2569-08-018', payerType: 'stall', merchant: 'นางสมใจ ใจดี', ref: 'LM-021', stall: 'A06', kind: 'ค่าเช่าแผง', month: 'สิงหาคม 2569', due: '31 ส.ค. 2569', amount: 1200, status: 'unpaid' },
        { id: 'INV-2569-08-019', payerType: 'stall', merchant: 'นางสมใจ ใจดี', ref: 'LM-021', stall: 'A06', kind: 'ค่าขยะ', month: 'สิงหาคม 2569', due: '31 ส.ค. 2569', amount: 30, status: 'unpaid' },
        { id: 'INV-2569-09-006', payerType: 'stall', merchant: 'นางสมใจ ใจดี', ref: 'LM-021', stall: 'A06', kind: 'ค่าเช่าแผง', month: 'กันยายน 2569', due: 'ชำระแล้ว', amount: 1200, status: 'confirmed' },
        { id: 'INV-2569-09-020', payerType: 'stall', merchant: 'นางสมใจ ใจดี', ref: 'LM-021', stall: 'A06', kind: 'ค่าขยะ', month: 'กันยายน 2569', due: '30 ก.ย. 2569', amount: 30, status: 'unpaid' },
        { id: 'INV-2569-10-018', payerType: 'stall', merchant: 'นางสมใจ ใจดี', ref: 'LM-021', stall: 'A06', kind: 'ค่าเช่าแผง', month: 'ตุลาคม 2569', due: '31 ต.ค. 2569', amount: 1200, status: 'unpaid' },
        { id: 'INV-2569-10-019', payerType: 'stall', merchant: 'นางสมใจ ใจดี', ref: 'LM-021', stall: 'A06', kind: 'ค่าขยะ', month: 'ตุลาคม 2569', due: '31 ต.ค. 2569', amount: 30, status: 'unpaid' },
        { id: 'INV-2569-09-033', payerType: 'stall', merchant: 'นายบุญมี คำไหล', ref: 'LM-025', stall: 'A05', kind: 'ค่าเช่าแผง', month: 'กันยายน 2569', due: '30 ก.ย. 2569', amount: 1200, status: 'unpaid' },
        { id: 'INV-2569-09-034', payerType: 'stall', merchant: 'นายบุญมี คำไหล', ref: 'LM-025', stall: 'A05', kind: 'ค่าขยะ', month: 'กันยายน 2569', due: '30 ก.ย. 2569', amount: 30, status: 'unpaid' },
        { id: 'INV-2569-10-035', payerType: 'stall', merchant: 'นายบุญมี คำไหล', ref: 'LM-025', stall: 'A05', kind: 'ค่าเช่าแผง', month: 'ตุลาคม 2569', due: '31 ต.ค. 2569', amount: 1200, status: 'unpaid' },
        { id: 'INV-2569-10-036', payerType: 'stall', merchant: 'นายบุญมี คำไหล', ref: 'LM-025', stall: 'A05', kind: 'ค่าขยะ', month: 'ตุลาคม 2569', due: '31 ต.ค. 2569', amount: 30, status: 'unpaid' },
        { id: 'INV-2569-10-001', payerType: 'stall', merchant: 'นางสาวศิริพร ทองดี', ref: 'LM-001', stall: 'A01', kind: 'ค่าเช่าแผง', month: 'ตุลาคม 2569', due: 'ชำระแล้ว', amount: 1200, status: 'confirmed' },
        { id: 'INV-2569-10-002', payerType: 'stall', merchant: 'นางสาวศิริพร ทองดี', ref: 'LM-001', stall: 'A01', kind: 'ค่าขยะ', month: 'ตุลาคม 2569', due: 'ชำระแล้ว', amount: 30, status: 'confirmed' },
        { id: 'INV-2569-10-003', payerType: 'stall', merchant: 'นายประเสริฐ ศรีสุข', ref: 'LM-002', stall: 'A02', kind: 'ค่าเช่าแผง', month: 'ตุลาคม 2569', due: '31 ต.ค. 2569', amount: 1200, status: 'unpaid' },
        { id: 'INV-2569-10-004', payerType: 'stall', merchant: 'นายประเสริฐ ศรีสุข', ref: 'LM-002', stall: 'A02', kind: 'ค่าขยะ', month: 'ตุลาคม 2569', due: '31 ต.ค. 2569', amount: 30, status: 'unpaid' },
        { id: 'INV-2569-10-037', payerType: 'stall', merchant: 'นายธนพล วงศ์ษา', ref: 'LM-004', stall: 'A04', kind: 'ค่าเช่าแผง', month: 'ตุลาคม 2569', due: '31 ต.ค. 2569', amount: 1200, status: 'unpaid' },
        { id: 'INV-2569-10-038', payerType: 'stall', merchant: 'นายธนพล วงศ์ษา', ref: 'LM-004', stall: 'A04', kind: 'ค่าขยะ', month: 'ตุลาคม 2569', due: '31 ต.ค. 2569', amount: 30, status: 'unpaid' },
        { id: 'INV-2569-09-005', payerType: 'stall', merchant: 'นางอำไพ บุญรอด', ref: 'LM-003', stall: 'A03', kind: 'ค่าเช่าแผง', month: 'กันยายน 2569', due: '30 ก.ย. 2569', amount: 1200, status: 'unpaid' },
        { id: 'INV-2569-09-007', payerType: 'stall', merchant: 'นางอำไพ บุญรอด', ref: 'LM-003', stall: 'A03', kind: 'ค่าขยะ', month: 'กันยายน 2569', due: '30 ก.ย. 2569', amount: 30, status: 'unpaid' },
        { id: 'INV-2569-10-008', payerType: 'stall', merchant: 'นางอำไพ บุญรอด', ref: 'LM-003', stall: 'A03', kind: 'ค่าเช่าแผง', month: 'ตุลาคม 2569', due: '31 ต.ค. 2569', amount: 1200, status: 'unpaid' },
        { id: 'INV-2569-10-009', payerType: 'stall', merchant: 'นางอำไพ บุญรอด', ref: 'LM-003', stall: 'A03', kind: 'ค่าขยะ', month: 'ตุลาคม 2569', due: '31 ต.ค. 2569', amount: 30, status: 'unpaid' },
        { id: 'INV-2569-10-010', payerType: 'stall', merchant: 'นางสาวกัญญา พิมพ์ดี', ref: 'LM-028', stall: 'A08', kind: 'ค่าเช่าแผง', month: 'ตุลาคม 2569', due: '31 ต.ค. 2569', amount: 1200, status: 'unpaid' },
        { id: 'INV-2569-10-011', payerType: 'stall', merchant: 'นางสาวกัญญา พิมพ์ดี', ref: 'LM-028', stall: 'A08', kind: 'ค่าขยะ', month: 'ตุลาคม 2569', due: '31 ต.ค. 2569', amount: 30, status: 'unpaid' },
        // ---- แผง B ----
        { id: 'INV-2569-10-022', payerType: 'stall', merchant: 'นางมะลิ แสงทอง', ref: 'LM-008', stall: 'B04', kind: 'ค่าเช่าแผง', month: 'ตุลาคม 2569', due: '31 ต.ค. 2569', amount: 900, status: 'pending' },
        { id: 'INV-2569-10-023', payerType: 'stall', merchant: 'นางมะลิ แสงทอง', ref: 'LM-008', stall: 'B04', kind: 'ค่าขยะ', month: 'ตุลาคม 2569', due: '31 ต.ค. 2569', amount: 30, status: 'unpaid' },
        { id: 'INV-2569-10-012', payerType: 'stall', merchant: 'นายวิทยา แซ่ลี้', ref: 'LM-011', stall: 'B02', kind: 'ค่าเช่าแผง', month: 'ตุลาคม 2569', due: 'ชำระแล้ว', amount: 900, status: 'confirmed' },
        { id: 'INV-2569-10-013', payerType: 'stall', merchant: 'นายวิทยา แซ่ลี้', ref: 'LM-011', stall: 'B02', kind: 'ค่าขยะ', month: 'ตุลาคม 2569', due: 'ชำระแล้ว', amount: 30, status: 'confirmed' },
        { id: 'INV-2569-08-014', payerType: 'stall', merchant: 'นายสมชาย ไทยเจริญ', ref: 'LM-013', stall: 'B07', kind: 'ค่าเช่าแผง', month: 'สิงหาคม 2569', due: '31 ส.ค. 2569', amount: 900, status: 'unpaid' },
        { id: 'INV-2569-08-015', payerType: 'stall', merchant: 'นายสมชาย ไทยเจริญ', ref: 'LM-013', stall: 'B07', kind: 'ค่าขยะ', month: 'สิงหาคม 2569', due: '31 ส.ค. 2569', amount: 30, status: 'unpaid' },
        { id: 'INV-2569-09-016', payerType: 'stall', merchant: 'นายสมชาย ไทยเจริญ', ref: 'LM-013', stall: 'B07', kind: 'ค่าเช่าแผง', month: 'กันยายน 2569', due: '30 ก.ย. 2569', amount: 900, status: 'unpaid' },
        { id: 'INV-2569-09-017', payerType: 'stall', merchant: 'นายสมชาย ไทยเจริญ', ref: 'LM-013', stall: 'B07', kind: 'ค่าขยะ', month: 'กันยายน 2569', due: '30 ก.ย. 2569', amount: 30, status: 'unpaid' },
        { id: 'INV-2569-10-101', payerType: 'stall', merchant: 'นายสมชาย ไทยเจริญ', ref: 'LM-013', stall: 'B07', kind: 'ค่าเช่าแผง', month: 'ตุลาคม 2569', due: '31 ต.ค. 2569', amount: 900, status: 'unpaid' },
        { id: 'INV-2569-10-102', payerType: 'stall', merchant: 'นายสมชาย ไทยเจริญ', ref: 'LM-013', stall: 'B07', kind: 'ค่าขยะ', month: 'ตุลาคม 2569', due: '31 ต.ค. 2569', amount: 30, status: 'unpaid' },
        { id: 'INV-2569-10-106', payerType: 'stall', merchant: 'นางสาวนภัส ใจงาม', ref: 'LM-041', stall: 'B05', kind: 'ค่าเช่าแผง', month: 'ตุลาคม 2569', due: '31 ต.ค. 2569', amount: 900, status: 'pending' },
        { id: 'INV-2569-10-107', payerType: 'stall', merchant: 'นางสาวนภัส ใจงาม', ref: 'LM-041', stall: 'B05', kind: 'ค่าขยะ', month: 'ตุลาคม 2569', due: '31 ต.ค. 2569', amount: 30, status: 'pending' },
        // ---- แผง C ----
        { id: 'INV-2569-10-025', payerType: 'stall', merchant: 'นายวิชัย ผักสด', ref: 'LM-015', stall: 'C03', kind: 'ค่าเช่าแผง', month: 'ตุลาคม 2569', due: '31 ต.ค. 2569', amount: 1500, status: 'mismatch' },
        { id: 'INV-2569-10-103', payerType: 'stall', merchant: 'นางพัชรี ขำดี', ref: 'LM-017', stall: 'C06', kind: 'ค่าเช่าแผง', month: 'ตุลาคม 2569', due: '31 ต.ค. 2569', amount: 1500, status: 'unpaid' },
        { id: 'INV-2569-10-104', payerType: 'stall', merchant: 'นางพัชรี ขำดี', ref: 'LM-017', stall: 'C06', kind: 'ค่าขยะ', month: 'ตุลาคม 2569', due: '31 ต.ค. 2569', amount: 30, status: 'unpaid' },
        { id: 'INV-2569-10-108', payerType: 'stall', merchant: 'นายอนันต์ ทองสุข', ref: 'LM-042', stall: 'C08', kind: 'ค่าเช่าแผง', month: 'ตุลาคม 2569', due: '31 ต.ค. 2569', amount: 1500, status: 'unpaid' },
        // ---- แผง D ----
        { id: 'INV-2569-10-105', payerType: 'stall', merchant: 'นางจันทร์เพ็ญ สุขใจ', ref: 'LM-004', stall: 'D01', kind: 'ค่าเช่าแผง', month: 'ตุลาคม 2569', due: 'ชำระแล้ว', amount: 1200, status: 'confirmed' },
        { id: 'INV-2569-10-109', payerType: 'stall', merchant: 'นางจันทร์เพ็ญ สุขใจ', ref: 'LM-004', stall: 'D01', kind: 'ค่าขยะ', month: 'ตุลาคม 2569', due: 'ชำระแล้ว', amount: 30, status: 'confirmed' },
        // ---- แผง E ----
        { id: 'INV-2569-10-031', payerType: 'stall', merchant: 'นางราตรี ผักสด', ref: 'LM-032', stall: 'E09', kind: 'ค่าเช่าแผง', month: 'ตุลาคม 2569', due: '31 ต.ค. 2569', amount: 1050, status: 'unpaid' },
        { id: 'INV-2569-10-032', payerType: 'stall', merchant: 'นางราตรี ผักสด', ref: 'LM-032', stall: 'E09', kind: 'ค่าขยะ', month: 'ตุลาคม 2569', due: '31 ต.ค. 2569', amount: 30, status: 'unpaid' },
        // ---- แผงลอยนอกผัง (ค้างตามผู้เช่าที่ยังไม่จ่าย) ----
        { id: 'INV-2569-10-201', payerType: 'stall', merchant: 'นางบัวผัน เจริญสุข', ref: 'LP-01', location: 'ลานหน้าตลาด', kind: 'ค่าเช่าแผงลอย', month: 'ตุลาคม 2569', due: '31 ต.ค. 2569', amount: 500, status: 'unpaid' },
        { id: 'INV-2569-10-202', payerType: 'stall', merchant: 'นางสาวรัตนา ฟ้าใส', ref: 'LC-02', location: 'ลานชุมชน', kind: 'ค่าเช่าแผงลอยรายวัน', month: 'ตุลาคม 2569', due: '27 ต.ค. 2569', amount: 80, status: 'unpaid' },
    ],
    stalls: MARKET_PLAN.flatMap(row => Array.from({ length: row.count }, (_, i) => { const id = `${row.id}${String(i + 1).padStart(2, '0')}`; const status = OCCUPIED_STALLS.has(id) ? 'occupied' : RESERVED_STALLS.has(id) ? 'reserved' : 'available'; return { id, row: row.id, active: true, status, tenantName: status === 'available' ? undefined : TENANT_BY_STALL[id] }; })),
    events: [
        { id: 'EV-092', title: 'ตลาดนัดของดีชุมชน', date: '26', month: 'ต.ค.', place: 'ลานอเนกประสงค์', slots: 24, booked: 18, fee: 90 },
        { id: 'EV-095', title: 'งานลอยกระทง', date: '05', month: 'พ.ย.', place: 'ลานหน้าที่ทำการ อบต.', slots: 40, booked: 12, fee: 120 }
    ]
};
function dateParts(isoDate) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
    if (!match)
        throw new RangeError('วันที่ต้องอยู่ในรูปแบบ YYYY-MM-DD');
    const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
    const daysInMonth = daysInCalendarMonth(year, month);
    if (month < 1 || month > 12 || day < 1 || day > daysInMonth)
        throw new RangeError('วันที่ไม่ถูกต้อง');
    return { year, month, day, daysInMonth };
}
function daysInCalendarMonth(year, month) { const lastDay = new Date(0); lastDay.setUTCFullYear(year, month, 0); return lastDay.getUTCDate(); }
function calendarDaysInMonth(isoDate) { return dateParts(isoDate).daysInMonth; }
function dailyWasteRate(monthlyWasteRate, isoDate) { return monthlyWasteRate / calendarDaysInMonth(isoDate); }
function calculateFirstCharge(rentRate, monthlyWasteRate, period, startDate, durationDays = 1) {
    if (!Number.isFinite(rentRate) || rentRate < 0 || !Number.isFinite(monthlyWasteRate) || monthlyWasteRate < 0)
        throw new RangeError('อัตราค่าบริการต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป');
    if (period !== 'daily' && period !== 'monthly')
        throw new RangeError('รอบเก็บเงินไม่ถูกต้อง');
    const start = dateParts(startDate);
    if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 365)
        throw new RangeError('จำนวนวันเช่าต้องอยู่ระหว่าง 1–365 วัน');
    if (period === 'monthly')
        return Math.round((rentRate + monthlyWasteRate) * (start.daysInMonth - start.day + 1) / start.daysInMonth);
    let remainingDays = durationDays, year = start.year, month = start.month, day = start.day, wasteTotal = 0;
    while (remainingDays > 0) {
        const daysInMonth = daysInCalendarMonth(year, month);
        const chargedDays = Math.min(remainingDays, daysInMonth - day + 1);
        wasteTotal += monthlyWasteRate * chargedDays / daysInMonth;
        remainingDays -= chargedDays;
        day = 1;
        if (month === 12) {
            year++;
            month = 1;
        }
        else
            month++;
    }
    return Math.round(rentRate * durationDays + wasteTotal);
}
function byId(id) { const element = window.document.getElementById(id); if (!element)
    throw new Error(`Missing #${id}`); return element; }
const app = byId('app');
const nav = byId('bottomNav');
function validOutsideLocations(value) { return Array.isArray(value) && value.every((location) => { if (!location || typeof location !== 'object')
    return false; const item = location; return typeof item.id === 'string' && item.id.length > 0 && item.id.length <= 64 && typeof item.name === 'string' && item.name.length <= 60 && Number.isFinite(item.rentRate) && item.rentRate >= 0 && (item.rentPeriod === 'daily' || item.rentPeriod === 'monthly') && typeof item.enabled === 'boolean' && typeof item.deleted === 'boolean' && Array.isArray(item.tenants) && item.tenants.every(tenant => tenant && typeof tenant.name === 'string' && tenant.name.length <= 100 && typeof tenant.paid === 'boolean'); }); }
function loadOutsideLocations() { try {
    const stored = localStorage.getItem('lamplaimat:outside-locations');
    if (stored) {
        const value = JSON.parse(stored);
        if (validOutsideLocations(value))
            return value;
    }
}
catch { } return DEMO.outsideLocations; }
function saveOutsideLocations() { try {
    localStorage.setItem('lamplaimat:outside-locations', JSON.stringify(DEMO.outsideLocations));
}
catch { } }
DEMO.outsideLocations = loadOutsideLocations();
applyStoredRates(DEMO.planRows, DEMO.rates);
const savedPageState = (() => { try {
    const savedView = sessionStorage.getItem('demo:view');
    const savedArea = sessionStorage.getItem('demo:stallArea');
    const savedStall = sessionStorage.getItem('demo:selectedStall');
    const validViews = ['home', 'dues', 'stalls', 'signup'];
    return { view: location.hash === '#dues' ? 'dues' : location.hash === '#stalls' ? 'stalls' : 'home', stallArea: savedArea === 'outside' ? 'outside' : 'regular', paymentMap: sessionStorage.getItem('demo:paymentMap') === '1', selectedStall: savedStall && DEMO.stalls.some(s => s.id === savedStall) ? savedStall : null };
}
catch {
    return { view: 'home', stallArea: 'regular', paymentMap: false, selectedStall: null };
} })();
let view = savedPageState.view, zone = 'A', stallArea = savedPageState.stallArea, selectedStall = savedPageState.selectedStall, signupStallId = null, selectedOutsideLocationId = 'LOC-01';
let paymentMapMode = savedPageState.paymentMap;
let signupLocationId = null;
function openOutsideLocations() { return DEMO.outsideLocations.filter(location => location.enabled && !location.deleted); }
function outsideLocationIsOpen(id) { return openOutsideLocations().some(location => location.id === id); }
function savePageState() { try {
    sessionStorage.setItem('demo:view', view);
    sessionStorage.setItem('demo:stallArea', stallArea);
    sessionStorage.setItem('demo:paymentMap', paymentMapMode ? '1' : '0');
    sessionStorage.setItem('demo:selectedStall', selectedStall || '');
}
catch { } }
function openPaymentMap() { paymentMapMode = true; stallArea = 'regular'; selectedStall = null; setPage('stalls'); }
function cancelPaymentMap() { paymentMapMode = false; setPage('dues'); }
function selectStall(id) { const stall = findStall(id); if (paymentMapMode) {
    selectedStall = id;
    savePageState();
    render();
    modalContent.innerHTML = paymentStallModal(id);
    modal.showModal();
    return;
} if (!stall)
    return; if (stall.status !== 'available') {
    modalContent.innerHTML = ownedStallModal(stall);
    modal.showModal();
    return;
} if (selectedStall === id) {
    openSignupForStall(id);
    return;
} selectedStall = id; savePageState(); render(); }
function ownedStallModal(stall) { const name = stall.tenantName ? `<b>${escapeHTML(stall.tenantName)}</b>` : ''; return `<div class="modal-inner"><div class="modal-top"><h2 id="modalTitle">แผง ${escapeHTML(stall.id)} มีเจ้าของแล้ว</h2><button class="close-btn" onclick="modal.close()" aria-label="ปิด">×</button></div><div class="modal-body"><p class="help">${stall.status === 'reserved' ? 'มีผู้จองแล้ว' : 'มีผู้เช่าแล้ว'}${name ? ` · ${name}` : ''}</p></div></div>`; }
function paymentStallModal(id) { const bills = DEMO.bills.filter(b => b.payerType === 'stall' && b.status === 'unpaid' && b.stall === id); const tenant = findStall(id)?.tenantName || bills[0]?.merchant; const summary = `<p class="help"><b>${escapeHTML(tenant || 'ยังไม่มีผู้เช่า')}</b></p>`; return `<div class="modal-inner"><div class="modal-top"><h2 id="modalTitle">แผง ${escapeHTML(id)}</h2><button class="close-btn" onclick="modal.close()" aria-label="ปิด">×</button></div><div class="modal-body">${summary}${findStall(id)?.status === 'available' ? `<button class="qr-demo" onclick="modal.close();openSignupForStall('${escapeHTML(id)}')">จองแผงนี้</button>` : `<button class="qr-demo" onclick="modal.close();findPaymentByQr('${escapeHTML(id)}')">เช็คยอดค้างชำระ</button>`}</div></div>`; }
function findPaymentByQr(raw) { let key = raw.trim(); try {
    const url = new URL(key);
    key = url.searchParams.get('stall') || url.searchParams.get('ref') || url.pathname.split('/').filter(Boolean).pop() || key;
}
catch { } key = key.trim().toUpperCase(); const bill = DEMO.bills.find(item => item.payerType === 'stall' && (item.stall?.toUpperCase() === key || item.ref.toUpperCase() === key)); const stall = findStall(key); searchTerm = bill?.stall || stall?.id || key; paymentMapMode = false; resetSelection(); setPage('dues'); if (!bill && !stall)
    toast('ไม่พบรหัสแผงใน QR นี้ · ลองค้นหาด้วยชื่อหรือเลขแผง'); }
function openQrScanner() { startQrScan({ title: 'สแกน QR ที่แผง', help: 'หันกล้องไปที่ QR บนแผง เช่น A06 หรือ LM-021', demoCode: 'A06', demoLabel: 'ทดลองดูยอดตัวอย่าง A06', onCode: findPaymentByQr }); }
const findStall = id => DEMO.stalls.find(s => s.id === id && s.active !== false);
const localISODate = () => { const date = new Date(); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 10); };
let rentalStartDate = localISODate();
let rentalDays = 1;
const rentPeriodFor = stall => stall.outside ? (stall.rentPeriod || DEMO.outsideLocations.find(location => location.id === stall.locationId)?.rentPeriod || 'monthly') : 'monthly';
const rentPeriodUnit = period => period === 'daily' ? 'วัน' : 'เดือน';
const rentRateFor = stall => { if (stall.rentRate != null)
    return Number(stall.rentRate); if (stall.outside)
    return DEMO.outsideLocations.find(location => location.id === stall.locationId)?.rentRate ?? 500; return DEMO.planRows.find(row => row.id === stall.row)?.monthlyRate ?? DEMO.rates.regularRent; };
const firstChargeAmount = (stall, date = rentalStartDate, days = rentalDays) => stall ? calculateFirstCharge(rentRateFor(stall), DEMO.rates.stallWaste, rentPeriodFor(stall), date, Number(days)) : 0;
function setRentalDays(value) { captureSignupDraft(); const days = Number(value); if (Number.isInteger(days) && days >= 1 && days <= 365)
    rentalDays = days; render(); }
function setRentalStartDate(date) { captureSignupDraft(); try {
    calendarDaysInMonth(date);
    rentalStartDate = date;
    render();
}
catch {
    toast('วันที่เริ่มเช่าไม่ถูกต้อง');
} }
function setPage(p) { if (p !== 'signup' && view === 'signup') {
    signupStallId = null;
    signupLocationId = null;
} if (p !== 'stalls')
    paymentMapMode = false; view = p; savePageState(); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
function sectionHead(title, sub = '', link = '') { return `<div class="section-head"><div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div>${link ? `<button class="text-link" onclick="${link}">ดูทั้งหมด　›</button>` : ''}</div>`; }
function iconNav(icon, label) { return `<span class="nav-icon" aria-hidden="true">${icon}</span><span>${label}</span>`; }
const I = { "home": "<svg viewBox=\"0 0 24 24\" width=\"26\" height=\"26\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 11 12 3l9 8\"/><path d=\"M5 10v10h14V10\"/><path d=\"M10 20v-6h4v6\"/></svg>", "stalls": "<svg viewBox=\"0 0 24 24\" width=\"26\" height=\"26\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 9h18l-1.5-5h-15z\"/><path d=\"M5 9v11h14V9\"/><path d=\"M9 20v-5h6v5\"/></svg>", "signup": "<svg viewBox=\"0 0 24 24\" width=\"26\" height=\"26\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 8v8M8 12h8\"/></svg>", "history": "<svg viewBox=\"0 0 24 24\" width=\"26\" height=\"26\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7v5l3 2\"/></svg>", "work": "<svg viewBox=\"0 0 24 24\" width=\"26\" height=\"26\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><rect x=\"4\" y=\"3\" width=\"16\" height=\"18\" rx=\"2\"/><path d=\"M8 8h8M8 12h8M8 16h5\"/></svg>", "pay": "<svg viewBox=\"0 0 24 24\" width=\"26\" height=\"26\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><rect x=\"3\" y=\"6\" width=\"18\" height=\"12\" rx=\"2\"/><circle cx=\"12\" cy=\"12\" r=\"2.5\"/></svg>", "report": "<svg viewBox=\"0 0 24 24\" width=\"26\" height=\"26\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M4 20V10M10 20V4M16 20v-7M22 20H2\"/></svg>", "sms": "<svg viewBox=\"0 0 24 24\" width=\"26\" height=\"26\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M4 5h16v11H9l-5 4z\"/></svg>" };
function navItems() { return [['dues', I.pay, 'จ่ายเงิน'], ['stalls', I.stalls, 'ดูแผง'], ['signup', I.signup, 'สมัคร']]; }
function renderNav() { nav.innerHTML = navItems().map(([id, ic, label]) => `<button class="nav-item ${view === id ? 'active' : ''}" aria-current="${view === id ? 'page' : 'false'}" onclick="setPage('${id}')">${iconNav(ic, label)}</button>`).join(''); }
// หน้าจ่ายค่าแผง: ค่าเช่า + ค่าขยะแผง (ค่าขยะบ้านอยู่หน้า waste/)
// ---------- ต่อ API จริง: เลขล็อก + ชื่อผู้เช่า ต้องตรงกันจึงเห็นยอด ----------
let verifiedName = '';
let draftStall = '';
let demoBillsAll = null;
function toStallBill(x) {
    const cash = x.status === 'pending' && x.submittedMethod === 'cash';
    const status = x.status === 'pending' ? (cash ? 'cash' : 'pending') : x.status === 'mismatch' ? 'mismatch' : 'unpaid';
    return { id: x.id, payerType: 'stall', merchant: verifiedName || x.payerName, ref: x.stallCode, stall: x.stallCode, kind: x.kind === 'waste' ? 'ค่าขยะ' : 'ค่าเช่า', month: periodToThai(x.period), due: x.dueDate || '', amount: Number(x.amount), status, note: x.reviewNote || undefined };
}
async function searchStallBills(name, stall) {
    verifiedName = name.trim();
    draftStall = stall.trim().toUpperCase();
    searchTerm = draftStall;
    resetSelection();
    if (!searchTerm)
        return render();
    if (verifiedName.length < 4) {
        toast('กรุณากรอกชื่อ-นามสกุลผู้เช่า');
        return render();
    }
    try {
        const r = await payApi(`/market/bills?stall=${encodeURIComponent(searchTerm)}&name=${encodeURIComponent(verifiedName)}`);
        if (r === null) { // เดโม่: ไม่มี API → กรองข้อมูลตัวอย่างให้ตรงทั้งรหัสแผงและชื่อ
            demoBillsAll ?? (demoBillsAll = DEMO.bills);
            DEMO.bills = demoBillsAll.filter((b) => b.payerType === 'stall' && b.stall?.toUpperCase() === searchTerm && demoNameKey(b.merchant) === demoNameKey(verifiedName));
            if (!DEMO.bills.length)
                toast('ไม่พบข้อมูลที่ตรงกัน กรุณาตรวจสอบชื่อและเลขล็อก/บ้านเลขที่ให้ตรงกับที่ลงทะเบียนไว้');
            return render();
        }
        DEMO.bills = (r.bills || []).map(toStallBill);
    }
    catch (e) {
        DEMO.bills = [];
        toast(e.message);
    }
    render();
}
/** ช่องเดียว: "สมใจ ใจดี A06" → ชื่อ + รหัสแผงต่อท้าย · รองรับรหัสแผงลอย OUT-0001 (พิมพ์ OUT0001 ก็ได้) */
function parseStallQuery(raw) {
    const text = raw.replace(/\s+/g, ' ').trim();
    const m = text.match(/^(.*?)\s*((?:OUT-?\d{1,4})|(?:[A-Za-z]{1,3}-?\d{1,3}))$/i);
    if (!m)
        return { name: text, code: '' };
    let code = m[2].toUpperCase();
    if (code.startsWith('OUT') && !code.includes('-'))
        code = 'OUT-' + code.slice(3);
    return { name: m[1].trim(), code };
}
function searchStallFromForm() {
    const { name, code } = parseStallQuery(document.getElementById('sq')?.value || '');
    if (!code)
        return toast('พิมพ์รหัสแผงต่อท้ายชื่อ เช่น สมใจ ใจดี A06');
    if (!name)
        return toast('พิมพ์ชื่อ-นามสกุลก่อนรหัสแผง เช่น สมใจ ใจดี A06');
    void searchStallBills(name, code);
}
/** ส่งการแจ้งชำระของบิลค่าแผงทีละใบ (แนบสลิปเฉพาะโอน) แล้วโหลดรายการใหม่ */
async function submitStallBills(ids, method, slip) {
    try {
        const fd = new FormData();
        fd.append('billIds', ids.join(','));
        fd.append('method', method);
        fd.append('name', verifiedName);
        if (slip)
            fd.append('slip', slip, slip.name);
        const r = await payApi('/market/submit', { method: 'POST', body: fd });
        if (r === null)
            throw new Error('ส่งข้อมูลไม่ได้ ตรวจการเชื่อมต่อแล้วลองใหม่');
        await searchStallBills(verifiedName, searchTerm);
        return r;
    }
    catch (e) {
        toast(e.message);
        return null;
    }
}
function searchPage() {
    const matches = searchTerm ? DEMO.bills.filter(b => b.payerType === 'stall' && (PAYABLE.includes(b.status) || b.status === 'pending' || b.status === 'cash')).sort((a, b) => b.id.localeCompare(a.id)) : [];
    const shortcuts = searchTerm ? '' : `<div class="payment-shortcuts" style="grid-template-columns:1fr"><button class="payment-shortcut" type="button" onclick="openQrScanner()">${SHORTCUT_QR_ART}<b>สแกน QR ที่แผง</b><small>เปิดกล้องส่องรหัสบนแผง</small></button></div>`;
    const form = `<div class="page-heading with-photo"><h1>จ่ายค่าแผงตลาด</h1><p>ค้นหาด้วยชื่อผู้เช่าและรหัสแผงในช่องเดียว · ไม่ต้องเข้าสู่ระบบ</p></div><form class="search-card" onsubmit="event.preventDefault();searchStallFromForm()"><label for="sq">ชื่อ-นามสกุล แล้วต่อด้วยรหัสแผง</label><div class="search-row"><input id="sq" name="sq" value="${escapeHTML([verifiedName, draftStall].filter(Boolean).join(' '))}" placeholder="เช่น สมใจ ใจดี A06" autocomplete="name"><button type="submit">ค้นหา</button></div><p class="help">พิมพ์ชื่อผู้เช่าแล้วตามด้วยรหัสแผง · ผู้สมัครแผงลอยใช้รหัส OUT-xxxx ที่ได้รับ · ชื่อต้องตรงกับที่ลงทะเบียนไว้</p></form>`;
    return form + shortcuts + billListHTML({ title: 'ค่าแผงตลาด', matches, promptText: 'พิมพ์ชื่อผู้เช่าตามด้วยรหัสแผง แล้วกดค้นหา', payerLabel: b => 'ล็อก ' + (b.stall || b.ref), chargeLabel: b => b.kind === 'ค่าขยะ' ? 'ค่าขยะแผง' : 'ค่าเช่าแผง' }) + contactFooterHTML();
}
const SHORTCUT_QR_ART = '<img class="shortcut-art shortcut-art-photo" src="/citizen-pay/shared/img/scan-qr-market.webp" width="600" height="386" alt="" aria-hidden="true">';
const SHORTCUT_MAP_ART = '<img class="shortcut-art shortcut-art-photo" src="/citizen-pay/shared/img/pick-stall-map.webp" width="600" height="386" alt="" aria-hidden="true">';
function stallPage() { if (stallArea === 'outside' && openOutsideLocations().length) {
    const page = outsideStallPage();
    return page;
} if (!openOutsideLocations().length)
    stallArea = 'regular'; const page = regularStallPage(); return page; }
function regularStallPage() { const picked = findStall(selectedStall); const labels = { available: 'ว่าง', reserved: 'จอง', occupied: 'เช่า' }; return `<div class="page-heading">${paymentMapMode ? `<button class="back-link" onclick="cancelPaymentMap()">‹ กลับไปเลือกวิธี</button>` : ''}<h1>ผังตลาด อบต.</h1><p>${paymentMapMode ? 'แตะแผงของคุณเพื่อดูยอดค้าง' : 'แตะช่องว่างเพื่อสมัครและขอจอง'}</p></div>${openOutsideLocations().length ? `<div class="area-switch"><button class="active" onclick="chooseStallArea('regular')">แผงประจำ</button><button onclick="chooseStallArea('outside')">แผงลอยนอกผัง</button></div>` : ``}<div class="plan-card"><div class="plan-head"><div><b>แผงประจำ</b><small>แตะแผงเพื่อดูผู้จอง หรือจองแผงว่าง</small></div><span>${DEMO.planRows.length} แถว · ${DEMO.stalls.filter(s => s.active !== false).length} แผง</span></div><div class="plan-scroll" tabindex="0" aria-label="ผังตลาด เลือกแผงจากแถว A ถึง E"><div class="plan-canvas"><div class="plan-facilities"><div class="plan-facility"><span>🚻</span><b>ห้องน้ำ</b></div><div class="plan-facility"><span>📦</span><b>ห้องเก็บของ</b></div></div>${DEMO.planRows.map(row => `<section class="plan-row"><div class="plan-row-title"><small>แถว</small><b>${row.id}</b></div><div class="plan-stalls">${DEMO.stalls.filter(s => s.row === row.id && s.active !== false).map(s => `<button class="stall plan-stall ${s.status === 'occupied' ? 'occupied' : s.status === 'reserved' ? 'reserved' : ''} ${selectedStall === s.id ? 'selected' : ''}" aria-label="แผง ${s.id} ${labels[s.status]}" aria-pressed="${selectedStall === s.id}" onclick="selectStall('${s.id}')"><b>${s.id}</b><span>${labels[s.status]}</span></button>`).join('')}</div></section><div class="plan-walkway"><span></span>ทางเดิน<span></span></div>`).join('')}<div class="plan-sides"><div>ที่นั่งพัก</div><div>ที่นั่งพัก</div></div><div class="plan-bottom"><div class="parking-area"><b>ลานจอดรถ</b><span>รถยนต์ · มอเตอร์ไซค์</span></div><div class="market-entry"><b>ทางเข้า - ออก</b><small>จุดรับส่งและทางสัญจร</small></div><div class="trash-area"><span>♻️</span><b>ถังขยะ</b></div></div></div></div><div class="legend"><span><i></i>ว่าง</span><span><i class="leg-r"></i>จอง/รอยืนยัน</span><span><i class="leg-o"></i>มีผู้เช่า</span></div>${picked && !paymentMapMode ? `<div class="selection-box"><span><b>${picked.outside ? 'ช่อง' : 'แผง'} ${picked.id}</b>${picked.tenantName ? `<br><small>${picked.status === 'reserved' ? 'ผู้จอง' : 'ผู้เช่า'} ${escapeHTML(picked.tenantName)}</small>` : ''}<br><small>${picked.status === 'available' ? 'ว่าง · จองได้' : picked.status === 'reserved' ? 'จองแล้ว · รอเจ้าหน้าที่ยืนยัน' : 'มีผู้เช่าแล้ว'}</small></span>${picked.status === 'available' ? `<button onclick="openSignupForStall('${picked.id}')">จองแผงนี้</button>` : ''}</div>` : '<p class="help" style="text-align:center;margin:12px 0 0">แตะแผงเพื่อดูผู้จองหรือจองแผงว่าง</p>'}</div><div class="notice"><span class="notice-icon">💡</span><div><b>ข้อมูลผังปรับได้</b><p>ผังสร้างจากจำนวนแถวและจำนวนแผงในข้อมูลระบบ สถานะการจองอัปเดตตามแต่ละแผง</p></div></div>${PAYMENT.demo ? sectionHead('แผงชั่วคราว', 'กิจกรรมที่เปิดจอง') : ''}${(PAYMENT.demo ? DEMO.events : []).map(ev => `<div class="panel event-card"><div class="event-date"><div><b>${ev.date}</b><br>${ev.month} 69</div></div><div><h3>${escapeHTML(ev.title)}</h3><p>${escapeHTML(ev.place)} · ${ev.booked}/${ev.slots} ช่อง</p></div><button class="small-btn" onclick="toast('ตัวอย่าง: ติดต่อเจ้าหน้าที่เพื่อจอง')">ดู</button></div>`).join('')}`; }
function chooseStallArea(area) { if (area === 'outside') {
    const locations = openOutsideLocations();
    if (!locations.length)
        return;
    if (!locations.some(x => x.id === selectedOutsideLocationId))
        selectedOutsideLocationId = locations[0].id;
} stallArea = area; selectedStall = null; savePageState(); render(); }
function openOutsideSignup() { const location = openOutsideLocations().find(x => x.id === selectedOutsideLocationId); if (!location)
    return toast('ยังไม่มีพื้นที่ให้เช่า'); signupLocationId = location.id; setPage('signup'); }
function payOutsideLocation() { toast('พิมพ์ชื่อ แล้วต่อด้วยรหัสแผงลอย OUT-xxxx ที่ได้รับตอนสมัคร'); setPage('dues'); }
function chooseOutsideLocation(id) { if (!outsideLocationIsOpen(id))
    return; selectedOutsideLocationId = id; selectedStall = null; savePageState(); render(); }
function outsideStallPage() { const locations = openOutsideLocations(); if (!locations.length) {
    stallArea = 'regular';
    return regularStallPage();
} if (!locations.some(x => x.id === selectedOutsideLocationId))
    selectedOutsideLocationId = locations[0].id; const location = locations.find(x => x.id === selectedOutsideLocationId); return `<div class="page-heading"><h1>ผังตลาด อบต.</h1><p>พื้นที่ที่เปิดให้เช่า</p></div><div class="area-switch"><button onclick="chooseStallArea('regular')">แผงประจำ</button><button class="active" onclick="chooseStallArea('outside')">แผงลอยนอกผัง</button></div><div class="loc-list" role="radiogroup" aria-label="เลือกพื้นที่แผงลอย">${locations.map(l => `<button type="button" class="loc-card ${l.id === location.id ? 'active' : ''}" role="radio" aria-checked="${l.id === location.id}" onclick="chooseOutsideLocation('${l.id}')"><span class="loc-name">${escapeHTML(l.name)}</span><span class="loc-rent">${money(l.rentRate)} บาท/${rentPeriodUnit(l.rentPeriod)}</span></button>`).join('')}</div><div class="outside-actions"><button type="button" class="primary-btn" onclick="openOutsideSignup()">เช่าแผงลอยนี้</button><button type="button" class="primary-btn alt" onclick="payOutsideLocation()">ชำระค่าเช่า</button></div>`; }
function openSignupForStall(id) { const s = findStall(id); if (!s || s.active === false || s.status !== 'available' || (s.outside && !outsideLocationIsOpen(s.locationId)))
    return toast('ช่องนี้ไม่พร้อมให้จองแล้ว'); selectedStall = id; signupStallId = id; setPage('signup'); }
/** ฟิลด์วันเริ่มเช่า/จำนวนวันของแผงลอย (รายวันต้องระบุจำนวนวัน) */
function outsideRentFieldsHTML(o) { const daily = o.rentPeriod === 'daily'; const est = daily ? o.rentRate * rentalDays : o.rentRate; return `<label class="field"><span class="field-label">วันที่เริ่มเช่า</span><input id="rentalStartDate" name="rentalStartDate" type="date" min="${localISODate()}" value="${rentalStartDate}" required onchange="setRentalStartDate(this.value)"></label>${daily ? `<label class="field"><span class="field-label">จำนวนวันที่เช่า</span><input id="rentalDays" name="rentalDays" type="number" min="1" max="365" step="1" value="${rentalDays}" required onchange="setRentalDays(this.value)"></label>` : ''}<div class="first-month-estimate"><span>${daily ? `ยอดประมาณ ${rentalDays} วัน` : 'ค่าเช่าต่อเดือน'}</span><b>${money(est)} บาท</b><small>ยอดเป็นการประเมิน เจ้าหน้าที่ออกบิลจริงหลังอนุมัติ</small></div>`; }
function signupPage() { const stall = signupStallId ? findStall(signupStallId) : null; const outside = !stall && signupLocationId ? DEMO.outsideLocations.find(x => x.id === signupLocationId) : undefined; const daily = stall && rentPeriodFor(stall) === 'daily'; return `<div class="page-heading"><button class="back-link" onclick="setPage('${stall || outside ? 'stalls' : 'home'}')">‹ ${stall || outside ? 'กลับไปเลือกแผง' : 'กลับไปเลือกเมนู'}</button><h1>${outside ? `สมัครแผงลอย ${escapeHTML(outside.name)}` : stall ? `${stall.outside ? 'สมัครแผงลอย' : 'สมัครและจองล็อก'} ${escapeHTML(stall.id)}` : 'สมัครใช้บริการ'}</h1><p>${stall || outside ? 'กรอกข้อมูลติดต่อเพื่อส่งคำขอจองให้เจ้าหน้าที่' : 'กรอกข้อมูลผู้เช่าและล็อกที่ต้องการ'}</p></div><form class="panel signup-form" onsubmit="submitRegistration(event)"><label class="field"><span class="field-label">ชื่อและนามสกุล</span><input id="signupName" name="name" required placeholder="เช่น ใจดี มั่นคง" autocomplete="name" value="${escapeHTML(signupDraft.name)}"></label><label class="field"><span class="field-label">เบอร์โทรศัพท์</span><input id="signupPhone" name="phone" type="tel" inputmode="tel" pattern="[0-9+ ()-]{9,15}" required placeholder="08X-XXX-XXXX" autocomplete="tel" value="${escapeHTML(signupDraft.phone)}"></label>${idCardFieldHTML()}<label class="field"><span class="field-label">${outside ? 'พื้นที่ที่เช่า' : `ล็อกที่จองไว้${stall ? '' : ' (ถ้ามี)'}`}</span><input id="signupStall" name="stall" ${stall || outside ? 'readonly' : ''} value="${stall ? escapeHTML(stall.id) : outside ? escapeHTML(outside.name) : ''}" placeholder="เช่น A06"></label>${outside ? outsideRentFieldsHTML(outside) : ''}${stall ? `<label class="field"><span class="field-label">วันที่เริ่มเช่า</span><input id="rentalStartDate" name="rentalStartDate" type="date" min="${localISODate()}" value="${rentalStartDate}" required onchange="setRentalStartDate(this.value)"></label>${daily ? `<label class="field"><span class="field-label">จำนวนวันที่เช่า</span><input id="rentalDays" name="rentalDays" type="number" min="1" max="365" step="1" value="${rentalDays}" required onchange="setRentalDays(this.value)"></label>` : ''}<div class="first-month-estimate"><span>${daily ? `ยอดประมาณ ${rentalDays} วัน` : 'ค่าใช้จ่ายเดือนแรกโดยประมาณ'}</span><b>${money(firstChargeAmount(stall))} บาท</b><small>${daily ? 'คิดค่าเช่ารายวันรวมค่าขยะแผงเฉลี่ยตามจำนวนวันที่เลือก' : 'เฉลี่ยค่าเช่าและค่าขยะแผงตามวันที่เช่าถึงสิ้นเดือน โดยนับวันเริ่มเช่าด้วย'}</small></div>` : ''}<label class="consent"><input type="checkbox" required> ยินยอมให้ อบต. ใช้ข้อมูลและรูปบัตรประชาชนเพื่อยืนยันตัวตนและติดต่อเรื่องบริการนี้</label><button class="primary-btn submit-signup" type="submit">${stall ? 'ส่งใบสมัครและขอจอง' : 'ส่งใบสมัคร'} <span>→</span></button></form><p class="help" style="text-align:center">ยอดค่าแผงเป็นการประเมิน เจ้าหน้าที่ตรวจสอบก่อนยืนยัน</p>`; }
// ---------- ใบสมัคร: รูปบัตรประชาชน (จำเป็น) + จำค่าที่กรอกไว้ตอนหน้า re-render (เปลี่ยนวันเริ่มเช่า/จำนวนวัน) ----------
let idCardFile = null, idCardUrl = '';
const signupDraft = { name: '', phone: '' };
function captureSignupDraft() { const n = document.getElementById('signupName'); const p = document.getElementById('signupPhone'); if (n)
    signupDraft.name = n.value; if (p)
    signupDraft.phone = p.value; }
function idCardPreviewHTML() { return idCardFile ? `<div class="slip-preview id-card-preview"><img src="${idCardUrl}" alt="รูปบัตรประชาชนที่แนบ"><span>${escapeHTML(idCardFile.name)}<br><button type="button" class="text-link" onclick="clearIdCard()">ลบรูป</button></span></div>` : ''; }
function idCardFieldHTML() { return `<div class="field"><span class="field-label">รูปบัตรประชาชน (ด้านหน้า)</span><label class="upload scan-upload id-upload"><span id="idCardLabel">${idCardFile ? 'เปลี่ยนรูปบัตร' : 'ถ่ายรูป หรือเลือกรูปบัตรประชาชน'}</span><input type="file" accept="image/*" onchange="pickIdCard(this)"></label><div id="idCardPreview">${idCardPreviewHTML()}</div><p class="help">ใช้ยืนยันตัวตนผู้เช่าเท่านั้น · ถ่ายให้เห็นชื่อและเลขบัตรชัดเจน · ไม่ต้องถ่ายด้านหลังบัตร</p></div>`; }
function refreshIdCardField() { const preview = document.getElementById('idCardPreview'); const label = document.getElementById('idCardLabel'); if (preview)
    preview.innerHTML = idCardPreviewHTML(); if (label)
    label.textContent = idCardFile ? 'เปลี่ยนรูปบัตร' : 'ถ่ายรูป หรือเลือกรูปบัตรประชาชน'; }
function clearIdCard() { if (idCardUrl)
    URL.revokeObjectURL(idCardUrl); idCardFile = null; idCardUrl = ''; refreshIdCardField(); }
function pickIdCard(input) { const f = input.files?.[0]; input.value = ''; if (!f)
    return; if (!f.type.startsWith('image/'))
    return toast('แนบได้เฉพาะรูปภาพ'); if (f.size > 10 * 1024 * 1024)
    return toast('รูปใหญ่เกิน 10 MB'); clearIdCard(); idCardFile = f; idCardUrl = URL.createObjectURL(f); refreshIdCardField(); }
// สถานะแผงจากระบบจริง (ว่าง/จอง/มีผู้เช่า) — รีเฟรชทุก 2 วินาที และวาดใหม่เฉพาะตอนมีการเปลี่ยนแปลง
let stallSig = '';
let apiOnline = false;
const DEMO_STALLS_KEY = 'lamplaimat:demo-stalls';
/** เดโม่ (ไม่มี backend): สถานะแผงชุดเดียวกับหน้าเจ้าหน้าที่เดโม่ ที่ฝากไว้ใน localStorage (ไม่มี = ใช้ชุดตัวอย่างของหน้านี้) */
function readDemoStalls() {
    try {
        const v = JSON.parse(localStorage.getItem(DEMO_STALLS_KEY) || 'null');
        return Array.isArray(v) && v.length && v.every((x) => x && typeof x.stallCode === 'string' && ['available', 'reserved', 'occupied'].includes(x.status)) ? v : null;
    }
    catch {
        return null;
    }
}
/** ประชาชนจองในเดโม่ → จำไว้ทันทีว่าแผงนั้น "จอง" (รีเฟรชแล้วไม่หาย และตรงกับที่เจ้าหน้าที่จะเห็น) */
function markDemoStall(code, status) {
    try {
        const rows = readDemoStalls() ?? DEMO.stalls.filter(s => s.active !== false).map(s => ({ stallCode: s.id, zone: s.row, status: s.status, monthlyRate: Number(rentRateFor(s)) || 0 }));
        localStorage.setItem(DEMO_STALLS_KEY, JSON.stringify(rows.map(r => r.stallCode === code ? { ...r, status } : r)));
    }
    catch { /* เก็บไม่ได้ = ข้าม */ }
}
function applyStallRows(rows, force) {
    const sig = JSON.stringify(rows);
    if (sig === stallSig && !force)
        return;
    const ae = document.activeElement;
    if (!force && ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName))
        return;
    stallSig = sig;
    DEMO.stalls = rows.map(x => ({ id: x.stallCode, row: x.zone, active: true, status: x.status, rentRate: Number(x.monthlyRate) || 0 }));
    const zones = [...new Set(rows.map(x => x.zone))];
    DEMO.planRows = zones.map(z => ({ id: z, count: rows.filter(x => x.zone === z).length, monthlyRate: Number(rows.find(x => x.zone === z)?.monthlyRate) || 0 }));
    render();
}
async function refreshStalls(force = false) {
    let rows = null;
    try {
        const r = await fetch('/v1/citizen/pay/market/stalls', { cache: 'no-store' });
        if (r.ok) {
            const j = await r.json();
            if (Array.isArray(j?.data))
                rows = j.data;
        }
    }
    catch { /* ไม่มี API */ }
    apiOnline = !!rows;
    if (!rows)
        rows = readDemoStalls();
    if (rows)
        applyStallRows(rows, force);
}
/** จองแผงว่างผ่านระบบจริง: ส่งชื่อ เบอร์ และรูปบัตร → เจ้าหน้าที่ได้แจ้งเตือน */
async function reserveStallOnline(form, stall) {
    const fd = new FormData();
    fd.append('name', form.querySelector('[name=name]')?.value || '');
    fd.append('phone', form.querySelector('[name=phone]')?.value || '');
    fd.append('rentalStartDate', rentalStartDate);
    if (rentPeriodFor(stall) === 'daily')
        fd.append('rentalDays', String(rentalDays));
    if (idCardFile)
        fd.append('idCard', idCardFile, idCardFile.name);
    try {
        const r = await fetch(`/v1/citizen/pay/market/stalls/${encodeURIComponent(stall.id)}/reserve`, { method: 'POST', body: fd });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || j.success === false) {
            toast(j?.error?.message || 'จองแผงไม่สำเร็จ');
            if (r.status === 409) {
                signupStallId = null;
                setPage('stalls');
            }
            await refreshStalls(true);
            return;
        }
        form.reset();
        clearIdCard();
        signupDraft.name = '';
        signupDraft.phone = '';
        signupStallId = null;
        signupLocationId = null;
        selectedStall = null;
        toast(`จองแผง ${stall.id} แล้ว · รอเจ้าหน้าที่ยืนยัน`);
        await refreshStalls(true);
        setPage('stalls');
    }
    catch {
        toast('เชื่อมต่อระบบไม่ได้ ลองใหม่อีกครั้ง');
    }
}
/** สมัครแผงลอยผ่านระบบจริง: ส่งชื่อ เบอร์ วันเริ่ม จำนวนวัน และรูปบัตร → ได้รหัส OUT-xxxx ไว้ชำระค่าเช่า */
async function applyOutsideOnline(form, locationId) {
    const fd = new FormData();
    fd.append('name', form.querySelector('[name=name]')?.value || '');
    fd.append('phone', form.querySelector('[name=phone]')?.value || '');
    fd.append('startDate', rentalStartDate);
    fd.append('days', String(rentalDays));
    if (idCardFile)
        fd.append('idCard', idCardFile, idCardFile.name);
    try {
        const r = await fetch(`/v1/citizen/pay/market/outside/${encodeURIComponent(locationId)}/apply`, { method: 'POST', body: fd });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || j.success === false)
            return toast(j?.error?.message || j?.message || 'ส่งใบสมัครไม่สำเร็จ');
        form.reset();
        clearIdCard();
        signupDraft.name = '';
        signupDraft.phone = '';
        signupLocationId = null;
        rentalStartDate = localISODate();
        rentalDays = 1;
        toast(`ส่งใบสมัครแล้ว · รหัส ${j.data?.appCode} · จดรหัสนี้ไว้เพื่อชำระค่าเช่า`);
        setPage('stalls');
    }
    catch {
        toast('เชื่อมต่อระบบไม่ได้ ลองใหม่อีกครั้ง');
    }
}
/** เดโม่ (ไม่มี backend): ฝากรายการไว้ใน localStorage ให้หน้าเจ้าหน้าที่เดโม่ (origin เดียวกัน) หยิบไปแสดง */
function queueDemo(key, item) { try {
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    list.push(item);
    localStorage.setItem(key, JSON.stringify(list));
}
catch { /* เก็บไม่ได้ = ข้าม */ } }
function submitRegistration(event) { event.preventDefault(); const form = event.currentTarget; if (!form.reportValidity())
    return; if (!idCardFile) {
    toast('แนบรูปบัตรประชาชนก่อนส่งใบสมัครค่ะ');
    document.getElementById('idCardPreview')?.scrollIntoView({ block: 'center' });
    return;
} if (signupLocationId && !signupStallId && apiOnline && /^[0-9a-f-]{36}$/i.test(signupLocationId)) {
    void applyOutsideOnline(form, signupLocationId);
    return;
} const stallId = signupStallId; const stall = stallId && findStall(stallId); if (stall && !stall.outside && apiOnline) {
    void reserveStallOnline(form, stall);
    return;
} if (stallId && (!stall || stall.active === false || stall.status !== 'available' || (stall.outside && !outsideLocationIsOpen(stall.locationId)))) {
    signupStallId = null;
    toast('ล็อกนี้มีผู้จองแล้ว กรุณาเลือกแผงใหม่');
    setPage('stalls');
    return;
} const amount = stall ? firstChargeAmount(stall) : 0; const period = stall ? rentPeriodFor(stall) : 'monthly'; const days = rentalDays; if (stall) {
    stall.status = 'reserved';
    markDemoStall(stall.id, 'reserved');
} const dName = form.querySelector('[name=name]')?.value || '', dPhone = form.querySelector('[name=phone]')?.value || ''; let demoCode = ''; if (stall) {
    queueDemo('lamplaimat:demo-reservations', { stallCode: stall.id, name: dName, phone: dPhone, startDate: rentalStartDate, days: period === 'daily' ? days : null, reservedAt: new Date().toISOString() });
}
else if (signupLocationId) {
    demoCode = 'OUT-' + String(Math.floor(Math.random() * 9000) + 1000);
    queueDemo('lamplaimat:demo-outside-apps', { appCode: demoCode, locationId: signupLocationId, name: dName, phone: dPhone, startDate: rentalStartDate, days, createdAt: new Date().toISOString() });
} form.reset(); clearIdCard(); signupDraft.name = ''; signupDraft.phone = ''; signupStallId = null; signupLocationId = null; selectedStall = null; rentalStartDate = localISODate(); rentalDays = 1; toast(stall ? `ส่งใบสมัครและคำขอจองแล้ว · ${period === 'daily' ? `${days} วัน` : 'เดือนแรก'} ประมาณ ${money(amount)} บาท` : demoCode ? `ส่งใบสมัครแล้ว · รหัส ${demoCode} · จดรหัสนี้ไว้เพื่อชำระค่าเช่า` : 'ส่งใบสมัครตัวอย่างแล้ว · เจ้าหน้าที่จะตรวจทาน'); setPage('stalls'); }
/** หน้าแรกค่าแผง — เลือกว่าจะจ่ายค่าแผงหรือจองแผง */
function choicePage() { return `<div class="page-heading"><h1>ค่าแผงตลาด</h1><p>เลือกว่าจะทำอะไร</p></div><div class="choice-grid"><button class="choice-card choice-card-photo" onclick="setPage('dues')" aria-label="จ่ายค่าแผงตลาด — ดูยอดค้างและจ่ายผ่าน QR หรือเงินสด"><img src="/citizen-pay/shared/img/market-pay-banner.webp" width="1672" height="941" alt="จ่ายค่าแผงตลาด" loading="lazy"></button><button class="choice-card choice-card-photo" onclick="setPage('stalls')" aria-label="จองแผง (สมัคร) — เลือกแผงว่างแล้วส่งคำขอจอง"><img src="/citizen-pay/shared/img/market-reserve-banner.webp" width="1774" height="887" alt="สมัครจองแผงตลาดออนไลน์" loading="lazy"></button></div>`; }
function render() { saveOutsideLocations(); app.classList.remove('staff-dashboard'); renderNav(); const page = { home: choicePage, dues: searchPage, stalls: stallPage, signup: signupPage }; app.innerHTML = homeBackHTML() + (page[view] || searchPage)(); }
applySavedPayments();
// จุดแผงลอยที่เปิดให้เช่า: อัปเดตเกือบเรียลไทม์ (ราว 2 วินาที)
// - ระบบจริง: ดึงจาก API ทุก 2 วินาทีตอนแท็บเปิดอยู่ (ถ้า API ไม่ตอบ ใช้ข้อมูลที่เก็บในเครื่อง)
// - เดโม่: หน้าผู้ดูแลเขียนลง localStorage แล้วหน้านี้รับทันทีผ่านเหตุการณ์ storage
// render ใหม่เฉพาะตอนรายการเปลี่ยนจริง เพื่อไม่ให้หน้ากระพริบ
const OUTSIDE_KEY = 'lamplaimat:outside-locations';
let outsideSig = '';
async function refreshOutside() { try {
    let list = null;
    try {
        const r = await fetch('/v1/citizen/pay/market/outside', { cache: 'no-store' });
        if (r.ok) {
            const j = await r.json();
            if (Array.isArray(j?.data))
                list = j.data.slice(0, 50).map((x) => ({ id: String(x.id), name: String(x.name).slice(0, 60), rentRate: Number(x.rentRate) || 0, rentPeriod: x.rentPeriod === 'monthly' ? 'monthly' : 'daily', enabled: true, deleted: false, tenants: [] }));
        }
    }
    catch { }
    if (!list) {
        const stored = JSON.parse(localStorage.getItem(OUTSIDE_KEY) || 'null');
        if (validOutsideLocations(stored))
            list = stored.filter(l => l.enabled && !l.deleted);
    }
    if (!list)
        return;
    const sig = JSON.stringify(list);
    if (sig === outsideSig)
        return;
    const ae = document.activeElement;
    if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName))
        return;
    outsideSig = sig;
    DEMO.outsideLocations = list;
    if (!list.some(l => l.id === selectedOutsideLocationId))
        selectedOutsideLocationId = list[0]?.id ?? '';
    render();
}
catch { } }
window.addEventListener('storage', (e) => { if (e.key === OUTSIDE_KEY)
    void refreshOutside(); });
setInterval(() => { if (document.visibilityState === 'visible') {
    void refreshOutside();
    void refreshStalls();
} }, 2000);
render();
void refreshOutside();
void refreshStalls();
// ถ้าเข้าถึงระบบจริงได้: ใช้ช่องทางรับเงินจริงและส่งการแจ้งชำระเข้าระบบ
(async () => { const c = await payApi("/config").catch(() => null); if (c) {
    applyPayConfig(c);
    billSubmitter = submitStallBills;
    render();
} })();
