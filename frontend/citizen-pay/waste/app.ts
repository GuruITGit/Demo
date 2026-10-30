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

// สแกน QR หน้าบ้าน: ได้บ้านเลขที่+หมู่ แล้วให้ผู้ใช้กรอกชื่อผู้รับบิลเอง (ต้องตรงกันจึงจะเห็นยอด)
function scanHouseQr(){startQrScan({title:'สแกน QR หน้าบ้าน',help:'หันกล้องไปที่ QR หน้าบ้าน เช่น 18 หมู่ 2',demoCode:'18 หมู่ 2',demoLabel:'ทดลองดูค่าขยะตัวอย่าง 18 หมู่ 2',onCode:(code:string)=>{draftQuery=code;render();toast('กรอกชื่อผู้รับบิลแล้วกดค้นหา')}})}

const CASH_HOUSE_ART='<img class="shortcut-art shortcut-art-photo" src="/citizen-pay/shared/img/cash-pay-house.webp" width="600" height="338" alt="" aria-hidden="true">';
const SCAN_HOUSE_ART='<img class="shortcut-art shortcut-art-photo" src="/citizen-pay/shared/img/scan-qr-house.webp" width="600" height="338" alt="" aria-hidden="true">';
// จ่ายเงินสด: ไม่มียอดให้จ่ายออนไลน์ ต้องไปจ่ายที่ อบต. (สถานที่/เวลาอ่านจาก payment-config)
function openCashInfo(){modalContent.innerHTML=`<div class="modal-inner"><div class="modal-top pay-top"><button type="button" class="pay-back" onclick="modal.close()">‹ กลับ</button><h2 id="modalTitle">จ่ายเงินสด</h2><span></span></div><div class="modal-body"><div class="cash-info"><b>ไปจ่ายที่ ${escapeHTML(PAYMENT.cashPlace)}</b><small>${escapeHTML(PAYMENT.cashHours)}</small><ol><li>ค้นหาบ้านเลขที่และหมู่ของคุณ หรือสแกน QR หน้าบ้าน</li><li>แจ้งบ้านเลขที่และหมู่ให้เจ้าหน้าที่</li><li>ชำระเงินและรับใบเสร็จจากเจ้าหน้าที่</li></ol></div>${accountBlockHTML()}</div><div class="modal-actions"><button type="button" onclick="modal.close()">เข้าใจแล้ว</button></div></div>`;modal.classList.add('pay-full');modal.showModal()}

// ---------- ต่อ API จริง: ชื่อผู้รับบิล + บ้านเลขที่ ต้องตรงกันจึงเห็นยอด ----------
let verifiedName = '';
let draftQuery = '';
const enc = (v: string) => encodeURIComponent(v);
/** แปลงบิลจาก API เป็นรูปแบบบิลของหน้านี้ (ชื่อที่ผู้ใช้กรอกใช้แทนชื่อที่ถูกปกปิด) */
function toWasteBill(x: any): Bill {
  const cash = x.status === 'pending' && x.submittedMethod === 'cash';
  const status: BillStatus = x.status === 'pending' ? (cash ? 'cash' : 'pending') : x.status === 'mismatch' ? 'mismatch' : 'unpaid';
  return { id: x.id, payerType: 'household', merchant: verifiedName || x.holderName, ref: x.householdRef, location: `บ้านเลขที่ ${x.houseNo} หมู่ ${Number(x.moo)}`, houseNo: x.houseNo, moo: x.moo, phone: x.phone || '', kind: 'ค่าเก็บขยะ', month: periodToThai(x.period), due: x.dueDate || '', amount: Number(x.amount), status, note: x.reviewNote || undefined };
}
let demoBillsAll: Bill[] | null = null;
async function searchWasteBills(name: string, q: string) {
  verifiedName = name.trim(); draftQuery = q.trim();
  searchTerm = draftQuery; resetSelection();
  if (!searchTerm) return render();
  if (verifiedName.length < 4) { toast('กรุณากรอกชื่อ-นามสกุลผู้รับบิล'); return render(); }
  try {
    const rows = await payApi<any[]>(`/waste/bills?q=${enc(searchTerm)}&name=${enc(verifiedName)}`);
    if (rows === null) { // เดโม่: ไม่มี API → กรองข้อมูลตัวอย่างให้ตรงทั้งชื่อและบ้านเลขที่/เบอร์/รหัสครัวเรือน
      demoBillsAll ??= DEMO.bills;
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
function searchWasteFromForm() {
  const name = (document.getElementById('wname') as HTMLInputElement | null)?.value || '';
  const q = (document.getElementById('query') as HTMLInputElement | null)?.value || '';
  void searchWasteBills(name, q);
}
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
  return `<div class="page-heading with-photo with-waste-photo"><h1>จ่ายค่าขยะ</h1><p>ค้นหาด้วยชื่อผู้รับบิลและบ้านเลขที่ · ไม่ต้องเข้าสู่ระบบ</p></div><form class="search-card" onsubmit="event.preventDefault();searchWasteFromForm()"><label for="wname">ชื่อ-นามสกุลผู้รับบิล</label><div class="search-row"><input id="wname" name="wname" value="${escapeHTML(verifiedName)}" placeholder="เช่น สมชาย ใจบุญ" autocomplete="name"></div><label for="query">บ้านเลขที่และหมู่ หรือเบอร์โทร</label><div class="search-row"><input id="query" name="query" value="${escapeHTML(draftQuery)}" placeholder="เช่น 18 หมู่ 2 · 081-000-0014"><button type="submit">ค้นหา</button></div><p class="help">ชื่อต้องตรงกับที่ลงทะเบียนไว้ จึงจะเห็นยอดค้าง</p></form>`;
}

function render(){
 const matches=searchTerm?DEMO.bills.filter(b=>PAYABLE.includes(b.status)||b.status==='pending'||b.status==='cash').sort((a,b)=>b.id.localeCompare(a.id)):[];
 const shortcut=searchTerm?'':`<div class="payment-shortcuts"><button class="payment-shortcut" type="button" onclick="scanHouseQr()">${SCAN_HOUSE_ART}<b>สแกน QR หน้าบ้าน</b><small>ส่องรหัสหน้าบ้านหรือเลือกรูป QR เพื่อดูค่าขยะ</small></button><button class="payment-shortcut payment-shortcut-cash" type="button" onclick="openCashInfo()">${CASH_HOUSE_ART}<b>จ่ายเงินสด</b><small>ไปจ่ายที่ ${escapeHTML(PAYMENT.cashPlace)}</small></button></div>`;
 app.innerHTML=homeBackHTML()+searchFormHTML()+shortcut+billListHTML({title:'ค่าขยะ',matches,promptText:'กรอกชื่อผู้รับบิลและบ้านเลขที่ แล้วกดค้นหา',payerLabel:b=>b.location||b.ref,chargeLabel:()=>'ค่าขยะครัวเรือน'})+contactFooterHTML();
}

applySavedPayments();
// ถ้าเข้าถึงระบบจริงได้: ใช้ช่องทางรับเงินจริงและส่งการแจ้งชำระเข้าระบบ · ไม่ได้ (เดโม่) ใช้ข้อมูลตัวอย่างเดิม
(async () => { const c = await payApi<any>("/config").catch(() => null); if (c) { applyPayConfig(c); billSubmitter = submitWasteBills; } render(); })();
