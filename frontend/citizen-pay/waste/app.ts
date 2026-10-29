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

// สแกน QR หน้าบ้าน: ข้อมูลใน QR คือบ้านเลขที่และหมู่ เช่น "18 หมู่ 2" แล้วค้นหาเหมือนพิมพ์เอง
function scanHouseQr(){startQrScan({title:'สแกน QR หน้าบ้าน',help:'หันกล้องไปที่ QR หน้าบ้าน เช่น 18 หมู่ 2',demoCode:'18 หมู่ 2',demoLabel:'ทดลองดูค่าขยะตัวอย่าง 18 หมู่ 2',onCode:searchBills})}

const CASH_HOUSE_ART='<img class="shortcut-art shortcut-art-photo" src="/citizen-pay/shared/img/cash-pay-house.webp" width="600" height="338" alt="" aria-hidden="true">';
const SCAN_HOUSE_ART='<img class="shortcut-art shortcut-art-photo" src="/citizen-pay/shared/img/scan-qr-house.webp" width="600" height="338" alt="" aria-hidden="true">';
// จ่ายเงินสด: ไม่มียอดให้จ่ายออนไลน์ ต้องไปจ่ายที่ อบต. (สถานที่/เวลาอ่านจาก payment-config)
function openCashInfo(){modalContent.innerHTML=`<div class="modal-inner"><div class="modal-top pay-top"><button type="button" class="pay-back" onclick="modal.close()">‹ กลับ</button><h2 id="modalTitle">จ่ายเงินสด</h2><span></span></div><div class="modal-body"><div class="cash-info"><b>ไปจ่ายที่ ${escapeHTML(PAYMENT.cashPlace)}</b><small>${escapeHTML(PAYMENT.cashHours)}</small><ol><li>ค้นหาบ้านเลขที่และหมู่ของคุณ หรือสแกน QR หน้าบ้าน</li><li>แจ้งบ้านเลขที่และหมู่ให้เจ้าหน้าที่</li><li>ชำระเงินและรับใบเสร็จจากเจ้าหน้าที่</li></ol></div>${accountBlockHTML()}</div><div class="modal-actions"><button type="button" onclick="modal.close()">เข้าใจแล้ว</button></div></div>`;modal.classList.add('pay-full');modal.showModal()}

function render(){
 const matches=searchTerm?DEMO.bills.filter(b=>PAYABLE.includes(b.status)&&householdMatches(b,searchTerm)).sort((a,b)=>b.id.localeCompare(a.id)):[];
 const shortcut=searchTerm?'':`<div class="payment-shortcuts"><button class="payment-shortcut" type="button" onclick="scanHouseQr()">${SCAN_HOUSE_ART}<b>สแกน QR หน้าบ้าน</b><small>ส่องรหัสหน้าบ้านหรือเลือกรูป QR เพื่อดูค่าขยะ</small></button><button class="payment-shortcut payment-shortcut-cash" type="button" onclick="openCashInfo()">${CASH_HOUSE_ART}<b>จ่ายเงินสด</b><small>ไปจ่ายที่ ${escapeHTML(PAYMENT.cashPlace)}</small></button></div>`;
 app.innerHTML=homeBackHTML()+searchHeaderHTML('จ่ายค่าขยะ','บ้านเลขที่และหมู่ ชื่อ หรือเบอร์โทร','เช่น 18 หมู่ 2 · สมชาย · 081-000-0014','ลองค้นหา “18 หมู่ 2”, “สมชาย” หรือ “081-000-0014”',' with-photo with-waste-photo')
  +shortcut+billListHTML({title:'ค่าขยะ',matches,promptText:'พิมพ์บ้านเลขที่และหมู่ ชื่อ หรือเบอร์โทร',payerLabel:b=>b.location||b.ref,chargeLabel:()=>'ค่าขยะครัวเรือน'});
}

applySavedPayments();
render();
