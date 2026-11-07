// หน้าค่าเก็บขยะ (/citizen/waste) — แสดงเฉพาะค่าขยะบ้านที่ยังค้าง · ค้นหาด้วย บ้านเลขที่+หมู่ / ชื่อ / เบอร์โทร · สแกน QR หน้าบ้าน
// ส่วนรายการบิล + การจ่ายเงิน + ตัวสแกน QR มาจาก ../shared (รวมเข้า app.js ตอน build)
const app = document.getElementById('app') as HTMLElement;

// ค้นหาค่าขยะบ้าน: เบอร์โทร (ตรงทั้งเบอร์) · บ้านเลขที่ (+หมู่) ตรงตัว เช่น "18 หมู่ 2", "บ้านเลขที่ 12/3 ม.2" · หรือชื่อ/รหัสบ้าน
function householdMatches(b:Bill,query:string){
 const q=query.replace(/[๐-๙]/g,d=>String('๐๑๒๓๔๕๖๗๘๙'.indexOf(d))).replace(/\s+/g,' ').trim();if(!q)return false;
 const digits=q.replace(/[\s-]/g,'');
 if(/^0\d{8,9}$/.test(digits))return (b.phone||'').replace(/\D/g,'')===digits;
 const moo=q.match(/(?:หมู่(?:ที่)?|ม\.)\s*(\d+)/);
 const rest=(moo?q.replace(moo[0],' '):q).trim();
 const house=rest.match(/^(?:บ้านเลขที่|เลขที่)?\s*(\d+(?:\/\d+)?)$/);
 if(house||moo){if(!house)return false;return b.houseNo===house[1]&&(!moo||b.moo===String(Number(moo[1])))}
 return matchesAllTokens(`${b.merchant} ${b.ref}`,searchTokens(q));
}

// ข้อความจาก QR หน้าบ้าน: ลิงก์ ...?house=18&moo=2 → "18 หมู่ 2" · ข้อความอื่นใช้ตามเดิม
function houseFromQr(raw:string){
 const t=raw.trim();
 const u=(()=>{try{return new URL(t,location.href)}catch{return null}})();
 const house=u?.searchParams.get('house')?.trim();
 if(!house)return t;
 const moo=u.searchParams.get('moo')?.trim();
 return moo?`${house} หมู่ ${moo}`:house;
}
// QR ประจำบ้านแบบมีรหัสลับ (?h=HH-014&k=...): สแกนแล้วเห็นยอดเลย ไม่ต้องพิมพ์อะไร
function parseHouseKeyLink(raw:string){
 const u=(()=>{try{return new URL(raw.trim(),location.href)}catch{return null}})();
 const h=u?.searchParams.get('h')?.trim(),k=u?.searchParams.get('k')?.trim();
 return h&&k?{ref:h,key:k}:null;
}
// สแกน QR หน้าบ้าน: QR ใหม่ (มีรหัสลับ) แสดงยอดทันที · QR เก่า (บ้านเลขที่+หมู่) ให้กรอกชื่อผู้รับบิลเอง
function scanHouseQr(){startQrScan({title:'สแกน QR หน้าบ้าน',help:'หันกล้องไปที่ QR หน้าบ้าน แล้วระบบจะแสดงยอดให้เลย',demoCode:location.origin+'/citizen/waste?h=HH-021&k=demo',demoLabel:'ทดลองดูค่าขยะตัวอย่าง 7 หมู่ 3',onCode:(code:string)=>{const k=parseHouseKeyLink(code);if(k){void searchWasteByKey(k.ref,k.key);return}qrHouse=houseFromQr(code);if(PAYMENT.demo&&fillDemoHouse())return;render();toast('กรอกชื่อผู้รับบิลแล้วกดค้นหา')}})}

const CASH_HOUSE_ART='<img class="shortcut-art shortcut-art-photo" src="/citizen-pay/shared/img/cash-pay-house.webp" width="600" height="338" alt="" aria-hidden="true">';
const SCAN_HOUSE_ART='<img class="shortcut-art shortcut-art-photo" src="/citizen-pay/shared/img/scan-qr-house.webp" width="600" height="338" alt="" aria-hidden="true">';
// จ่ายเงินสด: ไม่มียอดให้จ่ายออนไลน์ ต้องไปจ่ายที่ อบต. (สถานที่/เวลาอ่านจาก payment-config)
function openCashInfo(){modalContent.innerHTML=`<div class="modal-inner"><div class="modal-top pay-top"><button type="button" class="pay-back" onclick="modal.close()">‹ กลับ</button><h2 id="modalTitle">จ่ายเงินสด</h2><span></span></div><div class="modal-body"><div class="cash-info"><b>ไปจ่ายที่ ${escapeHTML(PAYMENT.cashPlace)}</b><small>${escapeHTML(PAYMENT.cashHours)}</small><ol><li>ค้นหาบ้านเลขที่และหมู่ของคุณ หรือสแกน QR หน้าบ้าน</li><li>แจ้งบ้านเลขที่และหมู่ให้เจ้าหน้าที่</li><li>ชำระเงินและรับใบเสร็จจากเจ้าหน้าที่</li></ol></div>${accountBlockHTML()}</div><div class="modal-actions"><button type="button" onclick="modal.close()">เข้าใจแล้ว</button></div></div>`;modal.classList.add('pay-full');modal.showModal()}

// ---------- ต่อ API จริง: ชื่อผู้รับบิล + บ้านเลขที่ ต้องตรงกันจึงเห็นยอด ----------
let verifiedName = '';
let draftQuery = '';
let qrHouse = ''; // บ้านเลขที่+หมู่ที่ได้จาก QR หน้าบ้าน — มีค่าแล้วกรอกแค่ชื่อ
const enc = (v: string) => encodeURIComponent(v);
/** แปลงบิลจาก API เป็นรูปแบบบิลของหน้านี้ (ชื่อที่ผู้ใช้กรอกใช้แทนชื่อที่ถูกปกปิด) */
function toWasteBill(x: any): Bill {
  const cash = x.status === 'pending' && x.submittedMethod === 'cash';
  const status: BillStatus = x.status === 'pending' ? (cash ? 'cash' : 'pending') : x.status === 'mismatch' ? 'mismatch' : 'unpaid';
  return { id: x.id, payerType: 'household', merchant: verifiedName || x.holderName, ref: x.householdRef, location: `บ้านเลขที่ ${x.houseNo} หมู่ ${Number(x.moo)}`, houseNo: x.houseNo, moo: x.moo, phone: x.phone || '', kind: 'ค่าเก็บขยะ', month: periodToThai(x.period), due: x.dueDate || '', amount: Number(x.amount), status, note: x.reviewNote || undefined };
}
const STATIC_HOUSE_BILLS: Bill[] = DEMO.bills.slice();
/** เดโม่: บิลค่าขยะทุกครัวเรือนที่หน้าเจ้าหน้าที่เดโม่ซิงก์มา (คีย์เดียวกับแผงลอย แถวที่มี hh) — ไม่มี = ใช้ข้อมูลตัวอย่างในไฟล์ */
function demoHouseBills(): Bill[] {
  try {
    const v = JSON.parse(localStorage.getItem('lamplaimat:demo-outside-bills') || '[]');
    const rows = (Array.isArray(v) ? v : []).filter((x: any) => x && x.hh);
    if (!rows.length) return STATIC_HOUSE_BILLS;
    const out = rows.map((x: any): Bill => ({ id: x.id, payerType: 'household', merchant: x.holderName, ref: x.householdRef, location: 'บ้านเลขที่ ' + x.houseNo + ' หมู่ ' + Number(x.moo), houseNo: x.houseNo, moo: String(Number(x.moo)), phone: x.phone || '', kind: 'ค่าเก็บขยะ', month: periodToThai(x.period), due: x.dueDate || '', amount: Number(x.amount), status: x.status === 'pending' ? (x.submittedMethod === 'cash' ? 'cash' : 'pending') : x.status === 'mismatch' ? 'mismatch' : 'unpaid', note: x.reviewNote || undefined }));
    const saved = loadPaymentRecords(); // สถานะที่ผู้ใช้เครื่องนี้เพิ่งแจ้งชำระ
    for (const b of out) { const r = saved[b.id]; if (r) b.status = r.status === 'rejected' ? 'unpaid' : r.status; }
    return out;
  } catch { return STATIC_HOUSE_BILLS; }
}
let demoBillsAll: Bill[] | null = null;
async function searchWasteBills(name: string, q: string) {
  verifiedName = name.trim(); draftQuery = q.trim();
  searchTerm = draftQuery; resetSelection();
  if (!searchTerm) return render();
  if (verifiedName.length < 4) { toast('กรุณากรอกชื่อ-นามสกุลผู้รับบิล'); searchTerm = ''; return render(); }
  try {
    const rows = await payApi<any[]>(`/waste/bills?q=${enc(searchTerm)}&name=${enc(verifiedName)}`);
    if (rows === null) { // เดโม่: ไม่มี API → กรองข้อมูลตัวอย่างให้ตรงทั้งชื่อและบ้านเลขที่/เบอร์/รหัสครัวเรือน
      demoBillsAll = demoHouseBills();
      const k = (s: string) => s.replace(/\s+/g, '').replace(/หมู่ที่|ม\./g, 'หมู่');
      DEMO.bills = demoBillsAll.filter((b) => b.payerType === 'household' && demoNameKey(b.merchant) === demoNameKey(verifiedName)
        && (k(searchTerm) === k(`${b.houseNo} หมู่ ${b.moo}`) || searchTerm.replace(/[\s-]/g, '') === b.phone || searchTerm.toUpperCase() === b.ref));
      if (!DEMO.bills.length) toast('ไม่พบข้อมูลที่ตรงกัน กรุณาตรวจสอบชื่อและเลขล็อก/บ้านเลขที่ให้ตรงกับที่ลงทะเบียนไว้');
      return render();
    }
    DEMO.bills = rows.map(toWasteBill);
  } catch (e) { DEMO.bills = []; toast((e as Error).message); }
  render();
}
/** ช่องเดียว "ชื่อ-นามสกุล แล้วต่อด้วยบ้านเลขที่/หมู่ หรือเบอร์โทร" → แยกชื่อกับตัวค้นหา */
function splitNameAndKey(text:string){
 const t=text.replace(/[๐-๙]/g,d=>String('๐๑๒๓๔๕๖๗๘๙'.indexOf(d))).replace(/\s+/g,' ').trim();
 const ph=t.match(/(?:^|\s)(0\d(?:[\s-]?\d){7,8})$/);
 if(ph)return{name:t.slice(0,ph.index).trim(),key:ph[1].replace(/[\s-]/g,'')};
 const h=t.match(/(?:^|\s)(?:บ้านเลขที่|เลขที่)?\s*(\d+(?:\/\d+)?)(?:\s*(?:หมู่ที่|หมู่|ม\.)\s*(\d+))?$/);
 if(h)return{name:t.slice(0,h.index).replace(/(?:บ้านเลขที่|เลขที่)$/,'').trim(),key:h[2]?`${h[1]} หมู่ ${h[2]}`:h[1]};
 return{name:t,key:''};
}
/** เดโม่เท่านั้น: QR บ้านแบบเก่า (บ้านเลขที่+หมู่) กรอกชื่อและแสดงยอดให้เลย — ระบบจริงต้องใช้ QR ที่มีรหัสลับหรือกรอกชื่อเอง */
function fillDemoHouse(): boolean {
  demoBillsAll = demoHouseBills();
  const hit = demoBillsAll.filter((b) => b.payerType === 'household' && householdMatches(b, qrHouse));
  if (!hit.length) return false;
  DEMO.bills = hit; verifiedName = hit[0].merchant; draftQuery = qrHouse; searchTerm = qrHouse; qrHouse = ''; resetSelection(); render();
  return true;
}
/** ค้นด้วยรหัสลับของ QR บ้าน — ไม่ต้องกรอกชื่อ (เดโม่: ใช้ข้อมูลตัวอย่างตามรหัสครัวเรือน) */
/** ข้อมูลครัวเรือนที่เจ้าหน้าที่เดโม่ซิงก์มา (ชื่อ+บ้านเลขที่) */
function demoHouseInfo(ref: string): any {
  try { const v = JSON.parse(localStorage.getItem('lamplaimat:demo-outside-bills') || '[]'); return (Array.isArray(v) ? v : []).find((x: any) => x && x.hhInfo && String(x.householdRef).toUpperCase() === ref.toUpperCase()); } catch { return null; }
}
async function searchWasteByKey(ref: string, key: string) {
  qrHouse = ''; verifiedName = ''; draftQuery = ''; searchTerm = ''; resetSelection();
  try {
    const r = await payApi<any>(`/waste/bills?ref=${enc(ref)}&key=${enc(key)}`);
    if (r === null) {
      demoBillsAll = demoHouseBills();
      DEMO.bills = demoBillsAll.filter((b) => b.payerType === 'household' && b.ref.toUpperCase() === ref.toUpperCase());
      verifiedName = DEMO.bills[0]?.merchant || '';
      if (!DEMO.bills.length) { const i = demoHouseInfo(ref); if (i) { verifiedName = i.holderName; draftQuery = `${i.houseNo} หมู่ ${Number(i.moo)}`; } }
    } else { verifiedName = r.holderName || ''; DEMO.bills = (r.bills || []).map(toWasteBill); if (!DEMO.bills.length && r.houseNo) draftQuery = `${r.houseNo} หมู่ ${Number(r.moo)}`; }
    if (DEMO.bills[0]) draftQuery = `${DEMO.bills[0].houseNo} หมู่ ${Number(DEMO.bills[0].moo)}`;
    searchTerm = draftQuery || ref;
    if (!DEMO.bills.length && !verifiedName) toast('ไม่พบข้อมูลบ้านนี้');
  } catch (e) { DEMO.bills = []; toast((e as Error).message); }
  render();
}
function searchWasteFromForm() {
  if (qrHouse) { void searchWasteBills((document.getElementById('wname') as HTMLInputElement | null)?.value || '', qrHouse); return; }
  const { name, key } = splitNameAndKey((document.getElementById('wq') as HTMLInputElement | null)?.value || '');
  if (!key) { toast('กรอกชื่อ แล้วต่อด้วยบ้านเลขที่และหมู่ เช่น สมชาย ใจบุญ 18 หมู่ 2'); return; }
  void searchWasteBills(name, key);
}
function clearQrHouse(){qrHouse='';draftQuery='';verifiedName='';render()}
/** ส่งการแจ้งชำระทีละบิล (แนบสลิปเฉพาะโอน) แล้วโหลดรายการใหม่ให้เห็นสถานะ */
async function submitWasteBills(ids: string[], method: 'transfer' | 'cash', slip: File | null): Promise<{ status: 'paid' | 'pending'; reason?: string | null } | null> {
  try {
    const fd = new FormData();
    fd.append('billIds', ids.join(','));
    fd.append('method', method);
    fd.append('name', verifiedName);
    if (slip) fd.append('slip', slip, slip.name);
    const r = await payApi<{ status: 'paid' | 'pending'; reason?: string | null }>('/waste/submit', { method: 'POST', body: fd });
    if (r === null) throw new Error('ส่งข้อมูลไม่ได้ ตรวจการเชื่อมต่อแล้วลองใหม่');
    await searchWasteBills(verifiedName, searchTerm);
    return r;
  } catch (e) { toast((e as Error).message); return null; }
}
function searchFormHTML() {
  const head = `<div class="page-heading with-photo with-waste-photo"><h1>จ่ายค่าขยะ</h1><p>ค้นหาด้วยชื่อผู้รับบิลและบ้านเลขที่ · ไม่ต้องเข้าสู่ระบบ</p></div>`;
  if (qrHouse) return head + `<form class="search-card" onsubmit="event.preventDefault();searchWasteFromForm()"><label for="wname">ชื่อ-นามสกุลผู้รับบิล · บ้านเลขที่ ${escapeHTML(qrHouse)} <button type="button" class="link-btn" onclick="clearQrHouse()">เปลี่ยนบ้าน</button></label><div class="search-row"><input id="wname" name="wname" value="${escapeHTML(verifiedName)}" placeholder="เช่น สมชาย ใจบุญ" autocomplete="name"><button type="submit">ค้นหา</button></div><p class="help">ชื่อต้องตรงกับที่ลงทะเบียนไว้ จึงจะเห็นยอดค้าง</p></form>`;
  const v = verifiedName && draftQuery ? `${verifiedName} ${draftQuery}` : '';
  return head + `<form class="search-card" onsubmit="event.preventDefault();searchWasteFromForm()"><label for="wq">ชื่อ-นามสกุล แล้วต่อด้วยบ้านเลขที่และหมู่ (หรือเบอร์โทร)</label><div class="search-row"><input id="wq" name="wq" value="${escapeHTML(v)}" placeholder="เช่น สมชาย ใจบุญ 18 หมู่ 2" autocomplete="off"><button type="submit">ค้นหา</button></div><p class="help">ชื่อต้องตรงกับที่ลงทะเบียนไว้ จึงจะเห็นยอดค้าง</p></form>`;
}

function rescanHouse(){verifiedName='';draftQuery='';searchTerm='';qrHouse='';DEMO.bills=[];resetSelection();render();scanHouseQr()}
function whoHTML(matches:any[]){
 if(!searchTerm||!verifiedName)return '';
 const total=matches.reduce((n:number,b:any)=>n+b.amount,0);
 return `<div class="panel scan-who" style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;margin:12px 0"><div><small style="color:#667085">บ้านที่เลือก</small><div style="font-weight:700;font-size:1.05em">${escapeHTML(verifiedName)}${draftQuery?' · '+escapeHTML(draftQuery):''}</div><div style="font-size:.9em;color:${matches.length?'#b54708':'#067647'}">${matches.length?`ค้างชำระ ${matches.length} รายการ รวม ${total.toLocaleString('th-TH',{maximumFractionDigits:2})} บาท`:'ไม่มียอดค้างชำระ'}</div></div><button type="button" onclick="rescanHouse()" style="border:1px solid #d0d5dd;background:#fff;border-radius:999px;padding:8px 16px;font-weight:600;cursor:pointer">สแกน QR ใหม่</button></div>`;
}
function render(){
 const matches=searchTerm&&verifiedName?DEMO.bills.filter(b=>demoNameKey(b.merchant)===demoNameKey(verifiedName)&&(PAYABLE.includes(b.status)||b.status==='pending'||b.status==='cash')).sort((a,b)=>b.id.localeCompare(a.id)):[];
 const shortcut=searchTerm?'':`<div class="payment-shortcuts"><button class="payment-shortcut" type="button" onclick="scanHouseQr()">${SCAN_HOUSE_ART}<b>สแกน QR หน้าบ้าน</b><small>ส่องรหัสหน้าบ้านหรือเลือกรูป QR เพื่อดูค่าขยะ</small></button><button class="payment-shortcut payment-shortcut-cash" type="button" onclick="openCashInfo()">${CASH_HOUSE_ART}<b>จ่ายเงินสด</b><small>ไปจ่ายที่ ${escapeHTML(PAYMENT.cashPlace)}</small></button></div>`;
 app.innerHTML=homeBackHTML()+searchFormHTML()+(searchTerm?whoHTML(matches):shortcut)+billListHTML({title:'ค่าขยะ',matches,promptText:'กรอกชื่อผู้รับบิลและบ้านเลขที่ แล้วกดค้นหา',payerLabel:b=>b.location||b.ref,chargeLabel:()=>'ค่าขยะครัวเรือน'})+contactFooterHTML();
}

applySavedPayments();
// เปิดจาก QR หน้าบ้าน (?house=&moo=) → ใส่บ้านเลขที่ให้แล้ว ผู้ใช้กรอกแค่ชื่อ
if (new URLSearchParams(location.search).has('house')) qrHouse = houseFromQr(location.href);
if (qrHouse) { const nm = (new URLSearchParams(location.search).get('name') || '').trim(); if (nm) verifiedName = nm; } // QR มีชื่อ → ใส่ชื่อให้เลย
// ถ้าเข้าถึงระบบจริงได้: ใช้ช่องทางรับเงินจริงและส่งการแจ้งชำระเข้าระบบ · ไม่ได้ (เดโม่) ใช้ข้อมูลตัวอย่างเดิม
(async () => { const c = await payApi<any>("/config").catch(() => null); if (c) { applyPayConfig(c); billSubmitter = submitWasteBills; } else applyDemoPayConfig(); render(); if (qrHouse && PAYMENT.demo) fillDemoHouse(); const hk = parseHouseKeyLink(location.href); if (hk) void searchWasteByKey(hk.ref, hk.key); })();
