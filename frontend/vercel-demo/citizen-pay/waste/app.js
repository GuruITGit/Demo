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
    return `<div class="page-heading${headingClass}"><button class="back-link" onclick="location.href='/citizen'">‹ กลับหน้าแรก</button><h1>${h1}</h1><p>ค้นหา${label} · ไม่ต้องเข้าสู่ระบบ</p></div><form class="search-card" onsubmit="event.preventDefault();searchBills(this.query.value)"><label for="query">${label}</label><div class="search-row"><input id="query" name="query" value="${escapeHTML(searchTerm)}" placeholder="${placeholder}"><button type="submit">ค้นหา</button></div><p class="help">${hint}</p></form>`;
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
        body = `<div class="cash-info"><b>จ่ายเงินสดที่ ${escapeHTML(PAYMENT.cashPlace)}</b><small>${escapeHTML(PAYMENT.cashHours)}</small><ol><li>กด “ขอเลขอ้างอิง” ด้านล่าง</li><li>แสดงเลขอ้างอิง (หรือ QR) ให้เจ้าหน้าที่</li><li>รับใบเสร็จจากเจ้าหน้าที่</li></ol></div>${accountBlockHTML()}`;
        actions = `<button class="secondary" onclick="modal.close()">กลับ</button><button onclick="submitCashPayment()">ขอเลขอ้างอิง</button>`;
    }
    else {
        const payload = promptpayPayload(PAYMENT.promptpayId, total, PAYMENT.promptpayType);
        const qrBlock = `<div class="pay-qr">${qrSvg(payload, 'QR พร้อมเพย์ ยอด ' + money(total) + ' บาท')}<b>${money(total)} บาท</b><small>โอนเข้า ${escapeHTML(PAYMENT.payeeName)}</small></div>`;
        const slip = `<div class="slip-box"><label class="upload scan-upload">${slipFile ? 'เปลี่ยนรูปสลิป' : 'แนบรูปสลิป (จำเป็น)'}<input type="file" accept="image/*" onchange="pickSlip(this)"></label>${slipFile ? `<div class="slip-preview"><img src="${slipPreviewUrl}" alt="สลิปที่แนบ"><span>${escapeHTML(slipFile.name)}</span></div>` : ''}</div>`;
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
// ข้อมูลตัวอย่างค่าขยะบ้าน (ยังไม่มี backend) — ค้นหาได้ด้วย บ้านเลขที่+หมู่ / ชื่อ / เบอร์โทร (เบอร์ตัวอย่าง 081-000-xxxx)
const DEMO = {
    bills: [
        { id: 'INV-HH-2569-10-014', payerType: 'household', merchant: 'สมชาย ใจบุญ', ref: 'HH-014', location: 'บ้านเลขที่ 18 หมู่ 2', houseNo: '18', moo: '2', phone: '0810000014', kind: 'ค่าขยะ', month: 'ตุลาคม 2569', due: '31 ต.ค. 2569', amount: 40, status: 'unpaid' },
        { id: 'INV-HH-2569-09-009', payerType: 'household', merchant: 'สมชาย ใจบุญ', ref: 'HH-014', location: 'บ้านเลขที่ 18 หมู่ 2', houseNo: '18', moo: '2', phone: '0810000014', kind: 'ค่าขยะ', month: 'กันยายน 2569', due: '30 ก.ย. 2569', amount: 40, status: 'unpaid' },
        { id: 'INV-HH-2569-10-021', payerType: 'household', merchant: 'สมใจ ใจดี', ref: 'HH-021', location: 'บ้านเลขที่ 7 หมู่ 3', houseNo: '7', moo: '3', phone: '0810000021', kind: 'ค่าขยะ', month: 'ตุลาคม 2569', due: '31 ต.ค. 2569', amount: 40, status: 'unpaid' },
        { id: 'INV-HH-2569-10-030', payerType: 'household', merchant: 'มะลิ แสงทอง', ref: 'HH-030', location: 'บ้านเลขที่ 18 หมู่ 5', houseNo: '18', moo: '5', phone: '0810000030', kind: 'ค่าขยะ', month: 'ตุลาคม 2569', due: '31 ต.ค. 2569', amount: 40, status: 'unpaid' },
        { id: 'INV-HH-2569-10-042', payerType: 'household', merchant: 'ประยูร ทองดี', ref: 'HH-042', location: 'บ้านเลขที่ 12/3 หมู่ 2', houseNo: '12/3', moo: '2', phone: '0810000042', kind: 'ค่าขยะ', month: 'ตุลาคม 2569', due: '31 ต.ค. 2569', amount: 40, status: 'unpaid' }
    ]
};
// หน้าค่าเก็บขยะ (/citizen/waste) — แสดงเฉพาะค่าขยะบ้านที่ยังค้าง · ค้นหาด้วย บ้านเลขที่+หมู่ / ชื่อ / เบอร์โทร · สแกน QR หน้าบ้าน
// ส่วนรายการบิล + การจ่ายเงิน + ตัวสแกน QR มาจาก ../shared (รวมเข้า app.js ตอน build)
const app = document.getElementById('app');
// ค้นหาค่าขยะบ้าน: เบอร์โทร (ตรงทั้งเบอร์) · บ้านเลขที่ (+หมู่) ตรงตัว เช่น "18 หมู่ 2", "บ้านเลขที่ 12/3 ม.2" · หรือชื่อ/รหัสบ้าน
function householdMatches(b, query) {
    const q = query.replace(/[๐-๙]/g, d => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(d))).replace(/\s+/g, ' ').trim();
    if (!q)
        return false;
    const digits = q.replace(/[\s-]/g, '');
    if (/^0\d{8,9}$/.test(digits))
        return (b.phone || '').replace(/\D/g, '') === digits;
    const moo = q.match(/(?:หมู่(?:ที่)?|ม\.)\s*(\d+)/);
    const rest = (moo ? q.replace(moo[0], ' ') : q).trim();
    const house = rest.match(/^(?:บ้านเลขที่|เลขที่)?\s*(\d+(?:\/\d+)?)$/);
    if (house || moo) {
        if (!house)
            return false;
        return b.houseNo === house[1] && (!moo || b.moo === String(Number(moo[1])));
    }
    return matchesAllTokens(`${b.merchant} ${b.ref}`, searchTokens(q));
}
// สแกน QR หน้าบ้าน: ข้อมูลใน QR คือบ้านเลขที่และหมู่ เช่น "18 หมู่ 2" แล้วค้นหาเหมือนพิมพ์เอง
function scanHouseQr() { startQrScan({ title: 'สแกน QR หน้าบ้าน', help: 'หันกล้องไปที่ QR หน้าบ้าน เช่น 18 หมู่ 2', demoCode: '18 หมู่ 2', demoLabel: 'ทดลองดูค่าขยะตัวอย่าง 18 หมู่ 2', onCode: searchBills }); }
const CASH_HOUSE_ART = '<img class="shortcut-art shortcut-art-photo" src="/citizen-pay/shared/img/cash-pay-house.webp" width="600" height="338" alt="" aria-hidden="true">';
const SCAN_HOUSE_ART = '<img class="shortcut-art shortcut-art-photo" src="/citizen-pay/shared/img/scan-qr-house.webp" width="600" height="338" alt="" aria-hidden="true">';
// จ่ายเงินสด: ไม่มียอดให้จ่ายออนไลน์ ต้องไปจ่ายที่ อบต. (สถานที่/เวลาอ่านจาก payment-config)
function openCashInfo() { modalContent.innerHTML = `<div class="modal-inner"><div class="modal-top pay-top"><button type="button" class="pay-back" onclick="modal.close()">‹ กลับ</button><h2 id="modalTitle">จ่ายเงินสด</h2><span></span></div><div class="modal-body"><div class="cash-info"><b>ไปจ่ายที่ ${escapeHTML(PAYMENT.cashPlace)}</b><small>${escapeHTML(PAYMENT.cashHours)}</small><ol><li>ค้นหาบ้านเลขที่และหมู่ของคุณ หรือสแกน QR หน้าบ้าน</li><li>แจ้งบ้านเลขที่และหมู่ให้เจ้าหน้าที่</li><li>ชำระเงินและรับใบเสร็จจากเจ้าหน้าที่</li></ol></div>${accountBlockHTML()}</div><div class="modal-actions"><button type="button" onclick="modal.close()">เข้าใจแล้ว</button></div></div>`; modal.classList.add('pay-full'); modal.showModal(); }
function render() {
    const matches = searchTerm ? DEMO.bills.filter(b => PAYABLE.includes(b.status) && householdMatches(b, searchTerm)).sort((a, b) => b.id.localeCompare(a.id)) : [];
    const shortcut = searchTerm ? '' : `<div class="payment-shortcuts"><button class="payment-shortcut" type="button" onclick="scanHouseQr()">${SCAN_HOUSE_ART}<b>สแกน QR หน้าบ้าน</b><small>ส่องรหัสหน้าบ้านหรือเลือกรูป QR เพื่อดูค่าขยะ</small></button><button class="payment-shortcut payment-shortcut-cash" type="button" onclick="openCashInfo()">${CASH_HOUSE_ART}<b>จ่ายเงินสด</b><small>ไปจ่ายที่ ${escapeHTML(PAYMENT.cashPlace)}</small></button></div>`;
    app.innerHTML = searchHeaderHTML('จ่ายค่าขยะ', 'บ้านเลขที่และหมู่ ชื่อ หรือเบอร์โทร', 'เช่น 18 หมู่ 2 · สมชาย · 081-000-0014', 'ลองค้นหา “18 หมู่ 2”, “สมชาย” หรือ “081-000-0014”', ' with-photo with-waste-photo')
        + shortcut + billListHTML({ title: 'ค่าขยะ', matches, promptText: 'พิมพ์บ้านเลขที่และหมู่ ชื่อ หรือเบอร์โทร', payerLabel: b => b.location || b.ref, chargeLabel: () => 'ค่าขยะครัวเรือน' });
}
applySavedPayments();
render();
