// หน้าเจ้าหน้าที่ · แท็บ "พื้นที่และราคา" (เฉพาะค่าแผง): ตั้งราคาแผงประจำ/ค่าขยะแผง · จัดการพื้นที่แผงลอย (รายวัน/รายเดือน) และผู้เช่า
// พื้นที่แผงลอยเก็บใช้คีย์เดียวกับหน้าประชาชน (lamplaimat:outside-locations) จึงแสดงผลทันทีในหน้าประชาชนบนเครื่องเดียวกัน
const STAFF_LOCATIONS_KEY = 'lamplaimat:outside-locations';
let staffEditLocId: string | null = null;

function loadStaffLocations(): StaffOutsideLocation[] {
  try {
    const value = JSON.parse(localStorage.getItem(STAFF_LOCATIONS_KEY) || 'null');
    if (Array.isArray(value) && value.every(l => l && typeof l.id === 'string' && Array.isArray(l.tenants))) return value as StaffOutsideLocation[];
  } catch { }
  return DEMO.outsideLocations;
}
function saveStaffLocations() { try { localStorage.setItem(STAFF_LOCATIONS_KEY, JSON.stringify(DEMO.outsideLocations)); } catch { } }

const locUnit = (p: 'daily' | 'monthly') => p === 'daily' ? 'วัน' : 'เดือน';
const locPeriodLabel = (p: 'daily' | 'monthly') => p === 'daily' ? 'รายวัน' : 'รายเดือน';
function nextLocId() {
  const n = Math.max(0, ...DEMO.outsideLocations.map(l => Number(l.id.replace('LOC-', '')) || 0));
  return `LOC-${String(n + 1).padStart(2, '0')}`;
}
function readLocForm(form: HTMLFormElement) {
  const fd = new FormData(form);
  const name = String(fd.get('name') || '').trim().slice(0, 60);
  const rate = Number(fd.get('rate'));
  const period: 'daily' | 'monthly' = fd.get('period') === 'daily' ? 'daily' : 'monthly';
  return { name, rate, period, valid: name.length > 0 && Number.isFinite(rate) && rate >= 0 };
}
function locationFormFields(l?: StaffOutsideLocation) {
  return `<label class="staff-field"><span>ชื่อพื้นที่</span><input name="name" maxlength="60" required value="${escapeHTML(l?.name || '')}"></label>
    <label class="staff-field"><span>ค่าเช่า (บาท)</span><input name="rate" type="number" min="0" step="1" required value="${l ? l.rentRate : ''}"></label>
    <label class="staff-field"><span>รอบการเช่า</span><select name="period"><option value="monthly" ${!l || l.rentPeriod === 'monthly' ? 'selected' : ''}>รายเดือน</option><option value="daily" ${l?.rentPeriod === 'daily' ? 'selected' : ''}>รายวัน</option></select></label>`;
}

// ---------- ราคาแผงประจำ ----------
function saveStaffRates(e: Event) {
  e.preventDefault();
  const form = e.currentTarget as HTMLFormElement;
  const read = (name: string) => Number((form.elements.namedItem(name) as HTMLInputElement | null)?.value);
  const values = [...DEMO.planRows.map(r => ({ row: r, value: read(r.id) })), { row: null, value: read('stallWaste') }];
  if (values.some(v => !Number.isInteger(v.value) || v.value < 0 || v.value > 100000)) return toast('ราคาต้องเป็นจำนวนเต็มตั้งแต่ 0 ถึง 100,000 บาท');
  for (const v of values) { if (v.row) v.row.monthlyRate = v.value; else DEMO.rates.stallWaste = v.value; }
  saveStoredRates(DEMO.planRows, DEMO.rates);
  toast('บันทึกราคาแล้ว · มีผลกับบิลรอบถัดไป');
  render();
}

// ---------- พื้นที่แผงลอย ----------
function staffAddLocation(e: Event) {
  e.preventDefault();
  const v = readLocForm(e.currentTarget as HTMLFormElement);
  if (!v.valid) return toast('กรอกชื่อพื้นที่และค่าเช่าให้ถูกต้อง');
  DEMO.outsideLocations.push({ id: nextLocId(), name: v.name, rentRate: v.rate, rentPeriod: v.period, enabled: true, deleted: false, tenants: [] });
  saveStaffLocations();
  toast('เพิ่มพื้นที่แผงลอยแล้ว');
  render();
}
function staffEditLocation(e: Event, id: string) {
  e.preventDefault();
  const l = DEMO.outsideLocations.find(x => x.id === id); if (!l) return;
  const v = readLocForm(e.currentTarget as HTMLFormElement);
  if (!v.valid) return toast('กรอกชื่อพื้นที่และค่าเช่าให้ถูกต้อง');
  Object.assign(l, { name: v.name, rentRate: v.rate, rentPeriod: v.period });
  staffEditLocId = null;
  saveStaffLocations();
  toast('บันทึกพื้นที่แล้ว');
  render();
}
function staffToggleEdit(id: string) { staffEditLocId = staffEditLocId === id ? null : id; render(); }
function staffToggleLocation(id: string) {
  const l = DEMO.outsideLocations.find(x => x.id === id); if (!l) return;
  l.enabled = !l.enabled; saveStaffLocations();
  toast(l.enabled ? 'เปิดให้เช่าแล้ว' : 'ปิดชั่วคราวแล้ว · ไม่แสดงให้ประชาชนเลือก');
  render();
}
function staffDeleteLocation(id: string) {
  const l = DEMO.outsideLocations.find(x => x.id === id); if (!l) return;
  if (!window.confirm(`ลบ “${l.name}” ออกจากหน้าประชาชน ?`)) return;
  l.deleted = true; saveStaffLocations();
  toast('ลบพื้นที่แล้ว');
  render();
}
function staffAddTenant(e: Event, id: string) {
  e.preventDefault();
  const l = DEMO.outsideLocations.find(x => x.id === id); if (!l) return;
  const name = String(new FormData(e.currentTarget as HTMLFormElement).get('name') || '').trim().slice(0, 100);
  if (!name) return toast('กรอกชื่อผู้เช่า');
  l.tenants.push({ name, paid: false }); saveStaffLocations();
  toast('เพิ่มผู้เช่าแล้ว');
  render();
}
function staffToggleTenant(id: string, i: number) {
  const t = DEMO.outsideLocations.find(x => x.id === id)?.tenants[i]; if (!t) return;
  t.paid = !t.paid; saveStaffLocations(); render();
}
function staffRemoveTenant(id: string, i: number) {
  const l = DEMO.outsideLocations.find(x => x.id === id); const t = l?.tenants[i]; if (!l || !t) return;
  if (!window.confirm(`ลบ “${t.name}” ออกจากพื้นที่นี้ ?`)) return;
  l.tenants.splice(i, 1); saveStaffLocations(); render();
}

let staffLocSel: string | null = null;

/** พื้นที่ที่เลือกดูอยู่ (ค่าเริ่มต้นคือพื้นที่แรกที่ยังไม่ถูกลบ) */
function selectedLoc(): StaffOutsideLocation | undefined {
  const locs = DEMO.outsideLocations.filter(l => !l.deleted);
  return locs.find(l => l.id === staffLocSel) ?? locs[0];
}
function staffSelectLoc(id: string) { staffLocSel = id; staffEditLocId = null; render(); }

/** รายละเอียดของพื้นที่เดียว แบ่งเป็น 3 บล็อก: ข้อมูลพื้นที่ (แก้ไข) · ผู้เช่า · การเปิดให้เช่า/ลบ */
function locationPanel(l: StaffOutsideLocation) {
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
  if (!cur) return '<div class="staff-empty">ยังไม่มีพื้นที่แผงลอย</div>';
  return `<div class="staff-locs" role="tablist" aria-label="เลือกพื้นที่แผงลอย">${locs.map(l => `<button type="button" role="tab" aria-selected="${l.id === cur.id}" class="${l.id === cur.id ? 'active' : ''}" onclick="staffSelectLoc('${l.id}')">${escapeHTML(l.name)}<small>${l.tenants.length} ราย · ${l.enabled ? 'เปิด' : 'ปิด'}</small></button>`).join('')}</div>${locationPanel(cur)}`;
}

type RatesView = 'menu' | 'locations' | 'rates' | 'addLoc';
let staffRatesView: RatesView = 'menu';
function setRatesView(v: RatesView) { staffRatesView = v; staffEditLocId = null; render(); }

/** หน้า "พื้นที่และราคา": เริ่มที่เมนูปุ่ม แล้วกดเข้าไปดูข้อมูลหรือกรอกฟอร์มทีละหัวข้อ */
function ratesHTML() {
  const stallCount = (row: string) => DEMO.stalls.filter(st => st.row === row).length;
  const locs = DEMO.outsideLocations.filter(l => !l.deleted);
  const tenants = locs.reduce((n, l) => n + l.tenants.length, 0);
  const titles: Record<RatesView, [string, string]> = {
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
  const body: Record<RatesView, () => string> = { menu: () => menuBody, locations: locationSection, rates: () => rateBody, addLoc: () => addBody };
  return `${back}<div class="staff-head"><h1>${title}</h1><p>${sub}</p></div>${body[staffRatesView]()}`;
}
