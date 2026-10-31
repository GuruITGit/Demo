// ส่วนกลางของหน้าชำระเงินประชาชน (ค่าแผง market/ · ค่าขยะ waste/) — ถูกรวมเข้า app.js ของแต่ละหน้าตอน build (tsc outFile)
// ข้อตกลง: หน้าเว็บต้องประกาศ `DEMO` ที่มี `bills: Bill[]` และฟังก์ชัน `render()` เอง · HTML ต้องมี #modal #modalContent และ .toast
type BillStatus = 'unpaid' | 'pending' | 'cash' | 'confirmed' | 'mismatch';
interface Bill { id: string; payerType: 'stall' | 'household'; merchant: string; ref: string; stall?: string; location?: string; houseNo?: string; moo?: string; phone?: string; kind: string; month: string; due: string; amount: number; status: BillStatus; note?: string }

const modal = document.getElementById('modal') as HTMLDialogElement;
const modalContent = document.getElementById('modalContent') as HTMLElement;
const money = n => Number(n).toLocaleString('th-TH',{maximumFractionDigits:2});
const escapeHTML = s => String(s ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
let noticeTimer: number;
function toast(message:string){const notice=window.document.querySelector<HTMLElement>('.toast');if(!notice)return;notice.textContent=message;notice.classList.add('show');window.clearTimeout(noticeTimer);noticeTimer=window.setTimeout(()=>notice.classList.remove('show'),2600)}

const statusText = {unpaid:'ยังไม่ชำระ',pending:'รอตรวจสอบ',cash:'รอจ่ายเงินสด',confirmed:'ยืนยันแล้ว',mismatch:'ยอดไม่ตรง'};
const PAYABLE:BillStatus[] = ['unpaid','mismatch'];
const statusClass = s => s === 'cash' ? 'pending' : s;

// ---------- ค้นหา + เลือกเดือนที่จะจ่าย ----------
let searchTerm = '';
const selectedBills = new Set<string>();
let autoSelectedTerm:string|null=null;
function resetSelection(){selectedBills.clear();autoSelectedTerm=null}
function searchTokens(text:string){return text.toLowerCase().split(/\s+/).filter(Boolean)}
function matchesAllTokens(text:string,tokens:string[]){const hay=text.toLowerCase();return tokens.every(token=>hay.includes(token))}
function groupBillsByPayerMonth(items:Bill[]){const keys=[...new Set(items.map(b=>`${b.payerType}:${b.ref}:${b.month}`))];return keys.map(key=>{const bills=items.filter(b=>`${b.payerType}:${b.ref}:${b.month}`===key);return{month:bills[0].month,bills}})}
function toggleMonth(ids:string,on:boolean){for(const id of ids.split('|')){const bill=DEMO.bills.find(b=>b.id===id);if(!bill||!PAYABLE.includes(bill.status))continue;on?selectedBills.add(id):selectedBills.delete(id)}render()}
function searchBills(q:string){searchTerm=q.trim();resetSelection();render()}

interface BillListOptions { title: string; matches: Bill[]; promptText: string; chargeLabel(b:Bill): string; payerLabel(b:Bill): string; emptyText?: string }
/** รายการบิลแยกเดือน + ยอดรวม + ปุ่มจ่าย (หรือข้อความ "ไม่พบ"/"พิมพ์เพื่อค้นหา") */
function billListHTML(o:BillListOptions){
 const {matches}=o;
 if(searchTerm!==autoSelectedTerm){autoSelectedTerm=searchTerm;selectedBills.clear();matches.filter(b=>PAYABLE.includes(b.status)).forEach(b=>selectedBills.add(b.id))}
 // แสดงเดือนที่ยังค้าง + เดือนที่ส่งไปแล้วรอผล (จะได้เห็นว่าส่งแล้ว ไม่ใช่หายไปเฉยๆ)
 const grouped=groupBillsByPayerMonth(matches).filter(g=>g.bills.some(b=>['unpaid','mismatch','pending','cash'].includes(b.status)));
 const totalDue=matches.filter(b=>PAYABLE.includes(b.status)).reduce((n,b)=>n+b.amount,0);
 const rows=grouped.map(g=>{
  const payable=g.bills.filter(b=>PAYABLE.includes(b.status));
  const ids=payable.map(b=>b.id);
  const checked=ids.length>0&&ids.every(id=>selectedBills.has(id));
  const due=payable.reduce((n,b)=>n+b.amount,0);
  const cashBill=g.bills.find(b=>b.status==='cash');const cashRef=cashBill?paymentRecordFor(cashBill.id)?.ref:'';
  const pending=g.bills.some(b=>b.status==='pending');
  const side=payable.length?`<label class="month-select"><input type="checkbox" ${checked?'checked':''} onchange="toggleMonth('${ids.join('|')}',this.checked)"><span>จ่ายเดือนนี้</span></label>`
   :cashRef?`<button type="button" class="status pending cash-ref-btn" onclick="showCashTicket('${escapeHTML(cashRef)}')">รอจ่ายเงินสด · ดูเลขอ้างอิง</button>`
   :`<span class="status ${pending?'pending':'confirmed'}">${pending?'รอตรวจสอบ':'ชำระแล้ว'}</span>`;
  return `<article class="bill-card month-card"><div class="month-card-head"><div class="month-card-info"><b>${escapeHTML(g.month)}</b><small>${escapeHTML(g.bills[0].merchant)} · ${escapeHTML(o.payerLabel(g.bills[0]))}</small></div>${side}</div>${(n=>n?`<p class="bill-note">หมายเหตุ: ${escapeHTML(n)}</p>`:'')(g.bills.find(b=>b.note)?.note)}<div class="charge-lines">${g.bills.map(b=>`<div class="charge-line"><span>${escapeHTML(o.chargeLabel(b))}</span><b>${money(b.amount)} บาท</b><em class="status ${statusClass(b.status)}">${statusText[b.status]}</em></div>`).join('')}</div>${payable.length?`<div class="month-due"><span>ยอดค้างเดือนนี้</span><b>${money(due)} บาท</b></div>`:''}</article>`;
 }).join('');
 const total=[...selectedBills].reduce((n,id)=>n+(DEMO.bills.find(b=>b.id===id)?.amount||0),0);
 const body=!searchTerm?`<div class="search-prompt"><span>⌕</span><b>${escapeHTML(o.promptText)}</b><small>ยอดค้างจะแสดงแยกตามเดือน</small></div>`
  :!grouped.length?`<div class="empty"><span>✅</span>${escapeHTML(o.emptyText||'ไม่พบรายการค้างชำระที่ตรงกับข้อมูลนี้')}</div>`
  :`<div class="panel"><div class="bill-title"><div><b>ยอด${escapeHTML(o.title)}</b><small>${escapeHTML(searchTerm)}</small></div></div>${rows}<div class="due-total-row"><span>ยอดค้างรวมทุกเดือน</span><b>${money(totalDue)} บาท</b></div></div>${selectedBills.size?`<div class="pay-summary"><div><span>ยอดที่เลือกจ่าย</span><br><b>${money(total)} บาท</b></div><div class="pay-method-actions"><button type="button" class="pay-now" onclick="openPayment()">จ่ายเงิน <span aria-hidden="true">›</span></button></div></div>`:''}`;
 return body+(PAYMENT.demo?'<p class="help" style="text-align:center;padding:5px 12px">ระบบสาธิต · ยอดเงินเป็นตัวอย่าง</p>':'');
}

/** หัวหน้า + ช่องค้นหา (ใช้ทั้งสองหน้า) */
function searchHeaderHTML(h1:string,label:string,placeholder:string,hint:string,headingClass=''){
 return `<div class="page-heading${headingClass}"><h1>${h1}</h1><p>ค้นหา${label} · ไม่ต้องเข้าสู่ระบบ</p></div><form class="search-card" onsubmit="event.preventDefault();searchBills(this.query.value)"><label for="query">${label}</label><div class="search-row"><input id="query" name="query" value="${escapeHTML(searchTerm)}" placeholder="${placeholder}"><button type="submit">ค้นหา</button></div><p class="help">${hint}</p></form>`;
}
