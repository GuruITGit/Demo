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
        return `<article class="bill-card month-card"><div class="month-card-head"><div class="month-card-info"><b>${escapeHTML(g.month)}</b><small>${escapeHTML(g.bills[0].merchant)} · ${escapeHTML(o.payerLabel(g.bills[0]))}</small></div>${side}</div><div class="charge-lines">${g.bills.map(b => `<div class="charge-line"><span>${escapeHTML(o.chargeLabel(b))}</span><b>${money(b.amount)} บาท</b><em class="status ${statusClass(b.status)}">${statusText[b.status]}</em></div>`).join('')}</div>${payable.length ? `<div class="month-due"><span>ยอดค้างเดือนนี้</span><b>${money(due)} บาท</b></div>` : ''}</article>`;
    }).join('');
    const total = [...selectedBills].reduce((n, id) => n + (DEMO.bills.find(b => b.id === id)?.amount || 0), 0);
    const body = !searchTerm ? `<div class="search-prompt"><span>⌕</span><b>${escapeHTML(o.promptText)}</b><small>ยอดค้างจะแสดงแยกตามเดือน</small></div>`
        : !grouped.length ? '<div class="empty"><span>✅</span>ไม่พบรายการค้างชำระที่ตรงกับข้อมูลนี้</div>'
            : `<div class="panel"><div class="bill-title"><div><b>ยอด${escapeHTML(o.title)}</b><small>${escapeHTML(searchTerm)}</small></div></div>${rows}<div class="due-total-row"><span>ยอดค้างรวมทุกเดือน</span><b>${money(totalDue)} บาท</b></div></div>${selectedBills.size ? `<div class="pay-summary"><div><span>ยอดที่เลือกจ่าย</span><br><b>${money(total)} บาท</b></div><div class="pay-method-actions"><button type="button" class="pay-now" onclick="openPayment()">จ่ายเงิน <span aria-hidden="true">›</span></button></div></div>` : ''}`;
    return body + '<p class="help" style="text-align:center;padding:5px 12px">ระบบสาธิต · ยอดเงินเป็นตัวอย่าง</p>';
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
        if (r)
            b.status = r.status === 'rejected' ? 'unpaid' : r.status;
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
function recordPayment(status, ref) {
    const all = loadPaymentRecords();
    const at = new Date().toISOString();
    const amount = payTotal();
    for (const id of payBillIds) {
        const b = DEMO.bills.find(x => x.id === id);
        if (!b)
            continue;
        b.status = status;
        all[id] = { status, method: payMethod, ref, at, amount, slipName: slipFile?.name };
    }
    writePaymentRecords(all);
}
function submitTransferPayment() {
    if (!slipFile)
        return toast('แนบรูปสลิปก่อนส่งค่ะ');
    recordPayment('pending', newPaymentRef('TRF'));
    clearSlip();
    resetSelection();
    modal.close();
    toast('ส่งสลิปแล้ว · รอเจ้าหน้าที่ตรวจสอบ');
    render();
}
function submitCashPayment() {
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
// ไอคอนเส้นบางแบบเดียวกับแถบเมนูของหน้าประชาชน (viewBox 24 · stroke currentColor) — ไม่ใช้ emoji
const STAFF_ICON_PATHS = {
    overview: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    stall: '<path d="M3 9h18l-1.5-5h-15z"/><path d="M5 9v11h14V9"/><path d="M9 20v-5h6v5"/>',
    payment: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6.5 9.5v5M17.5 9.5v5"/>',
    map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
    tag: '<path d="M3 12V3h9l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M5 12.5 10 17 19 7"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    pause: '<path d="M9 6v12M15 6v12"/>',
    play: '<path d="M8 5v14l11-7z"/>',
    back: '<path d="m15 5-7 7 7 7"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    print: '<path d="M7 9V3h10v6M6 18H4v-7h16v7h-2M7 14h10v7H7z"/>',
    qr: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14v7h-4"/>',
    queue: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    house: '<path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
};
/** ไอคอนในปุ่มหรือแท็บ (aria-hidden เพราะข้อความอยู่ข้างๆ แล้ว) */
function staffIcon(name, size = 18) {
    const path = STAFF_ICON_PATHS[name] || '';
    return `<span class="staff-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg></span>`;
}
const STAFF_TENANTS = {
    A01: 'นางสาวศิริพร ทองดี', A02: 'นายประเสริฐ ศรีสุข', A03: 'นางอำไพ บุญรอด', A04: 'นายธนพล วงศ์ษา', A05: 'นายบุญมี คำไหล',
    A06: 'นางสมใจ ใจดี', A08: 'นางสาวกัญญา พิมพ์ดี', B02: 'นายวิทยา แซ่ลี้', B04: 'นางมะลิ แสงทอง', B05: 'นางสาวนภัส ใจงาม',
    B07: 'นายสมชาย ไทยเจริญ', C03: 'นายวิชัย ผักสด', C06: 'นางพัชรี ขำดี', C08: 'นายอนันต์ ทองสุข', D01: 'นางจันทร์เพ็ญ สุขใจ',
    D07: 'นางสาวปิยนุช รักงาม', E04: 'นางสาวอรทัย ศรีงาม', E09: 'นางราตรี ผักสด'
};
const STAFF_OCCUPIED = new Set(['A01', 'A02', 'A03', 'A05', 'A06', 'A08', 'B02', 'B04', 'B07', 'C03', 'C06', 'D01', 'E09']);
const STAFF_RESERVED = new Set(['A04', 'B05', 'C08', 'D07', 'E04']);
const STAFF_ROWS = ['A', 'B', 'C', 'D', 'E'];
const DEMO = {
    planRows: [
        { id: 'A', count: 10, monthlyRate: 1200 }, { id: 'B', count: 10, monthlyRate: 900 }, { id: 'C', count: 10, monthlyRate: 1500 },
        { id: 'D', count: 10, monthlyRate: 1200 }, { id: 'E', count: 10, monthlyRate: 1050 },
    ],
    rates: { stallWaste: 30 },
    outsideLocations: [
        { id: 'LOC-01', name: 'ลานหน้าตลาด', rentRate: 500, rentPeriod: 'monthly', enabled: true, deleted: false, tenants: [{ name: 'นางบัวผัน เจริญสุข', paid: false }, { name: 'นายทองใบ ศรีสว่าง', paid: true }, { name: 'นางสาวลัดดา แก้วกาญจน์', paid: true }] },
        { id: 'LOC-02', name: 'ลานชุมชน', rentRate: 80, rentPeriod: 'daily', enabled: true, deleted: false, tenants: [{ name: 'นางสาวรัตนา ฟ้าใส', paid: false }, { name: 'นายสุรชัย ทองคำ', paid: true }] },
    ],
    stalls: STAFF_ROWS.flatMap(row => Array.from({ length: 10 }, (_, i) => {
        const id = `${row}${String(i + 1).padStart(2, '0')}`;
        const status = STAFF_OCCUPIED.has(id) ? 'occupied' : STAFF_RESERVED.has(id) ? 'reserved' : 'available';
        return { id, row, status, tenantName: status === 'available' ? undefined : STAFF_TENANTS[id] };
    })),
    bills: [
        // ---- ค่าแผงประจำ ----
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
        { id: 'INV-2569-09-005', payerType: 'stall', merchant: 'นางอำไพ บุญรอด', ref: 'LM-003', stall: 'A03', kind: 'ค่าเช่าแผง', month: 'กันยายน 2569', due: '30 ก.ย. 2569', amount: 1200, status: 'unpaid' },
        { id: 'INV-2569-09-007', payerType: 'stall', merchant: 'นางอำไพ บุญรอด', ref: 'LM-003', stall: 'A03', kind: 'ค่าขยะ', month: 'กันยายน 2569', due: '30 ก.ย. 2569', amount: 30, status: 'unpaid' },
        { id: 'INV-2569-10-008', payerType: 'stall', merchant: 'นางอำไพ บุญรอด', ref: 'LM-003', stall: 'A03', kind: 'ค่าเช่าแผง', month: 'ตุลาคม 2569', due: '31 ต.ค. 2569', amount: 1200, status: 'unpaid' },
        { id: 'INV-2569-10-009', payerType: 'stall', merchant: 'นางอำไพ บุญรอด', ref: 'LM-003', stall: 'A03', kind: 'ค่าขยะ', month: 'ตุลาคม 2569', due: '31 ต.ค. 2569', amount: 30, status: 'unpaid' },
        { id: 'INV-2569-10-010', payerType: 'stall', merchant: 'นางสาวกัญญา พิมพ์ดี', ref: 'LM-028', stall: 'A08', kind: 'ค่าเช่าแผง', month: 'ตุลาคม 2569', due: '31 ต.ค. 2569', amount: 1200, status: 'unpaid' },
        { id: 'INV-2569-10-011', payerType: 'stall', merchant: 'นางสาวกัญญา พิมพ์ดี', ref: 'LM-028', stall: 'A08', kind: 'ค่าขยะ', month: 'ตุลาคม 2569', due: '31 ต.ค. 2569', amount: 30, status: 'unpaid' },
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
        { id: 'INV-2569-10-025', payerType: 'stall', merchant: 'นายวิชัย ผักสด', ref: 'LM-015', stall: 'C03', kind: 'ค่าเช่าแผง', month: 'ตุลาคม 2569', due: '31 ต.ค. 2569', amount: 1500, status: 'mismatch' },
        { id: 'INV-2569-10-103', payerType: 'stall', merchant: 'นางพัชรี ขำดี', ref: 'LM-017', stall: 'C06', kind: 'ค่าเช่าแผง', month: 'ตุลาคม 2569', due: '31 ต.ค. 2569', amount: 1500, status: 'unpaid' },
        { id: 'INV-2569-10-104', payerType: 'stall', merchant: 'นางพัชรี ขำดี', ref: 'LM-017', stall: 'C06', kind: 'ค่าขยะ', month: 'ตุลาคม 2569', due: '31 ต.ค. 2569', amount: 30, status: 'unpaid' },
        { id: 'INV-2569-10-108', payerType: 'stall', merchant: 'นายอนันต์ ทองสุข', ref: 'LM-042', stall: 'C08', kind: 'ค่าเช่าแผง', month: 'ตุลาคม 2569', due: '31 ต.ค. 2569', amount: 1500, status: 'unpaid' },
        { id: 'INV-2569-10-105', payerType: 'stall', merchant: 'นางจันทร์เพ็ญ สุขใจ', ref: 'LM-004', stall: 'D01', kind: 'ค่าเช่าแผง', month: 'ตุลาคม 2569', due: 'ชำระแล้ว', amount: 1200, status: 'confirmed' },
        { id: 'INV-2569-10-109', payerType: 'stall', merchant: 'นางจันทร์เพ็ญ สุขใจ', ref: 'LM-004', stall: 'D01', kind: 'ค่าขยะ', month: 'ตุลาคม 2569', due: 'ชำระแล้ว', amount: 30, status: 'confirmed' },
        { id: 'INV-2569-10-031', payerType: 'stall', merchant: 'นางราตรี ผักสด', ref: 'LM-032', stall: 'E09', kind: 'ค่าเช่าแผง', month: 'ตุลาคม 2569', due: '31 ต.ค. 2569', amount: 1050, status: 'unpaid' },
        { id: 'INV-2569-10-032', payerType: 'stall', merchant: 'นางราตรี ผักสด', ref: 'LM-032', stall: 'E09', kind: 'ค่าขยะ', month: 'ตุลาคม 2569', due: '31 ต.ค. 2569', amount: 30, status: 'unpaid' },
        // ---- แผงลอยนอกผัง ----
        { id: 'INV-2569-10-201', payerType: 'stall', merchant: 'นางบัวผัน เจริญสุข', ref: 'LP-01', location: 'ลานหน้าตลาด', kind: 'ค่าเช่าแผงลอย', month: 'ตุลาคม 2569', due: '31 ต.ค. 2569', amount: 500, status: 'unpaid' },
        { id: 'INV-2569-10-202', payerType: 'stall', merchant: 'นางสาวรัตนา ฟ้าใส', ref: 'LC-02', location: 'ลานชุมชน', kind: 'ค่าเช่าแผงลอยรายวัน', month: 'ตุลาคม 2569', due: '27 ต.ค. 2569', amount: 80, status: 'unpaid' },
        // ---- ค่าขยะครัวเรือน ----
        { id: 'INV-HH-2569-10-014', payerType: 'household', merchant: 'นายสมชาย ใจบุญ', ref: 'HH-014', location: 'บ้านเลขที่ 18 หมู่ 2', houseNo: '18', moo: '2', phone: '0810000014', kind: 'ค่าขยะ', month: 'ตุลาคม 2569', due: '31 ต.ค. 2569', amount: 40, status: 'unpaid' },
        { id: 'INV-HH-2569-09-009', payerType: 'household', merchant: 'นายสมชาย ใจบุญ', ref: 'HH-014', location: 'บ้านเลขที่ 18 หมู่ 2', houseNo: '18', moo: '2', phone: '0810000014', kind: 'ค่าขยะ', month: 'กันยายน 2569', due: '30 ก.ย. 2569', amount: 40, status: 'unpaid' },
        { id: 'INV-HH-2569-10-021', payerType: 'household', merchant: 'นางสมใจ ใจดี', ref: 'HH-021', location: 'บ้านเลขที่ 7 หมู่ 3', houseNo: '7', moo: '3', phone: '0810000021', kind: 'ค่าขยะ', month: 'ตุลาคม 2569', due: '31 ต.ค. 2569', amount: 40, status: 'unpaid' },
        { id: 'INV-HH-2569-10-030', payerType: 'household', merchant: 'นางมะลิ แสงทอง', ref: 'HH-030', location: 'บ้านเลขที่ 18 หมู่ 5', houseNo: '18', moo: '5', phone: '0810000030', kind: 'ค่าขยะ', month: 'ตุลาคม 2569', due: '31 ต.ค. 2569', amount: 40, status: 'unpaid' },
        { id: 'INV-HH-2569-10-042', payerType: 'household', merchant: 'นายประยูร ทองดี', ref: 'HH-042', location: 'บ้านเลขที่ 12/3 หมู่ 2', houseNo: '12/3', moo: '2', phone: '0810000042', kind: 'ค่าขยะ', month: 'ตุลาคม 2569', due: '31 ต.ค. 2569', amount: 40, status: 'unpaid' },
    ],
};
// หน้าเจ้าหน้าที่ · แท็บ "พื้นที่และราคา" (เฉพาะค่าแผง): ตั้งราคาแผงประจำ/ค่าขยะแผง · จัดการพื้นที่แผงลอย (รายวัน/รายเดือน) และผู้เช่า
// พื้นที่แผงลอยเก็บใช้คีย์เดียวกับหน้าประชาชน (lamplaimat:outside-locations) จึงแสดงผลทันทีในหน้าประชาชนบนเครื่องเดียวกัน
const STAFF_LOCATIONS_KEY = 'lamplaimat:outside-locations';
let staffEditLocId = null;
function loadStaffLocations() {
    try {
        const value = JSON.parse(localStorage.getItem(STAFF_LOCATIONS_KEY) || 'null');
        if (Array.isArray(value) && value.every(l => l && typeof l.id === 'string' && Array.isArray(l.tenants)))
            return value;
    }
    catch { }
    return DEMO.outsideLocations;
}
function saveStaffLocations() { try {
    localStorage.setItem(STAFF_LOCATIONS_KEY, JSON.stringify(DEMO.outsideLocations));
}
catch { } }
const locUnit = (p) => p === 'daily' ? 'วัน' : 'เดือน';
const locPeriodLabel = (p) => p === 'daily' ? 'รายวัน' : 'รายเดือน';
function nextLocId() {
    const n = Math.max(0, ...DEMO.outsideLocations.map(l => Number(l.id.replace('LOC-', '')) || 0));
    return `LOC-${String(n + 1).padStart(2, '0')}`;
}
function readLocForm(form) {
    const fd = new FormData(form);
    const name = String(fd.get('name') || '').trim().slice(0, 60);
    const rate = Number(fd.get('rate'));
    const period = fd.get('period') === 'daily' ? 'daily' : 'monthly';
    return { name, rate, period, valid: name.length > 0 && Number.isFinite(rate) && rate >= 0 };
}
function locationFormFields(l) {
    return `<label class="staff-field"><span>ชื่อพื้นที่</span><input name="name" maxlength="60" required value="${escapeHTML(l?.name || '')}"></label>
    <label class="staff-field"><span>ค่าเช่า (บาท)</span><input name="rate" type="number" min="0" step="1" required value="${l ? l.rentRate : ''}"></label>
    <label class="staff-field"><span>รอบการเช่า</span><select name="period"><option value="monthly" ${!l || l.rentPeriod === 'monthly' ? 'selected' : ''}>รายเดือน</option><option value="daily" ${l?.rentPeriod === 'daily' ? 'selected' : ''}>รายวัน</option></select></label>`;
}
// ---------- ราคาแผงประจำ ----------
function saveStaffRates(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const read = (name) => Number(form.elements.namedItem(name)?.value);
    const values = [...DEMO.planRows.map(r => ({ row: r, value: read(r.id) })), { row: null, value: read('stallWaste') }];
    if (values.some(v => !Number.isInteger(v.value) || v.value < 0 || v.value > 100000))
        return toast('ราคาต้องเป็นจำนวนเต็มตั้งแต่ 0 ถึง 100,000 บาท');
    for (const v of values) {
        if (v.row)
            v.row.monthlyRate = v.value;
        else
            DEMO.rates.stallWaste = v.value;
    }
    saveStoredRates(DEMO.planRows, DEMO.rates);
    toast('บันทึกราคาแล้ว · มีผลกับบิลรอบถัดไป');
    render();
}
// ---------- พื้นที่แผงลอย ----------
function staffAddLocation(e) {
    e.preventDefault();
    const v = readLocForm(e.currentTarget);
    if (!v.valid)
        return toast('กรอกชื่อพื้นที่และค่าเช่าให้ถูกต้อง');
    DEMO.outsideLocations.push({ id: nextLocId(), name: v.name, rentRate: v.rate, rentPeriod: v.period, enabled: true, deleted: false, tenants: [] });
    saveStaffLocations();
    toast('เพิ่มพื้นที่แผงลอยแล้ว');
    render();
}
function staffEditLocation(e, id) {
    e.preventDefault();
    const l = DEMO.outsideLocations.find(x => x.id === id);
    if (!l)
        return;
    const v = readLocForm(e.currentTarget);
    if (!v.valid)
        return toast('กรอกชื่อพื้นที่และค่าเช่าให้ถูกต้อง');
    Object.assign(l, { name: v.name, rentRate: v.rate, rentPeriod: v.period });
    staffEditLocId = null;
    saveStaffLocations();
    toast('บันทึกพื้นที่แล้ว');
    render();
}
function staffToggleEdit(id) { staffEditLocId = staffEditLocId === id ? null : id; render(); }
function staffToggleLocation(id) {
    const l = DEMO.outsideLocations.find(x => x.id === id);
    if (!l)
        return;
    l.enabled = !l.enabled;
    saveStaffLocations();
    toast(l.enabled ? 'เปิดให้เช่าแล้ว' : 'ปิดชั่วคราวแล้ว · ไม่แสดงให้ประชาชนเลือก');
    render();
}
function staffDeleteLocation(id) {
    const l = DEMO.outsideLocations.find(x => x.id === id);
    if (!l)
        return;
    if (!window.confirm(`ลบ “${l.name}” ออกจากหน้าประชาชน ?`))
        return;
    l.deleted = true;
    saveStaffLocations();
    toast('ลบพื้นที่แล้ว');
    render();
}
function staffAddTenant(e, id) {
    e.preventDefault();
    const l = DEMO.outsideLocations.find(x => x.id === id);
    if (!l)
        return;
    const name = String(new FormData(e.currentTarget).get('name') || '').trim().slice(0, 100);
    if (!name)
        return toast('กรอกชื่อผู้เช่า');
    l.tenants.push({ name, paid: false });
    saveStaffLocations();
    toast('เพิ่มผู้เช่าแล้ว');
    render();
}
function staffToggleTenant(id, i) {
    const t = DEMO.outsideLocations.find(x => x.id === id)?.tenants[i];
    if (!t)
        return;
    t.paid = !t.paid;
    saveStaffLocations();
    render();
}
function staffRemoveTenant(id, i) {
    const l = DEMO.outsideLocations.find(x => x.id === id);
    const t = l?.tenants[i];
    if (!l || !t)
        return;
    if (!window.confirm(`ลบ “${t.name}” ออกจากพื้นที่นี้ ?`))
        return;
    l.tenants.splice(i, 1);
    saveStaffLocations();
    render();
}
let staffLocSel = null;
/** พื้นที่ที่เลือกดูอยู่ (ค่าเริ่มต้นคือพื้นที่แรกที่ยังไม่ถูกลบ) */
function selectedLoc() {
    const locs = DEMO.outsideLocations.filter(l => !l.deleted);
    return locs.find(l => l.id === staffLocSel) ?? locs[0];
}
function staffSelectLoc(id) { staffLocSel = id; staffEditLocId = null; render(); }
/** รายละเอียดของพื้นที่เดียว แบ่งเป็น 3 บล็อก: ข้อมูลพื้นที่ (แก้ไข) · ผู้เช่า · การเปิดให้เช่า/ลบ */
function locationPanel(l) {
    const unit = locUnit(l.rentPeriod);
    const editing = staffEditLocId === l.id;
    const tenants = l.tenants.map((t, i) => `<li><span>${escapeHTML(t.name)}</span><div class="staff-tenant-actions">
      <button type="button" class="staff-pay ${t.paid ? 'on' : ''}" aria-pressed="${t.paid}" onclick="staffToggleTenant('${l.id}',${i})">${t.paid ? 'จ่ายแล้ว' : 'ค้างจ่าย'}</button>
      <button type="button" class="staff-mini danger" aria-label="ลบ ${escapeHTML(t.name)}" onclick="staffRemoveTenant('${l.id}',${i})">${staffIcon('trash', 14)}</button></div></li>`).join('');
    return `<section class="staff-panel staff-loc-panel ${l.enabled ? '' : 'is-off'}">
    <div class="staff-loc-block">
      <div class="staff-loc-title"><b>ข้อมูลพื้นที่</b><button type="button" class="staff-mini-btn" onclick="staffToggleEdit('${l.id}')">${staffIcon('edit', 14)}<span>${editing ? 'ปิดการแก้ไข' : 'แก้ไข'}</span></button></div>
      ${editing
        ? `<form class="staff-form staff-edit" onsubmit="staffEditLocation(event,'${l.id}')">${locationFormFields(l)}<button type="submit" class="staff-wide">บันทึกการแก้ไข</button></form>`
        : `<div class="staff-stats">
          <div><small>ค่าเช่า</small><b>${money(l.rentRate)} บาท</b><span>ต่อ${unit}</span></div>
          <div><small>รอบการเช่า</small><b>${locPeriodLabel(l.rentPeriod)}</b><span>${l.tenants.length} ราย</span></div>
          <div><small>สถานะ</small><b>${l.enabled ? 'เปิดให้เช่า' : 'ปิดชั่วคราว'}</b><span>${l.enabled ? 'รับผู้เช่าใหม่ได้' : 'ซ่อนจากประชาชน'}</span></div>
        </div>`}
    </div>
    <div class="staff-loc-block">
      <div class="staff-loc-title"><b>ผู้เช่า</b><span>${l.tenants.length} ราย</span></div>
      ${l.tenants.length ? `<ul class="staff-tenants">${tenants}</ul>` : '<p class="staff-hint">ยังไม่มีผู้เช่า</p>'}
      <form class="staff-inline" onsubmit="staffAddTenant(event,'${l.id}')"><input name="name" maxlength="100" placeholder="ชื่อผู้เช่าใหม่" required><button type="submit">${staffIcon('plus', 16)}<span>เพิ่มผู้เช่า</span></button></form>
    </div>
    <div class="staff-loc-block staff-loc-danger">
      <div class="staff-loc-title"><b>การให้เช่า</b></div>
      <div class="staff-loc-tools">
        <button type="button" class="staff-mini-btn" onclick="staffToggleLocation('${l.id}')">${staffIcon(l.enabled ? 'pause' : 'play', 14)}<span>${l.enabled ? 'ปิดชั่วคราว' : 'เปิดให้เช่า'}</span></button>
        <button type="button" class="staff-mini-btn danger" onclick="staffDeleteLocation('${l.id}')">${staffIcon('trash', 14)}<span>ลบพื้นที่</span></button>
      </div>
    </div>
  </section>`;
}
/** เลือกพื้นที่ด้วยแท็บ แล้วดูรายละเอียดเฉพาะพื้นที่นั้น */
function locationSection() {
    const locs = DEMO.outsideLocations.filter(l => !l.deleted);
    const cur = selectedLoc();
    if (!cur)
        return '<div class="staff-empty">ยังไม่มีพื้นที่แผงลอย</div>';
    return `<div class="staff-locs" role="tablist" aria-label="เลือกพื้นที่แผงลอย">${locs.map(l => `<button type="button" role="tab" aria-selected="${l.id === cur.id}" class="${l.id === cur.id ? 'active' : ''}" onclick="staffSelectLoc('${l.id}')">${escapeHTML(l.name)}<small>${l.tenants.length} ราย · ${l.enabled ? 'เปิด' : 'ปิด'}</small></button>`).join('')}</div>${locationPanel(cur)}`;
}
let staffRatesView = 'menu';
function setRatesView(v) { staffRatesView = v; staffEditLocId = null; render(); }
/** หน้า "พื้นที่และราคา": เริ่มที่เมนูปุ่ม แล้วกดเข้าไปดูข้อมูลหรือกรอกฟอร์มทีละหัวข้อ */
function ratesHTML() {
    const stallCount = (row) => DEMO.stalls.filter(st => st.row === row).length;
    const locs = DEMO.outsideLocations.filter(l => !l.deleted);
    const tenants = locs.reduce((n, l) => n + l.tenants.length, 0);
    const titles = {
        menu: ['พื้นที่และราคา', 'เลือกหัวข้อที่ต้องการจัดการ'],
        locations: ['พื้นที่แผงลอยนอกผัง', 'เลือกพื้นที่เพื่อดูผู้เช่าและแก้ไข'],
        rates: ['ราคาแผงประจำ', 'มีผลกับบิลรอบถัดไป ยอดบิลที่ออกแล้วไม่เปลี่ยน'],
        addLoc: ['เพิ่มพื้นที่แผงลอย', 'ตั้งชื่อ ค่าเช่า และรอบการเช่า'],
    };
    const [title, sub] = titles[staffRatesView];
    const back = staffRatesView === 'menu' ? '' : `<button type="button" class="staff-back" onclick="setRatesView('menu')">${staffIcon('back', 16)}<span>กลับเมนูพื้นที่และราคา</span></button>`;
    const menuBody = `<div class="staff-menu">
    <button type="button" class="staff-menu-card" onclick="setRatesView('locations')"><span class="staff-menu-ico">${staffIcon('map', 22)}</span><div><b>พื้นที่แผงลอยนอกผัง</b><small>${locs.length} พื้นที่ · ${tenants} ผู้เช่า</small></div><span class="staff-menu-arrow" aria-hidden="true">›</span></button>
    <button type="button" class="staff-menu-card" onclick="setRatesView('rates')"><span class="staff-menu-ico">${staffIcon('tag', 22)}</span><div><b>ราคาแผงประจำ</b><small>แถว A–E · ค่าขยะแผง ${DEMO.rates.stallWaste} บาท</small></div><span class="staff-menu-arrow" aria-hidden="true">›</span></button>
    <button type="button" class="staff-menu-card" onclick="setRatesView('addLoc')"><span class="staff-menu-ico">${staffIcon('plus', 22)}</span><div><b>เพิ่มพื้นที่แผงลอย</b><small>สร้างพื้นที่ใหม่</small></div><span class="staff-menu-arrow" aria-hidden="true">›</span></button>
  </div>`;
    const rateBody = `<form class="staff-panel staff-form" onsubmit="saveStaffRates(event)">
    <div class="staff-rate-grid">${DEMO.planRows.map(r => `<label class="staff-field"><span>แถว ${r.id} · ${stallCount(r.id)} แผง</span><input name="${r.id}" type="number" min="0" max="100000" step="1" required value="${r.monthlyRate}"></label>`).join('')}</div>
    <label class="staff-field"><span>ค่าขยะแผง (บาท/เดือน)</span><input name="stallWaste" type="number" min="0" max="100000" step="1" required value="${DEMO.rates.stallWaste}"></label>
    <button type="submit" class="staff-wide">บันทึกราคา</button>
  </form>`;
    const addBody = `<form class="staff-panel staff-form" onsubmit="staffAddLocation(event)">
    ${locationFormFields()}
    <button type="submit" class="staff-wide">เพิ่มพื้นที่</button>
  </form>`;
    const body = { menu: () => menuBody, locations: locationSection, rates: () => rateBody, addLoc: () => addBody };
    return `${back}<div class="staff-head"><h1>${title}</h1><p>${sub}</p></div>${body[staffRatesView]()}`;
}
const STAFF_MODE = document.body.dataset.staff === 'waste' ? 'waste' : 'market';
const STAFF_TITLE = STAFF_MODE === 'waste' ? 'ค่าเก็บขยะบ้าน' : 'ค่าแผงตลาด';
const TAB_ICON = { overview: 'overview', manage: STAFF_MODE === 'market' ? 'stall' : 'house', payments: 'payment' };
let staffTab = 'overview';
let staffSub = 'plan';
let staffPlanStall = null;
const staffApp = document.getElementById('app');
const inMode = (b) => STAFF_MODE === 'market' ? b.payerType === 'stall' : b.payerType === 'household';
const staffPlace = (b) => b.payerType === 'household' ? `บ้านเลขที่ ${b.houseNo} หมู่ ${b.moo}` : b.stall ? `แผง ${b.stall}` : b.location || b.ref;
const staffTime = (at) => at ? new Date(at).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const staffIsOpen = (b) => inMode(b) && (PAYABLE.includes(b.status) || b.status === 'pending' || b.status === 'cash');
/** กลุ่มรายการที่อยู่ในสถานะเดียวกันของผู้จ่ายคนเดียวกัน = 1 การส่งเข้ามา */
function staffGroups(status) {
    const items = DEMO.bills.filter(b => inMode(b) && b.status === status);
    return [...new Set(items.map(b => b.ref))].map(ref => {
        const bills = items.filter(b => b.ref === ref);
        return { ref, bills, total: bills.reduce((n, b) => n + b.amount, 0), rec: paymentRecordFor(bills[0].id) };
    });
}
/** เปลี่ยนสถานะรายการของผู้จ่ายหนึ่งราย แล้วบันทึกให้หน้าประชาชนเห็นด้วย */
function staffSetRef(ref, from, to) {
    const all = loadPaymentRecords();
    const now = new Date().toISOString();
    for (const b of DEMO.bills.filter(x => x.ref === ref && x.status === from)) {
        const old = all[b.id];
        if (to === 'confirmed')
            all[b.id] = { status: 'confirmed', method: old?.method || 'qr', ref: old?.ref || `STF-${b.id.slice(-6)}`, at: now, amount: b.amount, slipName: old?.slipName };
        else
            all[b.id] = { status: 'rejected', method: old?.method || 'qr', ref: old?.ref || '', at: now, amount: b.amount };
        b.status = to;
    }
    writePaymentRecords(all);
    toast(to === 'confirmed' ? 'บันทึกการรับเงินแล้ว' : 'ตีกลับ/ยกเลิกรายการแล้ว · ผู้จ่ายเห็นเป็นยังไม่ชำระ');
    render();
}
let staffPlanFilter = null;
function openStallStatus(s) { staffTab = 'manage'; staffSub = 'plan'; staffPlanFilter = s; staffPlanStall = null; render(); window.scrollTo({ top: 0 }); }
function setStallFilter(s) { staffPlanFilter = s; staffPlanStall = null; render(); }
function setStaffTab(t) { staffTab = t; staffPlanFilter = null; staffSub = subsOf(t)[0]?.[0] ?? staffSub; render(); window.scrollTo({ top: 0 }); }
function setStaffSub(s) { staffSub = s; render(); }
/** เมนูย่อยของแต่ละหมวดหลัก */
function subsOf(t) {
    if (t === 'manage')
        return STAFF_MODE === 'market' ? [['plan', 'ผังแผง'], ['rates', 'พื้นที่/ราคา'], ['qr', 'QR แผง']] : [['qr', 'QR บ้าน']];
    if (t === 'payments') {
        const n = staffGroups('pending').length + staffGroups('cash').length;
        return [['queue', n ? `รอตรวจ (${n})` : 'รอตรวจ'], ['dues', 'ค้างชำระ'], ['report', 'รายงาน']];
    }
    return [];
}
function pickStaffStall(id) { staffPlanStall = staffPlanStall === id ? null : id; render(); }
function staffMetric(label, value, sub, icon, tone = '') {
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
    const countStall = (s) => DEMO.stalls.filter(x => x.status === s).length;
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
function queueCard(g, kind) {
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
const kindLabel = (b) => b.kind.includes('ขยะ') ? (b.payerType === 'household' ? 'ค่าขยะบ้าน' : 'ค่าขยะแผง') : b.kind;
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
        if (!found.length)
            return `<div class="staff-empty">ไม่พบ “${escapeHTML(staffDuesQ.trim())}” ในรายการค้างชำระ</div>`;
        return found.map(r => `<article class="staff-card">
      <div class="staff-card-head"><div><b>${escapeHTML(r.first.merchant)}</b><small>${escapeHTML(staffPlace(r.first))} · ${escapeHTML(r.ref)}</small></div><b class="staff-amount">${money(r.due)} บาท</b></div>
      <ul class="staff-lines">${r.bills.map(b => `<li><span>${escapeHTML(kindLabel(b))} · ${escapeHTML(b.month)}<small class="staff-line-status">${statusText[b.status] || b.status}</small></span><b>${money(b.amount)}</b></li>`).join('')}</ul>
      <div class="staff-actions one"><button type="button" onclick="staffOpenDetail('${escapeHTML(r.ref)}')">${staffIcon('payment', 16)}<span>รายละเอียดและรับชำระ</span></button></div>
    </article>`).join('');
    }
    if (!showAll)
        return '<div class="staff-empty staff-empty-home">ผลการค้นหาจะแสดงที่นี่</div>';
    const rows = duesRows();
    if (!rows.length)
        return '<div class="staff-empty">ไม่มียอดค้าง</div>';
    return `<div class="staff-panel staff-table">${rows.map(r => `<button type="button" class="staff-hit" onclick="staffOpenDetail('${escapeHTML(r.ref)}')">
      <span class="staff-hit-main"><b>${escapeHTML(r.first.merchant)}</b><small>${escapeHTML(staffPlace(r.first))} · ${escapeHTML(r.ref)}</small><small>${escapeHTML(r.months.join(' · '))}</small></span>
      <span class="staff-hit-end"><b>${money(r.due)} บาท</b>${r.pending ? '<span class="staff-chip reserved">รอตรวจ/รับเงิน</span>' : ''}</span>
      <span class="staff-hit-go" aria-hidden="true">›</span>
    </button>`).join('')}</div>`;
}
const METHOD_TEXT = { qr: 'สแกน QR', app: 'แอปธนาคาร', cash: 'เงินสด' };
/** รายละเอียดของผู้จ่ายหนึ่งราย: ทุกรายการที่ค้าง สถานะ ข้อมูลการชำระล่าสุด และปุ่มรับเงิน/ตีกลับตามสถานะ */
/** รับเงินที่เทศบาลแทนผู้จ่าย (เงินสด หรือสแกน QR แล้วโอนเข้า): รายการที่ค้างทั้งหมดของผู้จ่ายนี้ → ชำระแล้ว */
function staffCollectCounter(ref, method) {
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
function staffDetailHTML(ref, step = 'menu') {
    const bills = DEMO.bills.filter(b => b.ref === ref);
    if (!bills.length)
        return '';
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
function staffOpenDetail(ref, step = 'menu') {
    const html = staffDetailHTML(ref, step);
    if (!html)
        return;
    modalContent.innerHTML = html;
    // มือถือ: เต็มจอ · คอม: กล่องกลางจอที่เห็นข้อมูลครบโดยไม่ต้องเลื่อน
    const wide = window.matchMedia('(min-width: 900px)').matches;
    modal.classList.toggle('pay-full', !wide);
    modal.classList.toggle('staff-dlg', wide);
    if (!modal.open)
        modal.showModal();
}
/** พิมพ์ค้นหาแล้วอัปเดตเฉพาะรายการ (ไม่ render ทั้งหน้า จึงไม่หลุดโฟกัสช่องค้นหา) */
function staffDuesSearch(v) {
    staffDuesQ = v;
    const list = document.getElementById('dues-list');
    if (list)
        list.innerHTML = duesListHTML(list.dataset.home !== '1');
    const hint = document.getElementById('dues-hint');
    if (hint)
        hint.textContent = duesHintText();
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
const REPORT_MIN_OPTIONS = [[1, 'ค้างตั้งแต่ 1 เดือน'], [2, 'ค้าง 2 เดือนขึ้นไป'], [3, 'ค้าง 3 เดือนขึ้นไป']];
function setReportMin(n) { staffReportMin = n; render(); }
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
    const filters = [[null, 'ทั้งหมด'], ['occupied', 'เช่า'], ['reserved', 'จอง'], ['available', 'ว่าง']];
    const filterBar = `<div class="staff-filter-row">${filters.map(([v, l]) => `<button type="button" class="${staffPlanFilter === v ? 'active' : ''}" onclick="setStallFilter(${v ? `'${v}'` : 'null'})">${l}</button>`).join('')}</div>`;
    const sel = staffPlanStall ? DEMO.stalls.find(s => s.id === staffPlanStall) : undefined;
    const label = { available: 'ว่าง', reserved: 'จอง', occupied: 'เช่า' };
    const shown = staffPlanFilter ? DEMO.stalls.filter(s => s.status === staffPlanFilter) : DEMO.stalls;
    const rows = [...new Set(shown.map(s => s.row))];
    const detail = (() => {
        if (!sel)
            return '<p class="staff-hint">แตะแผงเพื่อดูผู้เช่าและยอดค้าง</p>';
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
const qrText = (code) => unescape(encodeURIComponent(code));
/** รายการที่ต้องออก QR: แผงทุกช่อง หรือบ้านที่มีในข้อมูล (ไม่ซ้ำ) */
function qrItems() {
    if (STAFF_MODE === 'market')
        return DEMO.stalls.map(s => ({ code: s.id, title: `แผง ${s.id}`, sub: s.tenantName || 'ว่าง' }));
    const seen = new Set();
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
function drawQrPng(code, title, sub) {
    const q = qrModules(qrText(code));
    const n = q.getModuleCount();
    const cell = 10;
    const m = 4;
    const size = (n + m * 2) * cell;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size + 120;
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
    ctx.fillStyle = '#0c4a6e';
    ctx.font = 'bold 34px "Noto Sans Thai", sans-serif';
    ctx.fillText(title, size / 2, size + 50);
    ctx.fillStyle = '#555';
    ctx.font = '24px "Noto Sans Thai", sans-serif';
    ctx.fillText(sub, size / 2, size + 92);
    return new Promise(ok => canvas.toBlob(b => ok(b), 'image/png'));
}
async function saveStaffQr(code, title, sub) {
    const blob = await drawQrPng(code, title, sub);
    if (!blob)
        return toast('สร้างรูป QR ไม่สำเร็จ');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-${STAFF_MODE}-${code.replace(/[^\w]+/g, '-')}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('บันทึกรูป QR แล้ว');
}
/** หน้าพิมพ์ทั้งหมดในหน้าต่างใหม่ (ปริ้นติดหน้าแผง/บ้าน) */
function printStaffQr() {
    const items = qrItems();
    const w = window.open('', '_blank');
    if (!w)
        return toast('เปิดหน้าพิมพ์ไม่ได้ · อนุญาตป็อปอัปของเว็บนี้แล้วลองใหม่');
    const cards = items.map(i => `<article class="card"><div class="qr">${qrSvg(qrText(i.code), i.title)}</div><b>${escapeHTML(i.code)}</b><small>${escapeHTML(i.title)}</small><small>${escapeHTML(i.sub)}</small></article>`).join('');
    w.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>QR ${STAFF_TITLE}</title><style>body{font-family:"Noto Sans Thai",sans-serif;margin:12mm;color:#111}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8mm}.card{border:1px solid #999;border-radius:6px;padding:6mm;text-align:center;break-inside:avoid}.qr svg{width:50mm;height:50mm;display:block;margin:0 auto}.card b{display:block;font-size:14pt;margin-top:3mm}.card small{display:block;font-size:10pt;color:#333}</style></head><body><div class="grid">${cards}</div></body></html>`);
    w.document.close();
    w.focus();
    w.print();
}
/** ปุ่มไปหน้าจัดการค่าแผง / ค่าขยะ — ใช้ลิงก์เดียวกับเมนูสลับหน้าด้านบน */
function manageLinksHTML() {
    const href = (key) => Array.from(document.querySelectorAll('.staff-switch a')).find(a => a.getAttribute('href')?.includes(key))?.getAttribute('href') || '#';
    return `<div class="staff-manage-links"><a class="staff-manage-btn" href="${href('market')}">จัดการค่าแผง</a><a class="staff-manage-btn" href="${href('waste')}">จัดการค่าขยะ</a></div>`;
}
function render() {
    const pending = staffGroups('pending').length + staffGroups('cash').length;
    const tabs = [
        ['overview', 'ภาพรวม', ''],
        ['manage', STAFF_MODE === 'market' ? 'จัดการแผง' : 'จัดการบ้าน', ''],
        ['payments', 'ตรวจชำระ', pending ? `<span class="staff-badge">${pending}</span>` : ''],
    ];
    const subs = subsOf(staffTab);
    const sub = subs.find(([s]) => s === staffSub)?.[0] ?? subs[0]?.[0];
    const views = { plan: planHTML, rates: ratesHTML, qr: qrHTML, queue: queueHTML, dues: duesHTML, report: reportHTML };
    const body = staffTab === 'overview' ? overviewHTML() : views[sub]();
    const subNav = subs.length > 1
        ? `<nav class="staff-subtabs" aria-label="เมนูย่อย">${subs.map(([v, label]) => `<button type="button" class="${sub === v ? 'active' : ''}" aria-current="${sub === v}" onclick="setStaffSub('${v}')">${label}</button>`).join('')}</nav>`
        : '';
    staffApp.innerHTML = homeBackHTML() + `<nav class="staff-tabs" aria-label="เมนูเจ้าหน้าที่" style="grid-template-columns:repeat(3,minmax(0,1fr))">${tabs.map(([t, label, badge]) => `<button type="button" class="${staffTab === t ? 'active' : ''}" aria-current="${staffTab === t}" onclick="setStaffTab('${t}')">${staffIcon(TAB_ICON[t])}<span>${label}</span>${badge}</button>`).join('')}</nav>${subNav}${body}
  <p class="help staff-foot">ระบบสาธิต · ข้อมูลและสถานะบันทึกเฉพาะเบราว์เซอร์นี้</p>`;
}
applySavedPayments();
render();
