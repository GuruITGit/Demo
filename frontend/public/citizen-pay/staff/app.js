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
const STAFF_MODE = document.body.dataset.staff === 'waste' ? 'waste' : 'market';
const STAFF_TITLE = STAFF_MODE === 'waste' ? 'ค่าเก็บขยะบ้าน' : 'ค่าแผงตลาด';
let staffTab = 'overview';
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
function setStaffTab(t) { staffTab = t; render(); window.scrollTo({ top: 0 }); }
function pickStaffStall(id) { staffPlanStall = staffPlanStall === id ? null : id; render(); }
function staffMetric(label, value, sub, tone = '') {
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
    const countStall = (s) => DEMO.stalls.filter(x => x.status === s).length;
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
function queueCard(g, kind) {
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
    const label = { available: 'ว่าง', reserved: 'จอง', occupied: 'เช่า' };
    const rows = [...new Set(DEMO.stalls.map(s => s.row))];
    const detail = (() => {
        if (!sel)
            return '<p class="staff-hint">แตะแผงเพื่อดูผู้เช่าและยอดค้าง</p>';
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
  <div class="staff-toolbar"><span>${items.length} ดวง</span><button type="button" onclick="printStaffQr()">พิมพ์ทั้งหมด</button></div>
  <div class="staff-qr-grid">${items.map(i => `<article class="staff-qr-card">
    <div class="staff-qr">${qrSvg(qrText(i.code), i.title)}</div>
    <b>${escapeHTML(i.code)}</b><small>${escapeHTML(i.sub)}</small>
    <button type="button" class="secondary" onclick="saveStaffQr('${escapeHTML(i.code)}','${escapeHTML(i.title)}','${escapeHTML(i.sub)}')">บันทึกรูป</button>
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
function render() {
    const pending = staffGroups('pending').length + staffGroups('cash').length;
    const tabs = [
        ['overview', 'ภาพรวม', ''],
        ['queue', 'รอตรวจ', pending ? `<span class="staff-badge">${pending}</span>` : ''],
        ['dues', 'ค้างชำระ', ''],
        ...(STAFF_MODE === 'market' ? [['plan', 'ผังแผง', '']] : []),
        ['qr', STAFF_MODE === 'market' ? 'QR แผง' : 'QR บ้าน', ''],
    ];
    const view = { overview: overviewHTML, queue: queueHTML, dues: duesHTML, plan: planHTML, qr: qrHTML };
    const body = view[staffTab]();
    staffApp.innerHTML = `<nav class="staff-tabs" aria-label="เมนูเจ้าหน้าที่" style="grid-template-columns:repeat(${tabs.length},minmax(0,1fr))">${tabs.map(([t, label, badge]) => `<button type="button" class="${staffTab === t ? 'active' : ''}" aria-current="${staffTab === t}" onclick="setStaffTab('${t}')">${label}${badge}</button>`).join('')}</nav>${body}
  <p class="help staff-foot">ระบบสาธิต · ข้อมูลและสถานะบันทึกเฉพาะเบราว์เซอร์นี้</p>`;
}
applySavedPayments();
render();
