// การชำระเงิน (ใช้ร่วมหน้าค่าแผง/ค่าขยะ): QR พร้อมเพย์ (สแกน/บันทึกรูป) · เปิดแอปธนาคาร · เงินสดที่ อบต. · แนบสลิป
// ยังไม่มี backend — สถานะที่ส่งแล้วเก็บใน localStorage ของเครื่องนี้เท่านั้น (เจ้าหน้าที่ยังไม่เห็น)
declare const qrcode: (typeNumber: number, level: string) => { addData(s: string): void; make(): void; getModuleCount(): number; isDark(r: number, c: number): boolean };

type PayMethod = 'qr' | 'app' | 'cash';
interface PaymentRecord { status: 'pending' | 'cash' | 'confirmed' | 'rejected'; method: PayMethod; ref: string; at: string; amount: number; slipName?: string; note?: string; meta?: { t: string; s: string; k: string; m: string } }

const PAY_STORE = 'market:payments';
let payMethod: PayMethod = 'qr';
let payBillIds: string[] = [];
let payRef = '';
let slipFile: File | null = null;
let slipPreviewUrl = '';

// ---------- เก็บสถานะ (เครื่องนี้) ----------
function loadPaymentRecords(): Record<string, PaymentRecord> {
  try {
    const raw = JSON.parse(localStorage.getItem(PAY_STORE) || '{}');
    if (!raw || typeof raw !== 'object') return {};
    const out: Record<string, PaymentRecord> = {};
    for (const [id, r] of Object.entries(raw as Record<string, PaymentRecord>)) {
      if (r && ['pending', 'cash', 'confirmed', 'rejected'].includes(r.status) && typeof r.ref === 'string') out[id] = r;
    }
    return out;
  } catch { return {}; }
}
function writePaymentRecords(all: Record<string, PaymentRecord>) { try { localStorage.setItem(PAY_STORE, JSON.stringify(all)); } catch {} }
/** เรียกครั้งเดียวก่อน render แรก — คืนสถานะ "รอตรวจสอบ/รอจ่ายเงินสด" ที่เคยส่งจากเครื่องนี้ */
function applySavedPayments() {
  const all = loadPaymentRecords();
  for (const b of DEMO.bills) { const r = all[b.id]; if (r) { b.status = r.status === 'rejected' ? 'unpaid' : r.status; if (r.status === 'rejected' && r.note) b.note = r.note; } }
}
function paymentRecordFor(billId: string) { return loadPaymentRecords()[billId]; }

// ---------- QR พร้อมเพย์ (EMVCo Thai QR) — ยกมาจาก backend/src/modules/water/promptpay-qr.ts ----------
function tlv(tag: string, value: string) { return tag + value.length.toString().padStart(2, '0') + value; }
function crc16(s: string) {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = (crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
function promptpayPayload(id: string, amount: number, type: string) {
  const d = (id || '').replace(/\D/g, '');
  const t = type === 'ewallet' || d.length >= 15 ? { tag: '03', value: d }
    : type === 'natid' || d.length >= 13 ? { tag: '02', value: d }
    : { tag: '01', value: ('0000000000000' + d.replace(/^0/, '66')).slice(-13) };
  const hasAmount = amount > 0;
  let p = tlv('00', '01') + tlv('01', hasAmount ? '12' : '11') + tlv('29', tlv('00', 'A000000677010111') + tlv(t.tag, t.value)) + tlv('58', 'TH') + tlv('53', '764');
  if (hasAmount) p += tlv('54', amount.toFixed(2));
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
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch { toast('คัดลอกไม่สำเร็จ · เลขบัญชี ' + text); }
    ta.remove();
  };
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, fallback);
  else fallback();
}

function qrModules(text: string) { const q = qrcode(0, 'M'); q.addData(text); q.make(); return q; }
function qrSvg(text: string, label: string) {
  const q = qrModules(text); const n = q.getModuleCount(); const m = 2; let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`;
  return `<svg class="qr-svg" viewBox="0 0 ${n + m * 2} ${n + m * 2}" role="img" aria-label="${escapeHTML(label)}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#111"/></svg>`;
}
/** รูป PNG ของ QR + ยอด สำหรับบันทึกลงเครื่องแล้วเปิดในแอปธนาคาร */
function qrPngBlob(text: string, caption: string): Promise<Blob | null> {
  const q = qrModules(text); const n = q.getModuleCount(); const cell = 10; const m = 4; const size = (n + m * 2) * cell;
  const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size + 90;
  const ctx = canvas.getContext('2d'); if (!ctx) return Promise.resolve(null);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#111';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) ctx.fillRect((c + m) * cell, (r + m) * cell, cell, cell);
  ctx.textAlign = 'center'; ctx.font = 'bold 30px sans-serif'; ctx.fillText(caption, size / 2, size + 40);
  ctx.font = '20px sans-serif'; ctx.fillStyle = '#555'; ctx.fillText(PAYMENT.payeeName, size / 2, size + 74);
  return new Promise(ok => canvas.toBlob(b => ok(b), 'image/png'));
}

// ---------- ขั้นตอนจ่าย ----------
const selectedPayableBills = () => DEMO.bills.filter(b => selectedBills.has(b.id) && (b.status === 'unpaid' || b.status === 'mismatch'));
const payTotal = () => payBillIds.reduce((n, id) => n + (DEMO.bills.find(b => b.id === id)?.amount || 0), 0);
function newPaymentRef(prefix: string) {
  const d = new Date(); const ymd = `${String(d.getFullYear() + 543).slice(-2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `${prefix}-${ymd}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
}
const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
modal.addEventListener('close', () => modal.classList.remove('pay-full'));

function openPayment() {
  const items = selectedPayableBills();
  if (!items.length) return toast('เลือกเดือนที่ต้องการจ่ายก่อนค่ะ');
  payBillIds = items.map(b => b.id);
  payMethod = hasPromptpay() ? (isMobile() ? 'app' : 'qr') : 'cash';
  clearSlip();
  renderPaymentModal();
  modal.showModal();
}
function setPayMethod(m: PayMethod) { payMethod = m; renderPaymentModal(); }

function slipBoxHTML(optional: boolean) {
  const label = slipFile ? 'เปลี่ยนรูปสลิป' : optional ? 'แนบรูปสลิป (ถ้ามี)' : 'แนบรูปสลิป (จำเป็น)';
  return `<div class="slip-box"><label class="upload scan-upload">${label}<input type="file" accept="image/*" onchange="pickSlip(this)"></label>${slipFile ? `<div class="slip-preview"><img src="${slipPreviewUrl}" alt="สลิปที่แนบ"><span>${escapeHTML(slipFile.name)}</span></div>` : ''}</div>`;
}

function renderPaymentModal() {
  const items = DEMO.bills.filter(b => payBillIds.includes(b.id));
  const total = payTotal();
  const grouped = groupBillsByPayerMonth(items);
  const methods: [PayMethod, string][] = hasPromptpay() ? [['qr', 'สแกน QR'], ['app', 'แอปธนาคาร'], ['cash', 'เงินสด']] : [['cash', 'เงินสด']];
  const tabs = `<div class="pay-methods" role="tablist">${methods.map(([m, label]) => `<button type="button" role="tab" aria-selected="${payMethod === m}" class="${payMethod === m ? 'active' : ''}" onclick="setPayMethod('${m}')">${label}</button>`).join('')}</div>`;
  const summary = `<div class="pay-hero"><small>ยอดที่ต้องชำระ · ${grouped.length} เดือน</small><b>${money(total)} บาท</b></div><div class="payment-months">${grouped.map(g => `<div><span>${escapeHTML(g.month)}</span><b>${money(g.bills.reduce((n, b) => n + b.amount, 0))} บาท</b></div>`).join('')}</div>`;
  const demoNote = PAYMENT.demo ? `<p class="privacy-note">ระบบสาธิต · เลขพร้อมเพย์เป็นเลขตัวอย่าง โอนจริงไม่ได้</p>` : '';
  let body = '', actions = '';
  if (payMethod === 'cash') {
    body = `<div class="cash-info"><b>จ่ายเงินสดที่ ${escapeHTML(PAYMENT.cashPlace)}</b><small>${escapeHTML(PAYMENT.cashHours)}</small><ol><li>กด “ขอเลขอ้างอิง” ด้านล่าง</li><li>แสดงเลขอ้างอิง (หรือ QR) ให้เจ้าหน้าที่</li><li>รับใบเสร็จจากเจ้าหน้าที่</li></ol></div>${accountBlockHTML()}${slipBoxHTML(true)}`;
    actions = `<button class="secondary" onclick="modal.close()">กลับ</button><button onclick="submitCashPayment()">ขอเลขอ้างอิง</button>`;
  } else {
    const payload = promptpayPayload(PAYMENT.promptpayId, total, PAYMENT.promptpayType);
    const qrBlock = `<div class="pay-qr">${qrSvg(payload, 'QR พร้อมเพย์ ยอด ' + money(total) + ' บาท')}<b>${money(total)} บาท</b><small>โอนเข้า ${escapeHTML(PAYMENT.payeeName)}</small></div>`;
    const slip = slipBoxHTML(false);
    if (payMethod === 'qr') {
      const save = `<button type="button" class="secondary small save-qr" onclick="saveQrImage()">บันทึกรูป QR ลงเครื่อง</button>`;
      body = qrBlock + accountBlockHTML() + save +`<p class="help">เปิดแอปธนาคาร → สแกน → ส่องที่ QR นี้ (ยอดเงินกรอกให้อัตโนมัติ) หรือบันทึกรูปแล้วเลือกจาก “รูปภาพ/อัลบั้ม” ในแอป</p>` + slip;
    } else {
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
  if (!blob) return toast('สร้างรูป QR ไม่สำเร็จ');
  const file = new File([blob], `qr-ค่าแผง-${money(total)}.png`, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  // มือถือ: เปิดแผ่นแชร์ → "บันทึกรูปภาพ" (iPhone ดาวน์โหลดตรงไม่ได้)
  if (nav.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: 'QR ชำระค่าแผง' }); return; } catch (e) { if ((e as Error).name === 'AbortError') return; } }
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast('บันทึกรูป QR แล้ว');
}

function openBankApp(i: number) {
  const bank = PAYMENT.banks[i]; if (!bank) return;
  if (!isMobile()) return toast('เปิดแอปธนาคารได้บนมือถือเท่านั้น');
  let left = false; const onHide = () => { if (document.hidden) left = true; };
  document.addEventListener('visibilitychange', onHide);
  window.location.href = bank.scheme;
  setTimeout(() => { document.removeEventListener('visibilitychange', onHide); if (!left) toast(`เปิด ${bank.name} ไม่ได้ · เครื่องอาจไม่มีแอปนี้ ลองเปิดแอปเอง`); }, 1800);
}

function clearSlip() { if (slipPreviewUrl) URL.revokeObjectURL(slipPreviewUrl); slipFile = null; slipPreviewUrl = ''; }
function pickSlip(input: HTMLInputElement) {
  const f = input.files?.[0]; if (!f) return;
  if (!f.type.startsWith('image/')) return toast('แนบได้เฉพาะรูปภาพ');
  if (f.size > 10 * 1024 * 1024) return toast('รูปใหญ่เกิน 10 MB');
  clearSlip(); slipFile = f; slipPreviewUrl = URL.createObjectURL(f); renderPaymentModal();
}

/** หน้าที่ต่อ API จริงตั้งค่านี้: ส่งการแจ้งชำระของบิลที่เลือก · คืน null = ไม่สำเร็จ · ไม่ตั้ง = ใช้ข้อมูลตัวอย่างในเครื่อง */
type SubmitResult = { status: 'paid' | 'pending'; reason?: string | null };
let billSubmitter: ((ids: string[], method: 'transfer' | 'cash', slip: File | null) => Promise<SubmitResult | null>) | null = null;
function recordPayment(status: 'pending' | 'cash', ref: string) {
  const all = loadPaymentRecords(); const at = new Date().toISOString(); const amount = payTotal();
  for (const id of payBillIds) {
    const b = DEMO.bills.find(x => x.id === id); if (!b) continue;
    b.status = status; all[id] = { status, method: payMethod, ref, at, amount, slipName: slipFile?.name, meta: { t: b.payerType, s: b.stall || b.ref, k: b.kind, m: b.month } };
  }
  writePaymentRecords(all);
}
async function submitTransferPayment() {
  if (!slipFile) return toast('แนบรูปสลิปก่อนส่งค่ะ');
  if (billSubmitter) {
    const res = await billSubmitter(payBillIds, 'transfer', slipFile);
    if (!res) return;
    clearSlip(); resetSelection(); modal.close();
    toast(res.status === 'paid' ? 'ตรวจสลิปผ่านแล้ว · ชำระเรียบร้อย' : res.reason ? `ส่งสลิปแล้ว · ${res.reason}` : 'ส่งสลิปแล้ว · รอเจ้าหน้าที่ตรวจสอบ');
    render(); return;
  }
  recordPayment('pending', newPaymentRef('TRF'));
  clearSlip(); resetSelection(); modal.close(); toast('ส่งสลิปแล้ว · รอเจ้าหน้าที่ตรวจสอบ'); render();
}
async function submitCashPayment() {
  if (billSubmitter) { const total = payTotal(); const res = await billSubmitter(payBillIds, 'cash', null); if (!res) return; clearSlip(); resetSelection(); render(); showCashTicket(newPaymentRef('CSH'), total); return; }
  payRef = newPaymentRef('CSH'); const total = payTotal();
  recordPayment('cash', payRef); clearSlip(); resetSelection(); render();
  showCashTicket(payRef, total);
}
/** ใบนัดจ่ายเงินสด — เปิดซ้ำได้จากการ์ดเดือนที่สถานะ "รอจ่ายเงินสด" */
function showCashTicket(ref: string, amount?: number) {
  const ids = Object.entries(loadPaymentRecords()).filter(([, r]) => r.ref === ref).map(([id]) => id);
  const total = amount ?? ids.reduce((n, id) => n + (DEMO.bills.find(b => b.id === id)?.amount || 0), 0);
  modalContent.innerHTML = `<div class="modal-inner"><div class="modal-top"><h2 id="modalTitle">เลขอ้างอิงจ่ายเงินสด</h2><button class="close-btn" onclick="modal.close()" aria-label="ปิด">×</button></div><div class="modal-body"><div class="pay-qr">${qrSvg(ref, 'QR เลขอ้างอิง ' + ref)}<b class="cash-ref">${escapeHTML(ref)}</b><small>ยอด ${money(total)} บาท</small></div><div class="cash-info"><b>นำไปจ่ายที่ ${escapeHTML(PAYMENT.cashPlace)}</b><small>${escapeHTML(PAYMENT.cashHours)}</small><small>แคปหน้าจอนี้ไว้ แสดงให้เจ้าหน้าที่ตอนจ่าย</small></div></div><div class="modal-actions"><button class="secondary" onclick="cancelCashPayment('${escapeHTML(ref)}')">เปลี่ยนวิธีจ่าย</button><button onclick="modal.close()">เรียบร้อย</button></div></div>`;
  if (!modal.open) modal.showModal();
}
function cancelCashPayment(ref: string) {
  const all = loadPaymentRecords();
  for (const [id, r] of Object.entries(all)) {
    if (r.ref !== ref || r.status !== 'cash') continue;
    delete all[id]; const b = DEMO.bills.find(x => x.id === id); if (b && b.status === 'cash') b.status = 'unpaid';
  }
  writePaymentRecords(all); modal.close(); toast('ยกเลิกเลขอ้างอิงแล้ว · เลือกวิธีจ่ายใหม่ได้'); render();
}
