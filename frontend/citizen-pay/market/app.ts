type AppElementMap = { app: HTMLElement; bottomNav: HTMLElement; modal: HTMLDialogElement; modalContent: HTMLElement; modeLabel: HTMLElement; modeSwitch: HTMLButtonElement; ocrReview: HTMLElement; scanNote: HTMLElement; signupName: HTMLInputElement; query: HTMLInputElement; smsEnabled: HTMLInputElement; smsFrequency: HTMLSelectElement; smsTemplate: HTMLInputElement; smsTime: HTMLInputElement; stallRateTarget: HTMLSelectElement; stallRateUnit: HTMLElement; stallRateValue: HTMLInputElement; slip2goToken: HTMLInputElement; slip2goFile: HTMLInputElement; slip2goResult: HTMLElement; slip2goSubmit: HTMLElement };
function byId<K extends keyof AppElementMap>(id: K): AppElementMap[K] { const element = window.document.getElementById(id); if (!element) throw new Error(`Missing #${id}`); return element as AppElementMap[K] }
const app = byId('app');
const nav = byId('bottomNav');
function validOutsideLocations(value:unknown):value is OutsideLocation[]{return Array.isArray(value)&&value.every((location:unknown)=>{if(!location||typeof location!=='object')return false;const item=location as OutsideLocation;return typeof item.id==='string'&&item.id.length>0&&item.id.length<=64&&typeof item.name==='string'&&item.name.length<=60&&Number.isFinite(item.rentRate)&&item.rentRate>=0&&(item.rentPeriod==='daily'||item.rentPeriod==='monthly')&&typeof item.enabled==='boolean'&&typeof item.deleted==='boolean'&&Array.isArray(item.tenants)&&item.tenants.every(tenant=>tenant&&typeof tenant.name==='string'&&tenant.name.length<=100&&typeof tenant.paid==='boolean')})}
function loadOutsideLocations(){try{const stored=localStorage.getItem('lamplaimat:outside-locations');if(stored){const value:unknown=JSON.parse(stored);if(validOutsideLocations(value))return value}}catch{}return DEMO.outsideLocations}
function saveOutsideLocations(){try{localStorage.setItem('lamplaimat:outside-locations',JSON.stringify(DEMO.outsideLocations))}catch{}}
DEMO.outsideLocations=loadOutsideLocations();
applyStoredRates(DEMO.planRows,DEMO.rates);
const savedPageState=(()=>{try{const savedView=sessionStorage.getItem('demo:view');const savedArea=sessionStorage.getItem('demo:stallArea');const savedStall=sessionStorage.getItem('demo:selectedStall');const validViews=['home','dues','stalls','signup'];return{view:location.hash==='#dues'?'dues':location.hash==='#stalls'?'stalls':'home',stallArea:savedArea==='outside'?'outside':'regular',paymentMap:sessionStorage.getItem('demo:paymentMap')==='1',selectedStall:savedStall&&DEMO.stalls.some(s=>s.id===savedStall)?savedStall:null}}catch{return{view:'home',stallArea:'regular',paymentMap:false,selectedStall:null}}})();
let view=savedPageState.view, zone = 'A', stallArea=savedPageState.stallArea, selectedStall = savedPageState.selectedStall, signupStallId = null, selectedOutsideLocationId = 'LOC-01';
let paymentMapMode=savedPageState.paymentMap;
let signupLocationId:string|null=null;
function locWindowLine(l:OutsideLocation){return l.openFrom||l.openUntil?`<span class="loc-rent">เปิดให้เช่า${l.openFrom?' ตั้งแต่ '+thaiDateLabel(l.openFrom):''}${l.openUntil?' ถึง '+thaiDateLabel(l.openUntil):''}</span>`:''}
function locSeatsLine(l:OutsideLocation){return l.capacity?`<span class="loc-rent">ผู้เช่า ${l.taken||0}/${l.capacity}${l.full?' · <b>จองเต็มแล้ว</b>':' · เหลือ '+(l.capacity-(l.taken||0))+' ที่'}</span>`:''}
function locationOpenNow(l:OutsideLocation){const t=localISODate();return (!l.openFrom||t>=String(l.openFrom))&&(!l.openUntil||t<=String(l.openUntil))}
function openOutsideLocations(){return DEMO.outsideLocations.filter(location=>location.enabled&&!location.deleted&&locationOpenNow(location))}
function outsideLocationIsOpen(id:string){return openOutsideLocations().some(location=>location.id===id)}
function savePageState(){try{sessionStorage.setItem('demo:view',view);sessionStorage.setItem('demo:stallArea',stallArea);sessionStorage.setItem('demo:paymentMap',paymentMapMode?'1':'0');sessionStorage.setItem('demo:selectedStall',selectedStall||'')}catch{}}
function openPaymentMap(){paymentMapMode=true;stallArea='regular';selectedStall=null;setPage('stalls')}
function cancelPaymentMap(){paymentMapMode=false;setPage('dues')}
function selectStall(id){const stall=findStall(id);if(paymentMapMode){selectedStall=id;savePageState();render();modalContent.innerHTML=paymentStallModal(id);modal.showModal();return}if(!stall)return;if(stall.status!=='available'){modalContent.innerHTML=ownedStallModal(stall);modal.showModal();return}if(selectedStall===id){openSignupForStall(id);return}selectedStall=id;savePageState();render()}
function ownedStallModal(stall){const name=stall.tenantName?`<b>${escapeHTML(stall.tenantName)}</b>`:'';return `<div class="modal-inner"><div class="modal-top"><h2 id="modalTitle">แผง ${escapeHTML(stall.id)} มีเจ้าของแล้ว</h2><button class="close-btn" onclick="modal.close()" aria-label="ปิด">×</button></div><div class="modal-body"><p class="help">${stall.status==='reserved'?'มีผู้จองแล้ว':'มีผู้เช่าแล้ว'}${name?` · ${name}`:''}</p></div></div>`}
function paymentStallModal(id){const bills=DEMO.bills.filter(b=>b.payerType==='stall'&&b.status==='unpaid'&&b.stall===id);const tenant=findStall(id)?.tenantName||bills[0]?.merchant;const summary=`<p class="help"><b>${escapeHTML(tenant||'ยังไม่มีผู้เช่า')}</b></p>`;return `<div class="modal-inner"><div class="modal-top"><h2 id="modalTitle">แผง ${escapeHTML(id)}</h2><button class="close-btn" onclick="modal.close()" aria-label="ปิด">×</button></div><div class="modal-body">${summary}${findStall(id)?.status==='available'?`<button class="qr-demo" onclick="modal.close();openSignupForStall('${escapeHTML(id)}')">จองแผงนี้</button>`:`<button class="qr-demo" onclick="modal.close();findPaymentByQr('${escapeHTML(id)}')">เช็คยอดค้างชำระ</button>`}</div></div>`}
function openOutsideTenant(code:string){paymentMapMode=false;resetSelection();setPage('dues');setTimeout(()=>{const sq=document.getElementById('sq') as HTMLInputElement|null;if(sq){sq.value=code+' ';sq.focus()}},0);toast('พิมพ์ชื่อผู้เช่าไว้หน้ารหัส '+code+' แล้วกดค้นหา')}
function findPaymentByQr(raw:string){let key=raw.trim();let qrName='';try{const url=new URL(key);qrName=(url.searchParams.get('name')||'').trim();key=url.searchParams.get('stall')||url.searchParams.get('ref')||url.pathname.split('/').filter(Boolean).pop()||key}catch{}key=key.trim().toUpperCase();if(/^OUT-\d+$/.test(key)){if(qrName.length>=4){setPage('dues');void searchStallBills(qrName,key);return}openOutsideTenant(key);return}const bill=DEMO.bills.find(item=>item.payerType==='stall'&&(item.stall?.toUpperCase()===key||item.ref.toUpperCase()===key));const stall=findStall(key);searchTerm=bill?.stall||stall?.id||key;paymentMapMode=false;resetSelection();setPage('dues');if(!bill&&!stall)toast('ไม่พบรหัสแผงใน QR นี้ · ลองค้นหาด้วยชื่อหรือเลขแผง')}
function openQrScanner(){startQrScan({title:'สแกน QR ที่แผง',help:'หันกล้องไปที่ QR บนแผง เช่น A06 หรือ LM-021',demoCode:'A06',demoLabel:'ทดลองดูยอดตัวอย่าง A06',onCode:findPaymentByQr})}
const findStall = id => DEMO.stalls.find(s=>s.id===id&&s.active!==false);
const localISODate = () => {const date=new Date();date.setMinutes(date.getMinutes()-date.getTimezoneOffset());return date.toISOString().slice(0,10)};
let rentalStartDate = localISODate();
let rentalDays = 1;
let tenancyKind: 'regular' | 'temporary' = 'regular';
const rentPeriodFor = stall => stall.outside ? (stall.rentPeriod||DEMO.outsideLocations.find(location=>location.id===stall.locationId)?.rentPeriod||'monthly') : 'monthly';
const rentPeriodUnit = period => period==='daily'?'วัน':'เดือน';
const rentRateFor = stall => {if(stall.rentRate!=null)return Number(stall.rentRate);if(stall.outside)return DEMO.outsideLocations.find(location=>location.id===stall.locationId)?.rentRate??500;return DEMO.planRows.find(row=>row.id===stall.row)?.monthlyRate??DEMO.rates.regularRent};
const firstChargeAmount = (stall,date=rentalStartDate,days=rentalDays) => stall?calculateFirstCharge(rentRateFor(stall),DEMO.rates.stallWaste,rentPeriodFor(stall),date,Number(days)):0;
function setTenancyKind(v){captureSignupDraft();tenancyKind=v==='temporary'?'temporary':'regular';render()}
function setRentalDays(value){captureSignupDraft();const days=Number(value);if(Number.isInteger(days)&&days>=1&&days<=365)rentalDays=days;render()}
function setRentalStartDate(date){captureSignupDraft();try{calendarDaysInMonth(date);rentalStartDate=date;render()}catch{toast('วันที่เริ่มเช่าไม่ถูกต้อง')}}
function setPage(p){if(p!=='signup'&&view==='signup'){signupStallId=null;signupLocationId=null}if(p!=='stalls')paymentMapMode=false;view=p;savePageState();render();window.scrollTo({top:0,behavior:'smooth'})}
function sectionHead(title,sub='',link=''){return `<div class="section-head"><div><h2>${title}</h2>${sub?`<p>${sub}</p>`:''}</div>${link?`<button class="text-link" onclick="${link}">ดูทั้งหมด　›</button>`:''}</div>`}
function iconNav(icon,label){return `<span class="nav-icon" aria-hidden="true">${icon}</span><span>${label}</span>`}
const I={"home":"<svg viewBox=\"0 0 24 24\" width=\"26\" height=\"26\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 11 12 3l9 8\"/><path d=\"M5 10v10h14V10\"/><path d=\"M10 20v-6h4v6\"/></svg>","stalls":"<svg viewBox=\"0 0 24 24\" width=\"26\" height=\"26\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 9h18l-1.5-5h-15z\"/><path d=\"M5 9v11h14V9\"/><path d=\"M9 20v-5h6v5\"/></svg>","signup":"<svg viewBox=\"0 0 24 24\" width=\"26\" height=\"26\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 8v8M8 12h8\"/></svg>","history":"<svg viewBox=\"0 0 24 24\" width=\"26\" height=\"26\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7v5l3 2\"/></svg>","work":"<svg viewBox=\"0 0 24 24\" width=\"26\" height=\"26\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><rect x=\"4\" y=\"3\" width=\"16\" height=\"18\" rx=\"2\"/><path d=\"M8 8h8M8 12h8M8 16h5\"/></svg>","pay":"<svg viewBox=\"0 0 24 24\" width=\"26\" height=\"26\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><rect x=\"3\" y=\"6\" width=\"18\" height=\"12\" rx=\"2\"/><circle cx=\"12\" cy=\"12\" r=\"2.5\"/></svg>","report":"<svg viewBox=\"0 0 24 24\" width=\"26\" height=\"26\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M4 20V10M10 20V4M16 20v-7M22 20H2\"/></svg>","sms":"<svg viewBox=\"0 0 24 24\" width=\"26\" height=\"26\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M4 5h16v11H9l-5 4z\"/></svg>"};
function navItems(){return [['dues',I.pay,'จ่ายเงิน'],['stalls',I.stalls,'ดูแผง'],['signup',I.signup,'สมัคร']]}
function renderNav(){nav.innerHTML=navItems().map(([id,ic,label])=>`<button class="nav-item ${view===id?'active':''}" aria-current="${view===id?'page':'false'}" onclick="setPage('${id}')">${iconNav(ic,label)}</button>`).join('');}
// หน้าจ่ายค่าแผง: ค่าเช่า + ค่าขยะแผง (ค่าขยะบ้านอยู่หน้า waste/)
// ---------- ต่อ API จริง: เลขล็อก + ชื่อผู้เช่า ต้องตรงกันจึงเห็นยอด ----------
let verifiedName = '';
let draftStall = '';
let demoBillsAll: Bill[] | null = null;
function toStallBill(x: any): Bill {
  const cash = x.status === 'pending' && x.submittedMethod === 'cash';
  const status: BillStatus = x.status === 'pending' ? (cash ? 'cash' : 'pending') : x.status === 'mismatch' ? 'mismatch' : 'unpaid';
  return { id: x.id, payerType: 'stall', merchant: verifiedName || x.payerName, ref: x.stallCode, stall: x.stallCode, kind: x.kind === 'waste' ? 'ค่าขยะ' : 'ค่าเช่า', month: periodToThai(x.period), due: x.dueDate || '', amount: Number(x.amount), status, note: x.reviewNote || undefined };
}
/** บิลแผงลอยที่เจ้าหน้าที่ออกไว้ (เดโม่: ซิงก์ผ่านฐานกลาง) */
function readOutsideBills(): any[] {
  try { const v = JSON.parse(localStorage.getItem('lamplaimat:demo-outside-bills') || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
let emptyNote = '';
async function searchStallBills(name: string, stall: string) {
  verifiedName = name.trim(); draftStall = stall.trim().toUpperCase();
  searchTerm = draftStall; resetSelection(); emptyNote = '';
  if (verifiedName.length < 4) { toast('กรุณากรอกชื่อ-นามสกุลผู้เช่า'); return render(); }
  const isOpenRow = (x: any) => ['unpaid', 'pending', 'mismatch'].includes(x.status);
  try {
    const r = await payApi<any>(`/market/bills?stall=${encodeURIComponent(searchTerm)}&name=${encodeURIComponent(verifiedName)}`);
    if (r === null) { // เดโม่: ไม่มี API → กรองข้อมูลตัวอย่างและข้อมูลแผงลอยที่ซิงก์มา
      demoBillsAll ??= DEMO.bills;
      const nk = demoNameKey(verifiedName);
      if (searchTerm.startsWith('OUT-')) {
        const raw = readOutsideBills().filter((x) => String(x.stallCode).toUpperCase() === searchTerm && demoNameKey(x.payerName) === nk);
        if (!raw.length) emptyNote = 'ไม่พบชื่อผู้เช่านี้ในระบบ กรุณาตรวจสอบชื่อ-นามสกุลให้ตรงกับที่สมัคร';
        DEMO.bills = raw.filter(isOpenRow).map(toStallBill);
        if (raw.length && !DEMO.bills.length) emptyNote = 'ไม่มียอดค้างชำระ';
      } else if (searchTerm) {
        DEMO.bills = demoBillsAll.filter((b) => b.payerType === 'stall' && b.stall?.toUpperCase() === searchTerm && demoNameKey(b.merchant) === nk);
        if (!DEMO.bills.length) emptyNote = 'ไม่พบข้อมูลที่ตรงกัน กรุณาตรวจสอบชื่อและเลขล็อกให้ตรงกับที่ลงทะเบียนไว้';
      } else { // แผงลอย: ชื่ออย่างเดียว — ชื่อซ้ำหลายรายต้องพิมพ์รหัสผู้เช่าด้วย
        const raw = readOutsideBills().filter((x) => demoNameKey(x.payerName) === nk);
        if (!raw.length) emptyNote = 'ไม่พบชื่อผู้เช่านี้ในระบบ กรุณาตรวจสอบชื่อ-นามสกุลให้ตรงกับที่สมัคร';
        if (new Set(raw.map((x) => String(x.stallCode).toUpperCase())).size > 1) { toast('ชื่อนี้มีผู้เช่าแผงลอยมากกว่าหนึ่งราย กรุณาพิมพ์รหัสผู้เช่า (OUT-xxxx) ต่อท้ายชื่อ'); DEMO.bills = []; searchTerm = verifiedName; return render(); }
        searchTerm = raw.length ? String(raw[0].stallCode).toUpperCase() : verifiedName;
        DEMO.bills = raw.filter(isOpenRow).map(toStallBill);
        if (raw.length && !DEMO.bills.length) emptyNote = 'ไม่มียอดค้างชำระ';
      }
      if (!DEMO.bills.length && !emptyNote) toast('ไม่พบข้อมูลที่ตรงกัน กรุณาตรวจสอบชื่อและเลขล็อก/บ้านเลขที่ให้ตรงกับที่ลงทะเบียนไว้');
      return render();
    }
    if (!searchTerm && r?.stall?.stallCode) searchTerm = String(r.stall.stallCode).toUpperCase();
    DEMO.bills = (r.bills || []).map(toStallBill);
    if (!DEMO.bills.length) emptyNote = 'ไม่มียอดค้างชำระ';
  } catch (e) {
    DEMO.bills = []; emptyNote = (e as Error).message; if (!searchTerm) searchTerm = verifiedName;
    toast((e as Error).message);
  }
  render();
}
/** ช่องเดียว: "สมใจ ใจดี A06" → ชื่อ + รหัสแผงต่อท้าย · รองรับรหัสแผงลอย OUT-0001 (พิมพ์ OUT0001 ก็ได้) */
function parseStallQuery(raw: string): { name: string; code: string } {
  const text = raw.replace(/\s+/g, ' ').trim();
  const out = text.match(/\b(OUT-?\d{1,4})\b/i);
  if (out) { let c = out[1].toUpperCase(); c = 'OUT-' + c.replace(/\D/g, '').padStart(4, '0'); return { name: text.replace(out[0], ' ').replace(/\s+/g, ' ').trim(), code: c }; }
  const m = text.match(/^(.*?)\s*((?:OUT-?\d{1,4})|(?:[A-Za-z]{1,3}-?\d{1,3}))$/i);
  if (!m) return { name: text, code: '' };
  let code = m[2].toUpperCase();
  if (code.startsWith('OUT') && !code.includes('-')) code = 'OUT-' + code.slice(3);
  return { name: m[1].trim(), code };
}
function searchStallFromForm() {
  const { name, code } = parseStallQuery((document.getElementById('sq') as HTMLInputElement | null)?.value || '');
  if (!name) return toast('พิมพ์ชื่อ-นามสกุลผู้เช่า (แผงประจำพิมพ์รหัสแผงต่อท้าย เช่น สมใจ ใจดี A06 · แผงลอยพิมพ์แค่ชื่อได้)');
  void searchStallBills(name, code);
}
/** ส่งการแจ้งชำระของบิลค่าแผงทีละใบ (แนบสลิปเฉพาะโอน) แล้วโหลดรายการใหม่ */
async function submitStallBills(ids: string[], method: 'transfer' | 'cash', slip: File | null): Promise<{ status: 'paid' | 'pending'; reason?: string | null } | null> {
  try {
    const fd = new FormData();
    fd.append('billIds', ids.join(','));
    fd.append('method', method);
    fd.append('name', verifiedName);
    if (slip) fd.append('slip', slip, slip.name);
    const r = await payApi<{ status: 'paid' | 'pending'; reason?: string | null }>('/market/submit', { method: 'POST', body: fd });
    if (r === null) throw new Error('ส่งข้อมูลไม่ได้ ตรวจการเชื่อมต่อแล้วลองใหม่');
    await searchStallBills(verifiedName, searchTerm);
    return r;
  } catch (e) { toast((e as Error).message); return null; }
}
function searchPage(){
 const matches=searchTerm?DEMO.bills.filter(b=>b.payerType==='stall'&&(PAYABLE.includes(b.status)||b.status==='pending'||b.status==='cash')).sort((a,b)=>b.id.localeCompare(a.id)):[];
 const shortcuts=searchTerm?'':`<div class="payment-shortcuts" style="grid-template-columns:1fr"><button class="payment-shortcut" type="button" onclick="openQrScanner()">${SHORTCUT_QR_ART}<b>สแกน QR ที่แผง</b><small>เปิดกล้องส่องรหัสบนแผง</small></button></div>`;
 const form=`<div class="page-heading with-photo"><h1>จ่ายค่าแผงตลาด</h1><p>ค้นหาด้วยชื่อผู้เช่าและรหัสแผงในช่องเดียว · ไม่ต้องเข้าสู่ระบบ</p></div><form class="search-card" onsubmit="event.preventDefault();searchStallFromForm()"><label for="sq">ชื่อ-นามสกุล แล้วต่อด้วยรหัสแผง</label><div class="search-row"><input id="sq" name="sq" value="${escapeHTML([verifiedName, draftStall].filter(Boolean).join(' '))}" placeholder="เช่น สมใจ ใจดี A06" autocomplete="name"><button type="submit">ค้นหา</button></div><p class="help">พิมพ์ชื่อผู้เช่าแล้วตามด้วยรหัสแผง · ผู้สมัครแผงลอยใช้รหัส OUT-xxxx ที่ได้รับ · ชื่อต้องตรงกับที่ลงทะเบียนไว้</p></form>`;
 return form+shortcuts+billListHTML({title:'ค่าแผงตลาด',matches,promptText:'พิมพ์ชื่อผู้เช่าตามด้วยรหัสแผง แล้วกดค้นหา',payerLabel:b=>'ล็อก '+(b.stall||b.ref),chargeLabel:b=>b.kind==='ค่าขยะ'?'ค่าขยะแผง':'ค่าเช่าแผง',emptyText:emptyNote||undefined,emptyIcon:emptyNote.startsWith('ไม่พบ')?'<span style="color:#b42318;font-weight:700">✕</span>':undefined})+contactFooterHTML();
}
const SHORTCUT_QR_ART='<img class="shortcut-art shortcut-art-photo" src="/citizen-pay/shared/img/scan-qr-market.webp" width="600" height="386" alt="" aria-hidden="true">';
const SHORTCUT_MAP_ART='<img class="shortcut-art shortcut-art-photo" src="/citizen-pay/shared/img/pick-stall-map.webp" width="600" height="386" alt="" aria-hidden="true">';
function stallPage(){if(stallArea==='outside'&&openOutsideLocations().length){const page=outsideStallPage();return page}if(!openOutsideLocations().length)stallArea='regular';const page=regularStallPage();return page}
function regularStallPage(){const picked=findStall(selectedStall);const labels={available:'ว่าง',reserved:'จอง',occupied:'เช่า'};return `<div class="page-heading">${paymentMapMode?`<button class="back-link" onclick="cancelPaymentMap()">‹ กลับไปเลือกวิธี</button>`:''}<h1>ผังตลาด อบต.</h1><p>${paymentMapMode?'แตะแผงของคุณเพื่อดูยอดค้าง':'แตะช่องว่างเพื่อสมัครและขอจอง'}</p></div>${openOutsideLocations().length?`<div class="area-switch"><button class="active" onclick="chooseStallArea('regular')">แผงประจำ</button><button onclick="chooseStallArea('outside')">แผงลอยนอกผัง</button></div>`:``}<div class="plan-card"><div class="plan-head"><div><b>แผงประจำ</b><small>แตะแผงเพื่อดูผู้จอง หรือจองแผงว่าง</small></div><span>${DEMO.planRows.length} แถว · ${DEMO.stalls.filter(s=>s.active!==false).length} แผง</span></div><div class="plan-scroll" tabindex="0" aria-label="ผังตลาด เลือกแผงจากแถว A ถึง E"><div class="plan-canvas"><div class="plan-facilities"><div class="plan-facility"><span>🚻</span><b>ห้องน้ำ</b></div><div class="plan-facility"><span>📦</span><b>ห้องเก็บของ</b></div></div>${DEMO.planRows.map(row=>`<section class="plan-row"><div class="plan-row-title"><small>แถว</small><b>${row.id}</b></div><div class="plan-stalls">${DEMO.stalls.filter(s=>s.row===row.id&&s.active!==false).map(s=>`<button class="stall plan-stall ${s.status==='occupied'?'occupied':s.status==='reserved'?'reserved':''} ${selectedStall===s.id?'selected':''}" aria-label="แผง ${s.id} ${labels[s.status]}" aria-pressed="${selectedStall===s.id}" onclick="selectStall('${s.id}')"><b>${s.id}</b><span>${labels[s.status]}</span></button>`).join('')}</div></section><div class="plan-walkway"><span></span>ทางเดิน<span></span></div>`).join('')}<div class="plan-sides"><div>ที่นั่งพัก</div><div>ที่นั่งพัก</div></div><div class="plan-bottom"><div class="parking-area"><b>ลานจอดรถ</b><span>รถยนต์ · มอเตอร์ไซค์</span></div><div class="market-entry"><b>ทางเข้า - ออก</b><small>จุดรับส่งและทางสัญจร</small></div><div class="trash-area"><span>♻️</span><b>ถังขยะ</b></div></div></div></div><div class="legend"><span><i></i>ว่าง</span><span><i class="leg-r"></i>จอง/รอยืนยัน</span><span><i class="leg-o"></i>มีผู้เช่า</span></div>${picked&&!paymentMapMode?`<div class="selection-box"><span><b>${picked.outside?'ช่อง':'แผง'} ${picked.id}</b>${picked.tenantName?`<br><small>${picked.status==='reserved'?'ผู้จอง':'ผู้เช่า'} ${escapeHTML(picked.tenantName)}</small>`:''}<br><small>${picked.status==='available'?'ว่าง · จองได้':picked.status==='reserved'?'จองแล้ว · รอเจ้าหน้าที่ยืนยัน':'มีผู้เช่าแล้ว'}</small></span>${picked.status==='available'?`<button onclick="openSignupForStall('${picked.id}')">จองแผงนี้</button>`:''}</div>`:'<p class="help" style="text-align:center;margin:12px 0 0">แตะแผงเพื่อดูผู้จองหรือจองแผงว่าง</p>'}</div><div class="notice"><span class="notice-icon">💡</span><div><b>ข้อมูลผังปรับได้</b><p>ผังสร้างจากจำนวนแถวและจำนวนแผงในข้อมูลระบบ สถานะการจองอัปเดตตามแต่ละแผง</p></div></div>${PAYMENT.demo?sectionHead('แผงชั่วคราว','กิจกรรมที่เปิดจอง'):''}${(PAYMENT.demo?DEMO.events:[]).map(ev=>`<div class="panel event-card"><div class="event-date"><div><b>${ev.date}</b><br>${ev.month} 69</div></div><div><h3>${escapeHTML(ev.title)}</h3><p>${escapeHTML(ev.place)} · ${ev.booked}/${ev.slots} ช่อง</p></div><button class="small-btn" onclick="toast('ตัวอย่าง: ติดต่อเจ้าหน้าที่เพื่อจอง')">ดู</button></div>`).join('')}`}
function chooseStallArea(area){if(area==='outside'){const locations=openOutsideLocations();if(!locations.length)return; if(!locations.some(x=>x.id===selectedOutsideLocationId))selectedOutsideLocationId=locations[0].id}stallArea=area;selectedStall=null;savePageState();render()}
function openOutsideSignup(){const location=openOutsideLocations().find(x=>x.id===selectedOutsideLocationId);if(!location)return toast('ยังไม่มีพื้นที่ให้เช่า');signupLocationId=location.id;setPage('signup')}
function payOutsideLocation(){toast('พิมพ์ชื่อ แล้วต่อด้วยรหัสแผงลอย OUT-xxxx ที่ได้รับตอนสมัคร');setPage('dues')}
function chooseOutsideLocation(id){if(!outsideLocationIsOpen(id))return;selectedOutsideLocationId=id;selectedStall=null;savePageState();render()}
function outsideStallPage(){const locations=openOutsideLocations();if(!locations.length){stallArea='regular';return regularStallPage()}if(!locations.some(x=>x.id===selectedOutsideLocationId))selectedOutsideLocationId=locations[0].id;const location=locations.find(x=>x.id===selectedOutsideLocationId);return `<div class="page-heading"><h1>ผังตลาด อบต.</h1><p>พื้นที่ที่เปิดให้เช่า</p></div><div class="area-switch"><button onclick="chooseStallArea('regular')">แผงประจำ</button><button class="active" onclick="chooseStallArea('outside')">แผงลอยนอกผัง</button></div><div class="loc-list" role="radiogroup" aria-label="เลือกพื้นที่แผงลอย">${locations.map(l=>`<button type="button" class="loc-card ${l.id===location.id?'active':''}" role="radio" aria-checked="${l.id===location.id}" ${l.full?'disabled':`onclick="chooseOutsideLocation('${l.id}')"`}><span class="loc-name">${escapeHTML(l.name)}</span>${l.full?'<span class="outside-full-tag">จองเต็มแล้ว</span>':''}<span class="loc-rent">${money(l.rentRate)} บาท/${rentPeriodUnit(l.rentPeriod)}</span>${locWindowLine(l)}${locSeatsLine(l)}</button>`).join('')}</div><div class="outside-actions"><button type="button" class="primary-btn" onclick="openOutsideSignup()">เช่าแผงลอยนี้</button><button type="button" class="primary-btn alt" onclick="payOutsideLocation()">ชำระค่าเช่า</button></div>`}
function openSignupForStall(id){const s=findStall(id);if(!s||s.active===false||s.status!=='available'||(s.outside&&!outsideLocationIsOpen(s.locationId)))return toast('ช่องนี้ไม่พร้อมให้จองแล้ว');selectedStall=id;signupStallId=id;setPage('signup')}
/** ฟิลด์วันเริ่มเช่า/จำนวนวันของแผงลอย (รายวันต้องระบุจำนวนวัน) */
function thaiDateLabel(iso:string){return new Date(iso+'T00:00:00').toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'})}
function windowNoteHTML(o:OutsideLocation){return o.openFrom||o.openUntil?`<p class="outside-note"><b>เปิดให้เช่า${o.openFrom?' ตั้งแต่ '+thaiDateLabel(o.openFrom):''}${o.openUntil?' ถึงวันที่ '+thaiDateLabel(o.openUntil):''}</b></p>`:''}
function rentMinDate(o:OutsideLocation){const t=localISODate();return o.openFrom&&o.openFrom>t?o.openFrom:t}
function outsideRentFieldsHTML(o: OutsideLocation){const daily=o.rentPeriod==='daily';const est=daily?o.rentRate*rentalDays:o.rentRate;return `<fieldset class="tenancy-pick"><legend class="field-label">ประเภทการเช่า</legend><label><input type="radio" name="tenancyType" value="temporary" ${tenancyKind==='temporary'?'checked':''} onchange="setTenancyKind('temporary')"> ชั่วคราว · จ่ายเงินทันทีเมื่ออนุมัติ</label><label><input type="radio" name="tenancyType" value="regular" ${tenancyKind==='regular'?'checked':''} onchange="setTenancyKind('regular')"> ประจำ · จ่ายทีหลังได้</label></fieldset>${windowNoteHTML(o)}<label class="field"><span class="field-label">วันที่เริ่มเช่า</span><input id="rentalStartDate" name="rentalStartDate" type="date" min="${rentMinDate(o)}" max="${o.openUntil||''}" value="${rentalStartDate}" required onchange="setRentalStartDate(this.value)"></label>${daily?`<label class="field"><span class="field-label">จำนวนวันที่เช่า</span><input id="rentalDays" name="rentalDays" type="number" min="1" max="365" step="1" value="${rentalDays}" required onchange="setRentalDays(this.value)"></label>`:''}<div class="first-month-estimate"><span>${daily?`ยอดประมาณ ${rentalDays} วัน`:'ค่าเช่าต่อเดือน'}</span><b>${money(est)} บาท</b><small>ยอดเป็นการประเมิน เจ้าหน้าที่ออกบิลจริงหลังอนุมัติ</small></div>`}
function signupPage(){const stall=signupStallId?findStall(signupStallId):null;const outside=!stall&&signupLocationId?DEMO.outsideLocations.find(x=>x.id===signupLocationId):undefined;const daily=stall&&rentPeriodFor(stall)==='daily';return `<div class="page-heading"><button class="back-link" onclick="setPage('${stall||outside?'stalls':'home'}')">‹ ${stall||outside?'กลับไปเลือกแผง':'กลับไปเลือกเมนู'}</button><h1>${outside?`สมัครแผงลอย ${escapeHTML(outside.name)}`:stall?`${stall.outside?'สมัครแผงลอย':'สมัครและจองล็อก'} ${escapeHTML(stall.id)}`:'สมัครใช้บริการ'}</h1><p>${stall||outside?'กรอกข้อมูลติดต่อเพื่อส่งคำขอจองให้เจ้าหน้าที่':'กรอกข้อมูลผู้เช่าและล็อกที่ต้องการ'}</p></div><form class="panel signup-form" onsubmit="submitRegistration(event)"><label class="field"><span class="field-label">ชื่อและนามสกุล</span><input id="signupName" name="name" required placeholder="เช่น ใจดี มั่นคง" autocomplete="name" value="${escapeHTML(signupDraft.name)}"></label><label class="field"><span class="field-label">เบอร์โทรศัพท์</span><input id="signupPhone" name="phone" type="tel" inputmode="tel" pattern="[0-9+ ()-]{9,15}" required placeholder="08X-XXX-XXXX" autocomplete="tel" value="${escapeHTML(signupDraft.phone)}"></label>${idCardFieldHTML()}<label class="field"><span class="field-label">${outside?'พื้นที่ที่เช่า':`ล็อกที่จองไว้${stall?'':' (ถ้ามี)'}`}</span><input id="signupStall" name="stall" ${stall||outside?'readonly':''} value="${stall?escapeHTML(stall.id):outside?escapeHTML(outside.name):''}" placeholder="เช่น A06"></label>${outside?outsideRentFieldsHTML(outside):''}${stall?`<label class="field"><span class="field-label">วันที่เริ่มเช่า</span><input id="rentalStartDate" name="rentalStartDate" type="date" min="${localISODate()}" value="${rentalStartDate}" required onchange="setRentalStartDate(this.value)"></label>${daily?`<label class="field"><span class="field-label">จำนวนวันที่เช่า</span><input id="rentalDays" name="rentalDays" type="number" min="1" max="365" step="1" value="${rentalDays}" required onchange="setRentalDays(this.value)"></label>`:''}<div class="first-month-estimate"><span>${daily?`ยอดประมาณ ${rentalDays} วัน`:'ค่าใช้จ่ายเดือนแรกโดยประมาณ'}</span><b>${money(firstChargeAmount(stall))} บาท</b><small>${daily?'คิดค่าเช่ารายวันรวมค่าขยะแผงเฉลี่ยตามจำนวนวันที่เลือก':'เฉลี่ยค่าเช่าและค่าขยะแผงตามวันที่เช่าถึงสิ้นเดือน โดยนับวันเริ่มเช่าด้วย'}</small></div>`:''}<label class="consent"><input type="checkbox" required> ยินยอมให้ อบต. ใช้ข้อมูลและรูปบัตรประชาชนเพื่อยืนยันตัวตนและติดต่อเรื่องบริการนี้</label><button class="primary-btn submit-signup" type="submit">${stall?'ส่งใบสมัครและขอจอง':'ส่งใบสมัคร'} <span>→</span></button></form><p class="help" style="text-align:center">ยอดค่าแผงเป็นการประเมิน เจ้าหน้าที่ตรวจสอบก่อนยืนยัน</p>`}
// ---------- ใบสมัคร: รูปบัตรประชาชน (จำเป็น) + จำค่าที่กรอกไว้ตอนหน้า re-render (เปลี่ยนวันเริ่มเช่า/จำนวนวัน) ----------
let idCardFile:File|null=null, idCardUrl='';
const signupDraft={name:'',phone:''};
function captureSignupDraft(){const n=document.getElementById('signupName') as HTMLInputElement|null;const p=document.getElementById('signupPhone') as HTMLInputElement|null;if(n)signupDraft.name=n.value;if(p)signupDraft.phone=p.value}
function idCardPreviewHTML(){return idCardFile?`<div class="slip-preview id-card-preview"><img src="${idCardUrl}" alt="รูปบัตรประชาชนที่แนบ"><span>${escapeHTML(idCardFile.name)}<br><button type="button" class="text-link" onclick="clearIdCard()">ลบรูป</button></span></div>`:''}
function idCardFieldHTML(){return `<div class="field"><span class="field-label">รูปบัตรประชาชน (ด้านหน้า)</span><div class="id-pick-row" style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><label class="upload scan-upload id-upload"><span id="idCardLabel">${idCardFile?'เปลี่ยนรูปบัตร':'ถ่ายรูปบัตร'}</span><input type="file" accept="image/*" capture="environment" onchange="pickIdCard(this)"></label><label class="upload scan-upload id-upload"><span>เลือกรูปจากเครื่อง</span><input type="file" accept="image/*" onchange="pickIdCard(this)"></label></div><div id="idCardPreview">${idCardPreviewHTML()}</div><p class="help">ใช้ยืนยันตัวตนผู้เช่าเท่านั้น · ถ่ายให้เห็นชื่อและเลขบัตรชัดเจน · ไม่ต้องถ่ายด้านหลังบัตร</p></div>`}
function refreshIdCardField(){const preview=document.getElementById('idCardPreview');const label=document.getElementById('idCardLabel');if(preview)preview.innerHTML=idCardPreviewHTML();if(label)label.textContent=idCardFile?'เปลี่ยนรูปบัตร':'ถ่ายรูป หรือเลือกรูปบัตรประชาชน'}
function clearIdCard(){if(idCardUrl)URL.revokeObjectURL(idCardUrl);idCardFile=null;idCardUrl='';refreshIdCardField()}
function pickIdCard(input:HTMLInputElement){const f=input.files?.[0];input.value='';if(!f)return;if(!f.type.startsWith('image/'))return toast('แนบได้เฉพาะรูปภาพ');if(f.size>10*1024*1024)return toast('รูปใหญ่เกิน 10 MB');clearIdCard();idCardFile=f;idCardUrl=URL.createObjectURL(f);refreshIdCardField()}
// สถานะแผงจากระบบจริง (ว่าง/จอง/มีผู้เช่า) — รีเฟรชทุก 2 วินาที และวาดใหม่เฉพาะตอนมีการเปลี่ยนแปลง
let stallSig = '';
let apiOnline = false;
const DEMO_STALLS_KEY = 'lamplaimat:demo-stalls';
type StallRow = { stallCode: string; zone: string; status: StallStatus; monthlyRate: number };
/** เดโม่ (ไม่มี backend): สถานะแผงชุดเดียวกับหน้าเจ้าหน้าที่เดโม่ ที่ฝากไว้ใน localStorage (ไม่มี = ใช้ชุดตัวอย่างของหน้านี้) */
function readDemoStalls(): StallRow[] | null {
  try {
    const v = JSON.parse(localStorage.getItem(DEMO_STALLS_KEY) || 'null');
    return Array.isArray(v) && v.length && v.every((x) => x && typeof x.stallCode === 'string' && ['available', 'reserved', 'occupied'].includes(x.status)) ? v : null;
  } catch { return null; }
}
/** ประชาชนจองในเดโม่ → จำไว้ทันทีว่าแผงนั้น "จอง" (รีเฟรชแล้วไม่หาย และตรงกับที่เจ้าหน้าที่จะเห็น) */
function markDemoStall(code: string, status: StallStatus) {
  try {
    const rows = readDemoStalls() ?? DEMO.stalls.filter(s => s.active !== false).map(s => ({ stallCode: s.id, zone: s.row, status: s.status, monthlyRate: Number(rentRateFor(s)) || 0 }));
    localStorage.setItem(DEMO_STALLS_KEY, JSON.stringify(rows.map(r => r.stallCode === code ? { ...r, status } : r)));
  } catch { /* เก็บไม่ได้ = ข้าม */ }
}
function applyStallRows(rows: StallRow[], force: boolean) {
  const sig = JSON.stringify(rows);
  if (sig === stallSig && !force) return;
  const ae = document.activeElement;
  if (!force && ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return;
  stallSig = sig;
  DEMO.stalls = rows.map(x => ({ id: x.stallCode, row: x.zone, active: true, status: x.status, rentRate: Number(x.monthlyRate) || 0 }));
  const zones = [...new Set(rows.map(x => x.zone))];
  DEMO.planRows = zones.map(z => ({ id: z, count: rows.filter(x => x.zone === z).length, monthlyRate: Number(rows.find(x => x.zone === z)?.monthlyRate) || 0 }));
  render();
}
async function refreshStalls(force = false) {
  let rows: StallRow[] | null = null;
  try {
    const r = await fetch('/v1/citizen/pay/market/stalls', { cache: 'no-store' });
    if (r.ok) { const j = await r.json(); if (Array.isArray(j?.data)) rows = j.data as StallRow[]; }
  } catch { /* ไม่มี API */ }
  apiOnline = !!rows;
  if (!rows) rows = readDemoStalls();
  if (rows) applyStallRows(rows, force);
}
/** จองแผงว่างผ่านระบบจริง: ส่งชื่อ เบอร์ และรูปบัตร → เจ้าหน้าที่ได้แจ้งเตือน */
async function reserveStallOnline(form: HTMLFormElement, stall: Stall) {
  const fd = new FormData();
  fd.append('name', (form.querySelector('[name=name]') as HTMLInputElement | null)?.value || '');
  fd.append('phone', (form.querySelector('[name=phone]') as HTMLInputElement | null)?.value || '');
  fd.append('rentalStartDate', rentalStartDate);
  if (rentPeriodFor(stall) === 'daily') fd.append('rentalDays', String(rentalDays));
  if (idCardFile) fd.append('idCard', idCardFile, idCardFile.name);
  try {
    const r = await fetch(`/v1/citizen/pay/market/stalls/${encodeURIComponent(stall.id)}/reserve`, { method: 'POST', body: fd });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.success === false) {
      toast(j?.error?.message || 'จองแผงไม่สำเร็จ');
      if (r.status === 409) { signupStallId = null; setPage('stalls'); }
      await refreshStalls(true);
      return;
    }
    form.reset(); clearIdCard(); signupDraft.name = ''; signupDraft.phone = ''; signupStallId = null; signupLocationId = null; selectedStall = null;
    toast(`จองแผง ${stall.id} แล้ว · รอเจ้าหน้าที่ยืนยัน`);
    await refreshStalls(true);
    setPage('stalls');
  } catch { toast('เชื่อมต่อระบบไม่ได้ ลองใหม่อีกครั้ง'); }
}
/** สมัครแผงลอยผ่านระบบจริง: ส่งชื่อ เบอร์ วันเริ่ม จำนวนวัน และรูปบัตร → ได้รหัส OUT-xxxx ไว้ชำระค่าเช่า */
async function applyOutsideOnline(form: HTMLFormElement, locationId: string) {
  const fd = new FormData();
  fd.append('name', (form.querySelector('[name=name]') as HTMLInputElement | null)?.value || '');
  fd.append('phone', (form.querySelector('[name=phone]') as HTMLInputElement | null)?.value || '');
  fd.append('startDate', rentalStartDate);
  fd.append('days', String(rentalDays));
  fd.append('tenancyType', tenancyKind);
  if (idCardFile) fd.append('idCard', idCardFile, idCardFile.name);
  try {
    const r = await fetch(`/v1/citizen/pay/market/outside/${encodeURIComponent(locationId)}/apply`, { method: 'POST', body: fd });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.success === false) return toast(j?.error?.message || j?.message || 'ส่งใบสมัครไม่สำเร็จ');
    form.reset(); clearIdCard(); signupDraft.name = ''; signupDraft.phone = ''; signupLocationId = null; rentalStartDate = localISODate(); rentalDays = 1;
    toast(`ส่งใบสมัครแล้ว · รหัส ${j.data?.appCode} · จดรหัสนี้ไว้เพื่อชำระค่าเช่า`);
    setPage('stalls');
  } catch { toast('เชื่อมต่อระบบไม่ได้ ลองใหม่อีกครั้ง'); }
}
/** เดโม่ (ไม่มี backend): ฝากรายการไว้ใน localStorage ให้หน้าเจ้าหน้าที่เดโม่ (origin เดียวกัน) หยิบไปแสดง */
function queueDemo(key: string, item: object) { try { const list = JSON.parse(localStorage.getItem(key) || '[]'); list.push(item); localStorage.setItem(key, JSON.stringify(list)); } catch { /* เก็บไม่ได้ = ข้าม */ } }
function submitRegistration(event){event.preventDefault();const form=event.currentTarget;if(!form.reportValidity())return;if(!idCardFile){toast('แนบรูปบัตรประชาชนก่อนส่งใบสมัครค่ะ');document.getElementById('idCardPreview')?.scrollIntoView({block:'center'});return}if(signupLocationId&&!signupStallId&&apiOnline&&/^[0-9a-f-]{36}$/i.test(signupLocationId)){void applyOutsideOnline(form,signupLocationId);return}const stallId=signupStallId;const stall=stallId&&findStall(stallId);if(stall&&!stall.outside&&apiOnline){void reserveStallOnline(form,stall);return}if(stallId&&(!stall||stall.active===false||stall.status!=='available'||(stall.outside&&!outsideLocationIsOpen(stall.locationId)))){signupStallId=null;toast('ล็อกนี้มีผู้จองแล้ว กรุณาเลือกแผงใหม่');setPage('stalls');return}const amount=stall?firstChargeAmount(stall):0;const period=stall?rentPeriodFor(stall):'monthly';const days=rentalDays;if(stall){stall.status='reserved';markDemoStall(stall.id,'reserved')}const dName=(form.querySelector('[name=name]') as HTMLInputElement|null)?.value||'',dPhone=(form.querySelector('[name=phone]') as HTMLInputElement|null)?.value||'';let demoCode='';if(stall){queueDemo('lamplaimat:demo-reservations',{stallCode:stall.id,name:dName,phone:dPhone,startDate:rentalStartDate,days:period==='daily'?days:null,reservedAt:new Date().toISOString()})}else if(signupLocationId){demoCode='OUT-'+String(Math.floor(Math.random()*9000)+1000);queueDemo('lamplaimat:demo-outside-apps',{appCode:demoCode,locationId:signupLocationId,name:dName,phone:dPhone,startDate:rentalStartDate,days,tenancyType:tenancyKind,createdAt:new Date().toISOString()})}form.reset();clearIdCard();signupDraft.name='';signupDraft.phone='';signupStallId=null;signupLocationId=null;selectedStall=null;rentalStartDate=localISODate();rentalDays=1;toast(stall?`ส่งใบสมัครและคำขอจองแล้ว · ${period==='daily'?`${days} วัน`:'เดือนแรก'} ประมาณ ${money(amount)} บาท`:demoCode?`ส่งใบสมัครแล้ว · รหัส ${demoCode} · จดรหัสนี้ไว้เพื่อชำระค่าเช่า`:'ส่งใบสมัครตัวอย่างแล้ว · เจ้าหน้าที่จะตรวจทาน');setPage('stalls')}
/** หน้าแรกค่าแผง — เลือกว่าจะจ่ายค่าแผงหรือจองแผง */
function choicePage(){return `<div class="page-heading"><h1>ค่าแผงตลาด</h1><p>เลือกว่าจะทำอะไร</p></div><div class="choice-grid"><button class="choice-card choice-card-photo" onclick="setPage('dues')" aria-label="จ่ายค่าแผงตลาด — ดูยอดค้างและจ่ายผ่าน QR หรือเงินสด"><img src="/citizen-pay/shared/img/market-pay-banner.webp" width="1672" height="941" alt="จ่ายค่าแผงตลาด" loading="lazy"></button><button class="choice-card choice-card-photo" onclick="setPage('stalls')" aria-label="จองแผง (สมัคร) — เลือกแผงว่างแล้วส่งคำขอจอง"><img src="/citizen-pay/shared/img/market-reserve-banner.webp" width="1774" height="887" alt="สมัครจองแผงตลาดออนไลน์" loading="lazy"></button></div>`}
function render(){saveOutsideLocations();app.classList.remove('staff-dashboard');renderNav();const page={home:choicePage,dues:searchPage,stalls:stallPage,signup:signupPage};app.innerHTML=homeBackHTML()+(page[view]||searchPage)()}
applySavedPayments();
// จุดแผงลอยที่เปิดให้เช่า: อัปเดตเกือบเรียลไทม์ (ราว 2 วินาที)
// - ระบบจริง: ดึงจาก API ทุก 2 วินาทีตอนแท็บเปิดอยู่ (ถ้า API ไม่ตอบ ใช้ข้อมูลที่เก็บในเครื่อง)
// - เดโม่: หน้าผู้ดูแลเขียนลง localStorage แล้วหน้านี้รับทันทีผ่านเหตุการณ์ storage
// render ใหม่เฉพาะตอนรายการเปลี่ยนจริง เพื่อไม่ให้หน้ากระพริบ
const OUTSIDE_KEY='lamplaimat:outside-locations';
let outsideSig='';
async function refreshOutside(){try{let list:OutsideLocation[]|null=null;try{const r=await fetch('/v1/citizen/pay/market/outside',{cache:'no-store'});if(r.ok){const j=await r.json();if(Array.isArray(j?.data))list=j.data.slice(0,50).map((x:any)=>({id:String(x.id),name:String(x.name).slice(0,60),rentRate:Number(x.rentRate)||0,rentPeriod:x.rentPeriod==='monthly'?'monthly':'daily',enabled:true,deleted:false,tenants:[],openFrom:x.openFrom||null,openUntil:x.openUntil||null,capacity:x.capacity||null,taken:Number(x.taken)||0,full:!!x.full}))}}catch{}if(!list){const stored=JSON.parse(localStorage.getItem(OUTSIDE_KEY)||'null');if(validOutsideLocations(stored))list=stored.filter(l=>l.enabled&&!l.deleted)}if(!list)return;const sig=JSON.stringify(list);if(sig===outsideSig)return;const ae=document.activeElement;if(ae&&/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName))return;outsideSig=sig;DEMO.outsideLocations=list;if(!list.some(l=>l.id===selectedOutsideLocationId))selectedOutsideLocationId=list[0]?.id??'';render()}catch{}}
window.addEventListener('storage',(e)=>{if(e.key===OUTSIDE_KEY)void refreshOutside()});
setInterval(()=>{if(document.visibilityState==='visible'){void refreshOutside();void refreshStalls()}},2000);
render();
void refreshOutside();
void refreshStalls();
// ถ้าเข้าถึงระบบจริงได้: ใช้ช่องทางรับเงินจริงและส่งการแจ้งชำระเข้าระบบ
(async () => { const c = await payApi<any>("/config").catch(() => null); if (c) { applyPayConfig(c); billSubmitter = submitStallBills; render(); } })();
(() => { const p = new URLSearchParams(location.search); const q = (p.get('stall') || '').trim().toUpperCase(); if (!/^OUT-\d+$/.test(q)) return; const n = (p.get('name') || '').trim(); if (n.length >= 4) { setPage('dues'); void searchStallBills(n, q); } else findPaymentByQr(q); })();
