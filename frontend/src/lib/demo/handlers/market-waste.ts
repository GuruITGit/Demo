/**
 * ค่าแผงตลาด + ค่าเก็บขยะบ้าน + ทะเบียนครัวเรือน + แผงลอย (ข้อมูลสมมติ)
 * ตอบ endpoint เดียวกับ backend (market/*, waste/*) ทุกตัว — ตรรกะและข้อความผิดพลาดตรงกับ service จริง
 */
import { get, post, patch, put, del, registerSeed, uid, nowIso, persist, badRequest, notFound, type Ctx, type Row } from '../core';
import { ORG_ID } from '../seed-base';
import { needPerm, notify } from './base';

const pad2 = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
/** งวด พ.ศ.-เดือน ของเดือนที่ offset จากเดือนนี้ เช่น 2569-10 */
const period = (offset = 0) => {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear() + 543}-${pad2(d.getMonth() + 1)}`;
};
/** วันสุดท้ายของเดือนในงวด (ค.ศ.) — ใช้เป็นวันครบกำหนด */
const periodEnd = (per: string) => { const [by, m] = per.split('-').map(Number); return ymd(new Date(by - 543, m, 0)); };
const isPeriod = (s: unknown) => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
const OPEN = ['unpaid', 'pending', 'mismatch'];
const METHODS = ['cash', 'qr', 'transfer'];

const ROWS = [{ zone: 'A', rate: 1200 }, { zone: 'B', rate: 900 }, { zone: 'C', rate: 1500 }, { zone: 'D', rate: 1200 }, { zone: 'E', rate: 1050 }];
const TENANT: Record<string, string> = {
  A01: 'นางสาวศิริพร ทองดี', A02: 'นายประเสริฐ ศรีสุข', A03: 'นางอำไพ บุญรอด', A05: 'นายบุญมี คำไหล', A06: 'นางสมใจ ใจดี',
  A08: 'นางสาวกัญญา พิมพ์ดี', B02: 'นายวิทยา แซ่ลี้', B04: 'นางมะลิ แสงทอง', B07: 'นายสมชาย ไทยเจริญ', C03: 'นายวิชัย ผักสด',
  C06: 'นางพัชรี ขำดี', D01: 'นางจันทร์เพ็ญ สุขใจ', E09: 'นางราตรี ผักสด',
  A04: 'นายธนพล วงศ์ษา', B05: 'นางสาวนภัส ใจงาม', C08: 'นายอนันต์ ทองสุข', D07: 'นางสาวปิยนุช รักงาม', E04: 'นางสาวอรทัย ศรีงาม',
};
const OCCUPIED = ['A01', 'A02', 'A03', 'A05', 'A06', 'A08', 'B02', 'B04', 'B07', 'C03', 'C06', 'D01', 'E09'];
const RESERVED = ['A04', 'B05', 'C08', 'D07', 'E04'];
const PAID = new Set(['A01', 'D01', 'B02']);
const PENDING_RENT = new Set(['B04']);
const MISMATCH_RENT = new Set(['C03']);
const ARREARS: [string, number][] = [['A06', -2], ['A06', -1], ['B07', -2], ['B07', -1]];
const HOUSEHOLDS = [
  { ref: 'HH-014', name: 'สมชาย ใจบุญ', houseNo: '18', moo: '2', phone: '0810000014' },
  { ref: 'HH-021', name: 'สมใจ ใจดี', houseNo: '7', moo: '3', phone: '0810000021' },
  { ref: 'HH-030', name: 'มะลิ แสงทอง', houseNo: '18', moo: '5', phone: '0810000030' },
  { ref: 'HH-042', name: 'ประยูร ทองดี', houseNo: '12/3', moo: '2', phone: '0810000042' },
  { ref: 'HH-003', name: 'นายวิชัย ศรีสุข', houseNo: '1', moo: '1', phone: '0810000003' },
  { ref: 'HH-007', name: 'นางสมหมาย บุญมี', houseNo: '4', moo: '1', phone: '0810000007' },
  { ref: 'HH-009', name: 'นายชัยวัฒน์ มีสุข', houseNo: '22', moo: '4', phone: '0810000009' },
  { ref: 'HH-011', name: 'นางสาวอำไพ รุ่งเรือง', houseNo: '9', moo: '2', phone: '0810000011' },
  { ref: 'HH-017', name: 'นายประเสริฐ ใจเย็น', houseNo: '33', moo: '6', phone: '0810000017' },
  { ref: 'HH-019', name: 'นางบุญเรือน ทองคำ', houseNo: '5/1', moo: '3', phone: '0810000019' },
  { ref: 'HH-025', name: 'นายสุรชัย พรมดี', houseNo: '61', moo: '7', phone: '0810000025' },
  { ref: 'HH-028', name: 'นางสาวนิตยา สายหยุด', houseNo: '14', moo: '8', phone: '0810000028' },
  { ref: 'HH-033', name: 'นายธีระพงษ์ แก้วกล้า', houseNo: '27', moo: '4', phone: '0810000033' },
  { ref: 'HH-038', name: 'นางจินตนา ศรีทอง', houseNo: '8', moo: '5', phone: '0810000038' },
  { ref: 'HH-046', name: 'นายวีรยุทธ เพชรดี', houseNo: '40', moo: '1', phone: '0810000046' },
  { ref: 'HH-051', name: 'นางสาวกนกวรรณ ทวีผล', houseNo: '16/2', moo: '6', phone: '0810000051' },
  { ref: 'HH-057', name: 'นายอดิศร คงมั่น', houseNo: '3', moo: '3', phone: '0810000057' },
  { ref: 'HH-063', name: 'นางพรทิพย์ จันทร์งาม', houseNo: '29', moo: '2', phone: '0810000063' },
  { ref: 'HH-068', name: 'นายสมบูรณ์ ดวงแก้ว', houseNo: '72', moo: '7', phone: '0810000068' },
  { ref: 'HH-072', name: 'นางสาวรัชนี หอมจันทร์', houseNo: '11', moo: '8', phone: '0810000072' },
];
const CONFIG = {
  promptpayId: '', promptpayType: 'mobile', payeeName: '', accountBank: '', accountNo: '',
  cashPlace: 'งานการเงิน ที่ทำการ อบต.', cashHours: 'จันทร์–ศุกร์ 08:30–16:30 น. (เว้นวันหยุดราชการ)', contactPhone: '044-000-000',
  wasteStallFee: 30, householdFee: 40,
};

registerSeed((db) => {
  const P = period();
  db.marketStalls = ROWS.flatMap((row) => Array.from({ length: 10 }, (_, i) => {
    const code = `${row.zone}${pad2(i + 1)}`;
    const status = OCCUPIED.includes(code) ? 'occupied' : RESERVED.includes(code) ? 'reserved' : 'available';
    return {
      id: `stall-${code}`, organizationId: ORG_ID, stallCode: code, zone: row.zone, status, active: true,
      tenantName: status === 'available' ? null : TENANT[code] ?? null, contactPhone: null, reservedAt: null, monthlyRate: String(row.rate),
    };
  }));
  const rate = (code: string) => db.marketStalls.find((s) => s.stallCode === code)!.monthlyRate;
  const bill = (code: string, kind: string, per: string, amount: string, status: string, extra: Row = {}) => ({
    id: uid(), organizationId: ORG_ID, stallId: `stall-${code}`, stallCode: code, payerName: TENANT[code], kind, period: per, amount, status,
    dueDate: periodEnd(per), paidMethod: status === 'paid' ? 'cash' : null, paidAt: status === 'paid' ? nowIso() : null,
    receiptNo: status === 'paid' ? `MK-${per.slice(-2)}-SEED${code}${kind === 'waste' ? 'W' : ''}` : null,
    submittedMethod: null, submittedAt: null, slipUrl: null, reviewNote: null, ...extra,
  });
  db.marketBills = [
    ...[...OCCUPIED, ...RESERVED].flatMap((code) => [
      bill(code, 'rent', P, rate(code), PAID.has(code) ? 'paid' : PENDING_RENT.has(code) ? 'pending' : MISMATCH_RENT.has(code) ? 'mismatch' : 'unpaid',
        PENDING_RENT.has(code) ? { submittedMethod: 'transfer', submittedAt: nowIso() } : MISMATCH_RENT.has(code) ? { reviewNote: 'ยอดในสลิปไม่ตรงกับบิล' } : {}),
      bill(code, 'waste', P, String(CONFIG.wasteStallFee), PAID.has(code) ? 'paid' : 'unpaid'),
    ]),
    ...ARREARS.map(([code, off]) => bill(code, 'rent', period(off), rate(code), 'unpaid')),
  ];
  db.marketOutsideLocations = [
    { id: 'outside-1', organizationId: ORG_ID, name: 'หน้าตลาดสด (ลานหน้าอาคาร)', rentRate: '40', rentPeriod: 'daily', enabled: true, active: true, createdAt: nowIso() },
    { id: 'outside-2', organizationId: ORG_ID, name: 'ลานจอดรถ (รายเดือน)', rentRate: '1500', rentPeriod: 'monthly', enabled: false, active: true, createdAt: nowIso() },
  ];
  db.marketOutsideCollections = [];
  // ผู้เช่าแผงลอยตัวอย่าง: รายวัน (ลานหน้าตลาด) และรายเดือน (ลานจอดรถ) — ค้างบ้าง ชำระครบบ้าง
  const isoDaysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
  const OUT = [
    { code: 'OUT-0001', name: 'สมศรี ค้าดี', phone: '0871110001', loc: 'outside-1', days: 10, start: isoDaysAgo(12), dues: [-2, -1, 0], tenancy: 'regular' as const },
    { code: 'OUT-0002', name: 'วิชัย ตลาดเช้า', phone: '0871110002', loc: 'outside-1', days: 30, start: isoDaysAgo(30), dues: [], tenancy: 'temporary' as const },
    { code: 'OUT-0003', name: 'ประนอม แสงจันทร์', phone: '0871110003', loc: 'outside-2', days: 1, start: isoDaysAgo(40), dues: [-1, 0], tenancy: 'regular' as const },
    { code: 'OUT-0004', name: 'อรุณี ใจดี', phone: '0871110004', loc: 'outside-1', days: 5, start: isoDaysAgo(5), dues: [0], tenancy: 'temporary' as const },
  ];
  db.marketOutsideApps = OUT.map((o, i) => ({
    id: 'app-out-' + (i + 1), organizationId: ORG_ID, locationId: o.loc, appCode: o.code, applicantName: o.name, name: o.name, phone: o.phone, tenancyType: o.tenancy,
    idCardUrl: null, startDate: o.start, days: o.days, status: 'approved', reviewNote: null, billId: null, createdAt: nowIso(),
  }));
  const outBills: Row[] = [];
  for (const o of OUT) {
    const loc = db.marketOutsideLocations.find((l: Row) => l.id === o.loc)!;
    const rate = Number(loc.rentRate);
    for (const off of o.dues.length ? o.dues : [-1]) {
      const per = period(off);
      const paid = !o.dues.includes(off);
      outBills.push({ id: uid(), organizationId: ORG_ID, stallId: null, stallCode: o.code, payerName: o.name, kind: 'rent', period: per,
        amount: (loc.rentPeriod === 'monthly' ? rate : rate * o.days).toFixed(2), dueDate: periodEnd(per),
        status: paid ? 'paid' : 'unpaid', paidMethod: paid ? 'cash' : null, paidAt: paid ? nowIso() : null, receiptNo: null,
        submittedMethod: null, submittedAt: null, slipUrl: null, reviewNote: null });
    }
  }
  db.marketBills = [...db.marketBills, ...outBills];
  db.wasteHouseholds = HOUSEHOLDS.map((h) => ({
    id: `hh-${h.ref}`, organizationId: ORG_ID, householdRef: h.ref, holderName: h.name, houseNo: h.houseNo, moo: h.moo, phone: h.phone,
    monthlyFee: null, active: true, createdAt: nowIso(),
  }));
  db.wasteBills = HOUSEHOLDS.flatMap((h) => [period(-1), P].map((per) => ({
    id: uid(), organizationId: ORG_ID, householdRef: h.ref, holderName: h.name, houseNo: h.houseNo, moo: h.moo, phone: h.phone, period: per,
    amount: '40', status: h.ref === 'HH-021' && per === P ? 'pending' : 'unpaid', dueDate: periodEnd(per), paidMethod: null, paidAt: null, receiptNo: null,
    submittedMethod: h.ref === 'HH-021' && per === P ? 'transfer' : null, submittedAt: h.ref === 'HH-021' && per === P ? nowIso() : null, slipUrl: null, reviewNote: null,
  })));
  db.payConfig = [{ id: 'pay-config', ...CONFIG }];
  db.receiptSeq = [];
});

// ───────────────────────────── ตัวช่วย
/** เดโม่: จุดแผงลอยที่เปิดให้เช่า ซิงก์ไปคีย์ localStorage ที่หน้าประชาชน (same origin) อ่านอยู่ — รูปแบบต้องตรงกับ market/app.ts */
const CITIZEN_OUTSIDE_KEY = 'lamplaimat:outside-locations';
/** จำนวนผู้เช่าที่จองจุดนี้แล้ว (รอตรวจ/อนุมัติแล้ว) */
const takenCount = (db: Ctx['db'], locId: string) => db.marketOutsideApps.filter((a) => a.locationId === locId && ['pending', 'approved'].includes(a.status)).length;

/** บิลแผงลอยที่ยังค้าง → หน้าประชาชน (ค้นด้วยชื่อ) */
function syncCitizenOutsideBills(db: Ctx['db']) {
  try {
    const rows = db.marketBills
      .filter((b) => b.organizationId === ORG_ID && String(b.stallCode).startsWith('OUT-'))
      .map((b) => ({ id: b.id, stallCode: b.stallCode, payerName: b.payerName, kind: b.kind, period: b.period, amount: b.amount, status: b.status, submittedMethod: b.submittedMethod ?? null, dueDate: b.dueDate ?? null, reviewNote: b.reviewNote ?? null }));
    localStorage.setItem('lamplaimat:demo-outside-bills', JSON.stringify(rows));
  } catch { /* เขียนไม่ได้ = ข้าม */ }
}

function syncCitizenOutside(db: Ctx['db']) {
  try {
    const rows = db.marketOutsideLocations
      .filter((l) => l.active && l.organizationId === ORG_ID)
      .slice(0, 50)
      .map((l, i) => ({
        id: 'LOC-' + (i + 1), name: String(l.name).slice(0, 60), rentRate: Number(l.rentRate) || 0,
        rentPeriod: l.rentPeriod === 'monthly' ? 'monthly' : 'daily', enabled: !!l.enabled, deleted: false, tenants: [], openFrom: l.openFrom || null, openUntil: l.openUntil || null, capacity: l.capacity || null, taken: takenCount(db, l.id), full: !!l.capacity && takenCount(db, l.id) >= l.capacity,
      }));
    localStorage.setItem(CITIZEN_OUTSIDE_KEY, JSON.stringify(rows));
  } catch { /* เบราว์เซอร์ไม่ให้เขียน = ข้าม */ }
}
/** เดโม่: สถานะแผงทั้งหมดให้หน้าประชาชน (origin เดียวกัน) อ่านชุดเดียวกับเจ้าหน้าที่ — เรียกทุกครั้งที่หน้าเจ้าหน้าที่โหลดรายการแผง */
function syncCitizenStalls(db: Ctx['db']) {
  try {
    const rows = db.marketStalls.filter((s) => s.active && s.organizationId === ORG_ID)
      .map((s) => ({ stallCode: s.stallCode, zone: s.zone, status: s.status, monthlyRate: Number(s.monthlyRate) || 0 }));
    localStorage.setItem('lamplaimat:demo-stalls', JSON.stringify(rows));
  } catch { /* เขียนไม่ได้ = ข้าม */ }
}
const cfg = (c: Ctx) => c.db.payConfig[0] as Row;
const one = (list: Row[], pred: (r: Row) => boolean, msg: string): Row => { const r = list.find(pred); if (!r) throw notFound(msg); return r; };
const byIdOrThrow = (list: Row[], id: string, msg: string) => one(list, (r) => r.id === id && r.organizationId === ORG_ID, msg);

/** เลขใบเสร็จ MK-yy-000001 รันต่อประเภท ต่อปี พ.ศ. */
function nextReceipt(c: Ctx, prefix: string): string {
  const yy = String(new Date().getFullYear() + 543).slice(-2);
  let row = c.db.receiptSeq.find((r) => r.prefix === prefix && r.yy === yy);
  if (!row) { row = { prefix, yy, last: 0 }; c.db.receiptSeq.push(row); }
  row.last += 1;
  return `${prefix}-${yy}-${String(row.last).padStart(6, '0')}`;
}

// ───────────────────────────── เดโม่: รับการแจ้งชำระที่ประชาชนส่งมา (หน้าประชาชนบันทึกลง localStorage 'market:payments')
const CITIZEN_PAY_KEY = 'market:payments';
const MONTHS_TH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
/** ดึงรายการแจ้งชำระเข้าบิลเดโม่เป็น "รอตรวจ" + แจ้งเตือน (ต่อ 1 การส่ง) — บิลที่หาไม่เจอข้าม */
function absorbPayments(db: Ctx['db']) {
  let raw: Record<string, Row>;
  try { raw = JSON.parse(localStorage.getItem(CITIZEN_PAY_KEY) || '{}'); } catch { return; }
  db.demoPayLinks ??= [];
  const told = new Set<string>();
  let changed = false;
  for (const [cid, r] of Object.entries(raw)) {
    if (!r?.meta || !['pending', 'cash'].includes(r.status) || db.demoPayLinks.some((l) => l.citizenId === cid && l.at === r.at)) continue;
    const [mn, y] = String(r.meta.m).split(' ');
    const mi = MONTHS_TH.indexOf(mn) + 1;
    if (!mi) continue;
    const per = `${y}-${pad2(mi)}`;
    const household = r.meta.t === 'household';
    const bill = household
      ? db.wasteBills.find((b) => b.organizationId === ORG_ID && b.householdRef === r.meta.s && b.period === per)
      : db.marketBills.find((b) => b.organizationId === ORG_ID && b.stallCode === r.meta.s && b.kind === (r.meta.k === 'ค่าขยะ' ? 'waste' : 'rent') && b.period === per);
    if (!bill) continue;
    db.demoPayLinks.push({ citizenId: cid, at: r.at, billId: bill.id });
    changed = true;
    if (bill.status === 'paid') continue;
    Object.assign(bill, { status: 'pending', submittedMethod: r.method === 'cash' ? 'cash' : 'transfer', submittedAt: r.at, slipUrl: null, reviewNote: r.method === 'cash' ? null : 'เดโม่: ไม่มีรูปสลิปจริง' });
    if (told.has(r.ref)) continue;
    told.add(r.ref);
    notify(db, db.users.map((u: Row) => u.id), {
      type: household ? 'waste:pending' : 'market:pending', title: 'มีการแจ้งชำระรอตรวจ',
      body: `${household ? 'บ้าน ' : 'แผง '}${r.meta.s} · ${Number(r.amount).toLocaleString('th-TH')} บาท · ${r.method === 'cash' ? 'เงินสด' : 'โอน'}`, actionUrl: household ? '/waste' : '/market',
    });
  }
  if (changed) persist();
}
/** เจ้าหน้าที่ยืนยัน/ปฏิเสธบิลที่ประชาชนแจ้งมา → เขียนผลกลับให้หน้าประชาชนเห็น */
function syncPayBack(db: Ctx['db'], billId: string, status: 'confirmed' | 'rejected', note?: string) {
  try {
    const links = (db.demoPayLinks ?? []).filter((l) => l.billId === billId);
    if (!links.length) return;
    const raw = JSON.parse(localStorage.getItem(CITIZEN_PAY_KEY) || '{}');
    for (const l of links) if (raw[l.citizenId]?.at === l.at) { raw[l.citizenId].status = status; if (note) raw[l.citizenId].note = note; }
    localStorage.setItem(CITIZEN_PAY_KEY, JSON.stringify(raw));
    db.demoPayLinks = db.demoPayLinks.filter((l) => l.billId !== billId);
  } catch { /* เขียนไม่ได้ = ข้าม */ }
}

function payBill(c: Ctx, list: Row[], prefix: string, notFoundMsg: string) {
  const bill = list.find((b) => b.id === c.params.id && b.organizationId === ORG_ID);
  if (!bill) throw notFound(notFoundMsg);
  if (bill.status === 'paid') throw badRequest('บิลนี้ชำระแล้ว');
  const method = METHODS.includes(c.body?.method) ? c.body.method : 'cash';
  Object.assign(bill, { status: 'paid', paidMethod: method, paidAt: nowIso(), reviewNote: null, receiptNo: nextReceipt(c, prefix) });
  syncPayBack(c.db, bill.id, 'confirmed');
  return bill;
}

function rejectBill(c: Ctx, list: Row[], notFoundMsg: string, status: string) {
  const bill = list.find((b) => b.id === c.params.id && b.organizationId === ORG_ID);
  if (!bill) throw notFound(notFoundMsg);
  if (bill.status === 'paid') throw badRequest('บิลนี้ชำระแล้ว ไม่สามารถปฏิเสธได้');
  bill.status = status;
  bill.reviewNote = String(c.body?.note ?? '').trim().slice(0, 300) || 'เจ้าหน้าที่ตรวจแล้วไม่ตรง กรุณาแจ้งชำระใหม่';
  syncPayBack(c.db, bill.id, 'rejected', bill.reviewNote);
  return bill;
}

const sortBills = (a: Row, b: Row) => b.period.localeCompare(a.period) || a.stallCode?.localeCompare(b.stallCode ?? '') || String(a.kind ?? '').localeCompare(String(b.kind ?? ''));

// ───────────────────────────── เดโม่: รับการจอง/สมัครแผงลอยที่ประชาชนส่งมา (หน้าประชาชนอยู่ origin เดียวกัน เขียนลง localStorage)
const CITIZEN_RES_KEY = 'lamplaimat:demo-reservations';
const CITIZEN_APP_KEY = 'lamplaimat:demo-outside-apps';
function takeCitizen(key: string): Row[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    localStorage.removeItem(key);
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}
/** ดึงรายการที่ประชาชนส่งมาเข้าฐานข้อมูลเดโม่ + แจ้งเตือนเจ้าหน้าที่ — เรียกทุกครั้งที่หน้าเจ้าหน้าที่โหลดข้อมูลแผง */
function absorbCitizen(db: Ctx['db']) {
  const staff = db.users.map((u: Row) => u.id);
  let changed = false;
  for (const r of takeCitizen(CITIZEN_RES_KEY)) {
    const s = db.marketStalls.find((x) => x.stallCode === r.stallCode && x.active && x.status === 'available');
    if (!s) continue;
    Object.assign(s, {
      status: 'reserved', tenantName: String(r.name ?? '').slice(0, 200), contactPhone: String(r.phone ?? '').slice(0, 20),
      reservedAt: r.reservedAt || nowIso(), reserveStartDate: r.startDate || null, reserveDays: r.days || null, reserveCardUrl: null,
    });
    notify(db, staff, { type: 'market:reserved', title: 'มีการจองแผงใหม่', body: `แผง ${s.stallCode} · ${s.tenantName} · โทร ${s.contactPhone} — รอยืนยัน`, actionUrl: '/market?tab=reserve' });
    changed = true;
  }
  for (const a of takeCitizen(CITIZEN_APP_KEY)) {
    const locs = db.marketOutsideLocations.filter((l) => l.active && l.organizationId === ORG_ID);
    const loc = locs[Number(String(a.locationId).replace(/\D/g, '')) - 1];
    if (!loc || db.marketOutsideApps.some((x) => x.appCode === a.appCode)) continue;
    db.marketOutsideApps.push({
      id: uid(), organizationId: ORG_ID, locationId: loc.id, appCode: a.appCode, applicantName: String(a.name ?? '').slice(0, 200), phone: String(a.phone ?? '').slice(0, 20),
      idCardUrl: null, startDate: a.startDate || null, days: Number(a.days) || 1, status: 'pending', reviewNote: null, billId: null, createdAt: a.createdAt || nowIso(), tenancyType: a.tenancyType === 'temporary' ? 'temporary' : 'regular',
    });
    notify(db, staff, { type: 'market:outside_applied', title: 'มีใบสมัครแผงลอยใหม่', body: `${a.appCode} · ${loc.name} · ${a.name} · โทร ${a.phone}`, actionUrl: '/market' });
    changed = true;
  }
  if (changed) { persist(); syncCitizenStalls(db); }
}
const reservations = (db: Ctx['db']) => db.marketStalls
  .filter((s) => s.active && s.organizationId === ORG_ID && s.status === 'reserved')
  .sort((a, b) => String(a.reservedAt ?? '').localeCompare(String(b.reservedAt ?? '')))
  .map((s) => ({
    id: s.id, stallCode: s.stallCode, zone: s.zone, tenantName: s.tenantName, contactPhone: s.contactPhone, reservedAt: s.reservedAt,
    reserveStartDate: s.reserveStartDate ?? null, reserveDays: s.reserveDays ?? null, reserveCardUrl: s.reserveCardUrl ?? null,
  }));

get('/market/reservations', (c) => {
  needPerm(c, 'market:read:MarketStall');
  absorbCitizen(c.db);
  return reservations(c.db);
});

post('/market/reservations/notify', (c) => {
  needPerm(c, 'market:manage:MarketStall');
  absorbCitizen(c.db);
  const rows = reservations(c.db);
  if (!rows.length) throw badRequest('ไม่มีการจองที่รอยืนยัน');
  const codes = rows.slice(0, 8).map((r) => r.stallCode).join(', ') + (rows.length > 8 ? ' ...' : '');
  notify(c.db, c.db.users.map((u: Row) => u.id), { type: 'market:reserved_pending', title: `มีการจองรอยืนยัน ${rows.length} แผง`, body: `แผง ${codes}`, actionUrl: '/market?tab=reserve' });
  return { ok: true, count: rows.length };
});

// ───────────────────────────── ใบสมัครแผงลอย (เดโม่)
const withLocation = (db: Ctx['db'], a: Row) => ({ ...a, location: db.marketOutsideLocations.find((l) => l.id === a.locationId) });
/** ยอดที่ยังไม่ชำระของผู้เช่าแผงลอย (รหัสผู้เช่า = รหัสบิล) */
const openDuesOf = (db: Ctx['db'], code: string) => {
  const open = db.marketBills.filter((b) => b.organizationId === ORG_ID && b.stallCode === code && ['unpaid', 'pending', 'mismatch'].includes(b.status));
  return { count: open.length, total: open.reduce((s, b) => s + Number(b.amount), 0) };
};

get('/market/outside/applications', (c) => {
  needPerm(c, 'market:read:MarketBill');
  absorbCitizen(c.db);
  syncCitizenOutsideBills(c.db);
  const st = c.query?.status;
  return c.db.marketOutsideApps
    .filter((a) => a.organizationId === ORG_ID && (!st || a.status === st))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .map((a) => ({ ...withLocation(c.db, a), openDues: openDuesOf(c.db, a.appCode) }));
});

post('/market/outside/applications/:id/cancel', (c) => {
  needPerm(c, 'market:manage:MarketBill');
  const app = byIdOrThrow(c.db.marketOutsideApps, c.params.id, 'ไม่พบผู้เช่ารายนี้');
  if (app.status !== 'approved') throw badRequest('ลบได้เฉพาะผู้เช่าที่อนุมัติแล้ว');
  const open = openDuesOf(c.db, app.appCode);
  if (open.count > 0) throw badRequest(`ยังมียอดค้างชำระ ${open.count} รายการ ต้องชำระให้ครบก่อนจึงลบผู้เช่าได้`);
  Object.assign(app, { status: 'cancelled' });
  return { ok: true };
});

post('/market/outside/applications/:id/approve', (c) => {
  needPerm(c, 'market:manage:MarketBill');
  const app = byIdOrThrow(c.db.marketOutsideApps, c.params.id, 'ไม่พบใบสมัครนี้');
  if (app.status !== 'pending') throw badRequest('ใบสมัครนี้ดำเนินการไปแล้ว');
  const loc = c.db.marketOutsideLocations.find((l) => l.id === app.locationId);
  if (!loc) throw notFound('ไม่พบจุดแผงลอยนี้');
  const rate = Number(loc.rentRate);
  const amount = loc.rentPeriod === 'monthly' ? rate : rate * app.days;
  const per = app.startDate ? `${Number(app.startDate.slice(0, 4)) + 543}-${app.startDate.slice(5, 7)}` : period();
  const bill = { id: uid(), organizationId: ORG_ID, stallId: null, stallCode: app.appCode, payerName: app.applicantName, kind: 'rent', period: per, amount: amount.toFixed(2), dueDate: app.tenancyType === 'temporary' ? ymd(new Date()) : periodEnd(per), status: 'unpaid', paidMethod: null, paidAt: null, receiptNo: null, submittedMethod: null, submittedAt: null, slipUrl: null, reviewNote: null };
  c.db.marketBills.push(bill);
  Object.assign(app, { status: 'approved', billId: bill.id, reviewNote: null });
  syncCitizenOutsideBills(c.db);
  return { ok: true, billId: bill.id, appCode: app.appCode, amount };
});

post('/market/outside/applications/:id/reject', (c) => {
  needPerm(c, 'market:manage:MarketBill');
  const app = byIdOrThrow(c.db.marketOutsideApps, c.params.id, 'ไม่พบใบสมัครนี้');
  if (app.status !== 'pending') throw badRequest('ใบสมัครนี้ดำเนินการไปแล้ว');
  Object.assign(app, { status: 'rejected', reviewNote: String(c.body?.note ?? '').trim().slice(0, 300) || null });
  return { ok: true };
});

// ───────────────────────────── ค่าแผงตลาด: ผังแผง
get('/market/stalls', (c) => {
  needPerm(c, 'market:read:MarketStall');
  absorbCitizen(c.db);
  syncCitizenStalls(c.db);
  return c.db.marketStalls.filter((s) => s.active && s.organizationId === ORG_ID).sort((a, b) => a.stallCode.localeCompare(b.stallCode));
});

post('/market/stalls', (c) => {
  needPerm(c, 'market:manage:MarketStall');
  const code = String(c.body?.stallCode ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9ก-๙]{1,10}$/i.test(code)) throw badRequest('รหัสแผงใช้ตัวอักษร/ตัวเลข ไม่เกิน 10 ตัว');
  const zone = String(c.body?.zone ?? '').trim().toUpperCase().slice(0, 10) || code.replace(/[0-9]+$/, '').slice(0, 10) || code.slice(0, 1);
  const rate = String(Number(c.body?.monthlyRate) || 0);
  const ex = c.db.marketStalls.find((s) => s.stallCode === code);
  if (ex?.active) throw badRequest(`มีแผง ${code} อยู่แล้ว`);
  if (ex) return Object.assign(ex, { active: true, zone, status: 'available', tenantName: null, contactPhone: null, reservedAt: null, monthlyRate: rate });
  const row = { id: uid(), organizationId: ORG_ID, stallCode: code, zone, status: 'available', tenantName: null, contactPhone: null, reservedAt: null, monthlyRate: rate, active: true };
  c.db.marketStalls.push(row);
  return row;
});

post('/market/stalls/bulk', (c) => {
  needPerm(c, 'market:manage:MarketStall');
  const zone = String(c.body?.zone ?? '').trim().toUpperCase();
  const from = Number(c.body?.from), to = Number(c.body?.to);
  if (!zone) throw badRequest('กรุณาระบุโซน');
  if (!(from >= 1 && to >= 1) || to < from) throw badRequest('เลขล็อกสุดท้ายต้องไม่น้อยกว่าล็อกแรก');
  if (to - from + 1 > 200) throw badRequest('เพิ่มได้ครั้งละไม่เกิน 200 ล็อก');
  const rate = String(Number(c.body?.monthlyRate) || 0);
  let created = 0, reopened = 0, skipped = 0;
  for (let i = from; i <= to; i++) {
    const code = `${zone}${pad2(i)}`;
    const ex = c.db.marketStalls.find((s) => s.stallCode === code);
    if (ex?.active) { skipped++; continue; }
    if (ex) { Object.assign(ex, { active: true, zone, status: 'available', tenantName: null, contactPhone: null, reservedAt: null, monthlyRate: rate }); reopened++; continue; }
    c.db.marketStalls.push({ id: uid(), organizationId: ORG_ID, stallCode: code, zone, status: 'available', tenantName: null, contactPhone: null, reservedAt: null, monthlyRate: rate, active: true });
    created++;
  }
  return { created, reopened, skipped };
});

post('/market/zones/rate', (c) => {
  needPerm(c, 'market:manage:MarketStall');
  const zone = String(c.body?.zone ?? '').trim().toUpperCase();
  const rows = c.db.marketStalls.filter((s) => s.active && s.zone === zone);
  if (!rows.length) throw notFound('ไม่พบโซนนี้');
  rows.forEach((s) => { s.monthlyRate = String(Number(c.body?.monthlyRate) || 0); });
  return { zone, updated: rows.length };
});

patch('/market/stalls/:id', (c) => {
  needPerm(c, 'market:manage:MarketStall');
  const s = byIdOrThrow(c.db.marketStalls, c.params.id, 'ไม่พบแผงนี้');
  const b = c.body ?? {};
  if (b.status === 'available' && s.status !== 'available') {
    const open = c.db.marketBills.filter((x) => x.organizationId === ORG_ID && x.stallCode === s.stallCode && ['unpaid', 'pending', 'mismatch'].includes(x.status)).length;
    if (open > 0) throw badRequest(`ยังมียอดค้างชำระ ${open} รายการ ต้องชำระให้ครบก่อนจึงยกเลิกผู้เช่าได้`);
  }
  if (b.status !== undefined) s.status = b.status;
  if (b.tenantName !== undefined) s.tenantName = b.tenantName || null;
  if (b.monthlyRate !== undefined) s.monthlyRate = String(Number(b.monthlyRate) || 0);
  if (s.status === 'available') { s.tenantName = null; s.contactPhone = null; s.reservedAt = null; }
  syncCitizenStalls(c.db); // ยืนยัน/ปฏิเสธ/คืนว่าง → หน้าประชาชนเห็นสถานะใหม่
  return s;
});

del('/market/stalls/:id', (c) => {
  needPerm(c, 'market:manage:MarketStall');
  const s = byIdOrThrow(c.db.marketStalls, c.params.id, 'ไม่พบแผงนี้');
  const open = c.db.marketBills.filter((b) => b.stallCode === s.stallCode && b.organizationId === ORG_ID && OPEN.includes(b.status)).length;
  if (open) throw badRequest(`แผง ${s.stallCode} ยังมีบิลค้าง ${open} รายการ — เก็บเงินหรือยกเลิกบิลก่อนลบแผง`);
  Object.assign(s, { active: false, status: 'available', tenantName: null, contactPhone: null, reservedAt: null });
  return { ok: true };
});

// ───────────────────────────── ค่าแผงตลาด: บิล
get('/market/bills', (c) => {
  absorbPayments(c.db);
  needPerm(c, 'market:read:MarketBill');
  const { status, period: per, stallCode } = c.query;
  return c.db.marketBills
    .filter((b) => b.organizationId === ORG_ID && (!status || b.status === status) && (!per || b.period === per) && (!stallCode || b.stallCode === String(stallCode).toUpperCase()))
    .sort(sortBills).slice(0, 500);
});

post('/market/bills', (c) => {
  needPerm(c, 'market:manage:MarketBill');
  const code = String(c.body?.stallCode ?? '').trim().toUpperCase();
  const kind = c.body?.kind === 'waste' ? 'waste' : 'rent';
  const per = String(c.body?.period ?? '');
  const amount = Number(c.body?.amount);
  if (!isPeriod(per)) throw badRequest('งวดต้องเป็นรูปแบบ พ.ศ.-เดือน เช่น 2569-10');
  if (!(amount > 0)) throw badRequest('ยอดต้องมากกว่า 0');
  const stall = c.db.marketStalls.find((s) => s.stallCode === code && s.active);
  if (!stall) throw notFound(`ไม่พบแผง ${code}`);
  if (c.db.marketBills.some((b) => b.stallCode === code && b.kind === kind && b.period === per)) throw badRequest('มีบิลชนิดและงวดนี้ของแผงนี้อยู่แล้ว');
  const row = { id: uid(), organizationId: ORG_ID, stallId: stall.id, stallCode: code, payerName: stall.tenantName || code, kind, period: per, amount: String(amount), dueDate: periodEnd(per), status: 'unpaid', paidMethod: null, paidAt: null, receiptNo: null, submittedMethod: null, submittedAt: null, slipUrl: null, reviewNote: null };
  c.db.marketBills.push(row);
  return row;
});

del('/market/bills/:id', (c) => {
  needPerm(c, 'market:manage:MarketBill');
  const b = byIdOrThrow(c.db.marketBills, c.params.id, 'ไม่พบบิลค่าแผงนี้');
  if (b.status === 'paid') throw badRequest('บิลนี้ชำระแล้ว ลบไม่ได้');
  c.db.marketBills = c.db.marketBills.filter((x) => x !== b);
  return { ok: true };
});

post('/market/bills/generate', (c) => {
  needPerm(c, 'market:manage:MarketBill');
  const per = String(c.body?.period || period());
  if (!isPeriod(per)) throw badRequest('งวดต้องเป็นรูปแบบ พ.ศ.-เดือน เช่น 2569-10');
  const config = cfg(c);
  const occupied = c.db.marketStalls.filter((s) => s.active && s.status === 'occupied');
  const have = new Set(c.db.marketBills.filter((b) => b.period === per).map((b) => `${b.stallCode}|${b.kind}`));
  let created = 0;
  for (const s of occupied) {
    const add = (kind: 'rent' | 'waste', amount: number) => {
      if (amount <= 0 || have.has(`${s.stallCode}|${kind}`)) return;
      c.db.marketBills.push({ id: uid(), organizationId: ORG_ID, stallId: s.id, stallCode: s.stallCode, payerName: s.tenantName || s.stallCode, kind, period: per, amount: String(amount), dueDate: periodEnd(per), status: 'unpaid', paidMethod: null, paidAt: null, receiptNo: null, submittedMethod: null, submittedAt: null, slipUrl: null, reviewNote: null });
      created++;
    };
    add('rent', Number(s.monthlyRate));
    add('waste', Number(config.wasteStallFee));
  }
  return { period: per, created, skipped: occupied.length * 2 - created };
});

post('/market/bills/:id/pay', (c) => { needPerm(c, 'market:manage:MarketBill'); return payBill(c, c.db.marketBills, 'MK', 'ไม่พบบิลค่าแผงนี้'); });
post('/market/bills/:id/reject', (c) => { needPerm(c, 'market:manage:MarketBill'); return rejectBill(c, c.db.marketBills, 'ไม่พบบิลค่าแผงนี้', 'mismatch'); });
get('/market/bills/:id/receipt', (c) => {
  needPerm(c, 'market:read:MarketBill');
  const b = byIdOrThrow(c.db.marketBills, c.params.id, 'ไม่พบบิลค่าแผงนี้');
  if (b.status !== 'paid') throw badRequest('บิลนี้ยังไม่ชำระ');
  return b;
});

get('/market/summary', (c) => {
  absorbPayments(c.db);
  absorbCitizen(c.db); // ภาพรวมต้องนับการจองใหม่จากหน้าประชาชนด้วย
  needPerm(c, 'market:read:MarketBill');
  const per = c.query.period || null;
  const bills = c.db.marketBills.filter((b) => !per || b.period === per);
  const byStatus = [...new Set(bills.map((b) => b.status))].map((status) => {
    const rows = bills.filter((b) => b.status === status);
    return { status, count: rows.length, total: rows.reduce((s, b) => s + Number(b.amount), 0) };
  });
  const open = bills.filter((b) => b.status !== 'paid');
  const codes = [...new Set(open.map((b) => b.stallCode))];
  const arrears = codes.map((code) => {
    const rows = open.filter((b) => b.stallCode === code);
    return { stallCode: code, payerName: rows[0].payerName, months: new Set(rows.map((b) => b.period)).size, oldest: rows.map((b) => b.period).sort()[0], total: rows.reduce((s, b) => s + Number(b.amount), 0) };
  }).sort((a, b) => b.total - a.total || a.stallCode.localeCompare(b.stallCode)).slice(0, 200);
  const stallCounts = ['available', 'reserved', 'occupied'].map((status) => ({ status, count: c.db.marketStalls.filter((s) => s.active && s.status === status).length }));
  return { period: per, byStatus, arrears, stallCounts };
});

// ───────────────────────────── ตั้งค่ารับเงิน/ราคา (ค่าแผงและค่าขยะใช้ชุดเดียวกัน)
get('/market/config', (c) => { needPerm(c, 'market:read:MarketBill'); return { ...cfg(c), id: undefined }; });
put('/market/config', (c) => { needPerm(c, 'market:manage:MarketStall'); return saveConfig(c); });
get('/waste/config', (c) => { needPerm(c, 'waste:read:WasteBill'); return { ...cfg(c), id: undefined }; });
put('/waste/config', (c) => { needPerm(c, 'waste:manage:WasteBill'); return saveConfig(c); });
function saveConfig(c: Ctx) {
  const row = cfg(c), b = c.body ?? {};
  const text = (v: unknown, max: number, fb: string) => (typeof v === 'string' ? v.trim().slice(0, max) : fb);
  const fee = (v: unknown, fb: number) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.round(Number(v) * 100) / 100 : fb);
  Object.assign(row, {
    promptpayId: text(b.promptpayId, 20, row.promptpayId).replace(/\D/g, ''),
    promptpayType: ['mobile', 'natid', 'ewallet'].includes(b.promptpayType) ? b.promptpayType : row.promptpayType,
    payeeName: text(b.payeeName, 120, row.payeeName), accountBank: text(b.accountBank, 60, row.accountBank), accountNo: text(b.accountNo, 30, row.accountNo),
    cashPlace: text(b.cashPlace, 120, row.cashPlace), cashHours: text(b.cashHours, 120, row.cashHours), contactPhone: text(b.contactPhone, 40, row.contactPhone ?? ''),
    wasteStallFee: fee(b.wasteStallFee, row.wasteStallFee), householdFee: fee(b.householdFee, row.householdFee),
  });
  return { ...row, id: undefined };
}

// ───────────────────────────── แผงลอย
get('/market/outside/locations', (c) => {
  needPerm(c, 'market:read:MarketStall');
  syncCitizenOutside(c.db); // เปิดดูรายการเมื่อไร หน้าประชาชนก็ได้ชุดเดียวกัน (ไม่ต้องรอให้มีการแก้ไข)
  return c.db.marketOutsideLocations.filter((l) => l.active && l.organizationId === ORG_ID).map((l) => ({ ...l, taken: takenCount(c.db, l.id) }));
});
post('/market/outside/locations', (c) => {
  needPerm(c, 'market:manage:MarketStall');
  const name = String(c.body?.name ?? '').trim();
  if (!name) throw badRequest('กรุณาระบุชื่อจุดแผงลอย');
  const row = { id: uid(), organizationId: ORG_ID, name, openFrom: c.body?.openFrom || null, openUntil: c.body?.openUntil || null, capacity: Number(c.body?.capacity) || null, rentRate: String(Number(c.body?.rentRate) || 0), rentPeriod: c.body?.rentPeriod === 'monthly' ? 'monthly' : 'daily', enabled: c.body?.enabled ?? true, active: true, createdAt: nowIso() };
  c.db.marketOutsideLocations.push(row);
  syncCitizenOutside(c.db);
  return row;
});
patch('/market/outside/locations/:id', (c) => {
  needPerm(c, 'market:manage:MarketStall');
  const l = one(c.db.marketOutsideLocations, (x) => x.id === c.params.id && x.active && x.organizationId === ORG_ID, 'ไม่พบจุดแผงลอยนี้');
  const b = c.body ?? {};
  if (b.name !== undefined) { const n = String(b.name).trim(); if (!n) throw badRequest('ชื่อต้องไม่ว่าง'); l.name = n; }
  if (b.rentRate !== undefined) l.rentRate = String(Number(b.rentRate) || 0);
  if (b.rentPeriod !== undefined) l.rentPeriod = b.rentPeriod === 'monthly' ? 'monthly' : 'daily';
  if (b.enabled !== undefined) l.enabled = !!b.enabled;
  if (b.capacity !== undefined) l.capacity = Number(b.capacity) || null;
  if (b.openFrom !== undefined || b.openUntil !== undefined) {
    const from = b.openFrom !== undefined ? b.openFrom || null : l.openFrom ?? null;
    const until = b.openUntil !== undefined ? b.openUntil || null : l.openUntil ?? null;
    if (from && until && from > until) throw badRequest('วันเริ่มเปิดให้เช่าต้องไม่หลังวันสิ้นสุด');
    l.openFrom = from; l.openUntil = until;
  }
  syncCitizenOutside(c.db);
  return l;
});
del('/market/outside/locations/:id', (c) => {
  needPerm(c, 'market:manage:MarketStall');
  const l = one(c.db.marketOutsideLocations, (x) => x.id === c.params.id && x.active && x.organizationId === ORG_ID, 'ไม่พบจุดแผงลอยนี้');
  Object.assign(l, { active: false, enabled: false });
  syncCitizenOutside(c.db);
  return { ok: true };
});
get('/market/outside/collections', (c) => {
  needPerm(c, 'market:read:MarketBill');
  const to = String(c.query.to || ymd(new Date()));
  const from = String(c.query.from || ymd(new Date(Date.now() - 30 * 86400000)));
  const loc = c.query.locationId;
  const rows = c.db.marketOutsideCollections
    .filter((r) => r.organizationId === ORG_ID && (!loc || r.locationId === loc) && r.collectedOn >= from && r.collectedOn <= to)
    .sort((a, b) => b.collectedOn.localeCompare(a.collectedOn) || b.createdAt.localeCompare(a.createdAt)).slice(0, 500);
  return { from, to, total: rows.reduce((s, r) => s + Number(r.amount), 0), rows };
});
post('/market/outside/collections', (c) => {
  needPerm(c, 'market:manage:MarketBill');
  const loc = one(c.db.marketOutsideLocations, (x) => x.id === c.body?.locationId && x.active && x.organizationId === ORG_ID, 'ไม่พบจุดแผงลอยนี้');
  if (!loc.enabled) throw badRequest('จุดนี้ปิดอยู่ — เปิดจุดก่อนจึงจะเก็บเงินได้');
  const vendor = String(c.body?.vendorName ?? '').trim();
  if (!vendor) throw badRequest('กรุณาระบุชื่อผู้ค้า');
  const row = { id: uid(), organizationId: ORG_ID, locationId: loc.id, vendorName: vendor, collectedOn: /^\d{4}-\d{2}-\d{2}$/.test(c.body?.collectedOn) ? c.body.collectedOn : ymd(new Date()), amount: String(Number(c.body?.amount) || Number(loc.rentRate)), receiptNo: nextReceipt(c, 'MK'), createdAt: nowIso() };
  c.db.marketOutsideCollections.push(row);
  return row;
});
del('/market/outside/collections/:id', (c) => {
  needPerm(c, 'market:manage:MarketBill');
  const r = c.db.marketOutsideCollections.find((x) => x.id === c.params.id && x.organizationId === ORG_ID);
  if (!r) throw notFound('ไม่พบรายการนี้');
  c.db.marketOutsideCollections = c.db.marketOutsideCollections.filter((x) => x !== r);
  return { ok: true };
});

// ───────────────────────────── ค่าเก็บขยะบ้าน: ค้นหา/บิล
const normalize = (s: string) => s.replace(/[๐-๙]/g, (d) => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(d))).replace(/\s+/g, ' ').trim();
function parseHouse(raw: string) {
  const text = normalize(raw);
  const digits = text.replace(/[\s-]/g, '');
  const moo = text.match(/(?:หมู่(?:ที่)?|ม\.)\s*(\d+)/);
  const rest = (moo ? text.replace(moo[0], ' ') : text).trim();
  const house = rest.match(/^(?:บ้านเลขที่|เลขที่)?\s*(\d+(?:\/\d+)?)$/);
  return { text, digits, moo: moo ? String(Number(moo[1])) : null, house: house?.[1] ?? null };
}
function wasteMatches(b: Row, raw: string): boolean {
  const p = parseHouse(raw ?? '');
  if (!p.text) return true;
  if (/^0\d{8,9}$/.test(p.digits)) return b.phone === p.digits;
  if (p.house || p.moo) return !!p.house && b.houseNo === p.house && (!p.moo || b.moo === p.moo);
  const t = p.text.toLowerCase();
  return b.holderName.toLowerCase().includes(t) || b.householdRef.toLowerCase().includes(t);
}
get('/waste/bills', (c) => {
  absorbPayments(c.db);
  needPerm(c, 'waste:read:WasteBill');
  const { q, status, period: per } = c.query;
  return c.db.wasteBills
    .filter((b) => b.organizationId === ORG_ID && (!status || b.status === status) && (!per || b.period === per) && wasteMatches(b, q ?? ''))
    .sort((a, b) => b.period.localeCompare(a.period) || a.houseNo.localeCompare(b.houseNo)).slice(0, 200);
});
post('/waste/bills', (c) => {
  needPerm(c, 'waste:manage:WasteBill');
  const ref = String(c.body?.householdRef ?? '').trim().toUpperCase();
  const per = String(c.body?.period ?? '');
  const amount = Number(c.body?.amount);
  if (!isPeriod(per)) throw badRequest('งวดต้องเป็นรูปแบบ พ.ศ.-เดือน เช่น 2569-10');
  if (!(amount > 0)) throw badRequest('ยอดต้องมากกว่า 0');
  const hh = c.db.wasteHouseholds.find((h) => h.householdRef === ref && h.active);
  if (!hh) throw notFound('ไม่พบครัวเรือนนี้ในทะเบียน');
  if (c.db.wasteBills.some((b) => b.householdRef === ref && b.period === per)) throw badRequest('ครัวเรือนนี้มีบิลงวดนี้อยู่แล้ว');
  const row = wasteBillOf(hh, per, String(amount));
  c.db.wasteBills.push(row);
  return row;
});
del('/waste/bills/:id', (c) => {
  needPerm(c, 'waste:manage:WasteBill');
  const b = byIdOrThrow(c.db.wasteBills, c.params.id, 'ไม่พบบิลค่าขยะนี้');
  if (b.status === 'paid') throw badRequest('บิลนี้ชำระแล้ว ลบไม่ได้');
  c.db.wasteBills = c.db.wasteBills.filter((x) => x !== b);
  return { ok: true };
});
post('/waste/bills/generate', (c) => {
  needPerm(c, 'waste:manage:WasteBill');
  const per = String(c.body?.period || period());
  if (!isPeriod(per)) throw badRequest('งวดต้องเป็นรูปแบบ พ.ศ.-เดือน เช่น 2569-10');
  const hhs = c.db.wasteHouseholds.filter((h) => h.active);
  if (!hhs.length) throw badRequest('ยังไม่มีครัวเรือนในทะเบียน — เพิ่มหรือนำเข้าครัวเรือนก่อน');
  const have = new Set(c.db.wasteBills.filter((b) => b.period === per).map((b) => b.householdRef));
  let created = 0, noFee = 0;
  for (const h of hhs) {
    if (have.has(h.householdRef)) continue;
    const fee = h.monthlyFee != null ? Number(h.monthlyFee) : Number(cfg(c).householdFee);
    if (fee <= 0) { noFee++; continue; }
    c.db.wasteBills.push(wasteBillOf(h, per, String(fee)));
    created++;
  }
  if (!created && noFee === hhs.length) throw badRequest('ยังไม่ได้ตั้งค่าเก็บขยะบ้านต่อเดือน (ที่แท็บตั้งค่า)');
  return { period: per, created, skipped: hhs.length - created - noFee, noFee };
});
function wasteBillOf(h: Row, per: string, amount: string): Row {
  return { id: uid(), organizationId: ORG_ID, householdRef: h.householdRef, holderName: h.holderName, houseNo: h.houseNo, moo: h.moo, phone: h.phone, period: per, amount, status: 'unpaid', dueDate: periodEnd(per), paidMethod: null, paidAt: null, receiptNo: null, submittedMethod: null, submittedAt: null, slipUrl: null, reviewNote: null };
}
post('/waste/bills/:id/pay', (c) => { needPerm(c, 'waste:manage:WasteBill'); return payBill(c, c.db.wasteBills, 'WS', 'ไม่พบบิลค่าขยะนี้'); });
post('/waste/bills/:id/reject', (c) => { needPerm(c, 'waste:manage:WasteBill'); return rejectBill(c, c.db.wasteBills, 'ไม่พบบิลค่าขยะนี้', 'mismatch'); });
get('/waste/summary', (c) => {
  absorbPayments(c.db);
  needPerm(c, 'waste:read:WasteBill');
  const per = c.query.period || null;
  const bills = c.db.wasteBills.filter((b) => b.organizationId === ORG_ID && (!per || b.period === per));
  const byStatus = [...new Set(bills.map((b) => b.status))].map((status) => {
    const rows = bills.filter((b) => b.status === status);
    return { status, count: rows.length, total: rows.reduce((s, b) => s + Number(b.amount), 0) };
  });
  const unpaid = bills.filter((b) => b.status !== 'paid');
  return {
    period: per, householdCount: c.db.wasteHouseholds.filter((h) => h.active).length, byStatus,
    unpaidCount: unpaid.length, unpaidTotal: unpaid.reduce((s, b) => s + Number(b.amount), 0),
  };
});
get('/waste/arrears', (c) => {
  needPerm(c, 'waste:read:WasteBill');
  const per = c.query.period || null;
  const open = c.db.wasteBills.filter((b) => b.organizationId === ORG_ID && b.status !== 'paid' && (!per || b.period === per));
  const refs = [...new Set(open.map((b) => b.householdRef))];
  return refs.map((ref) => {
    const rows = open.filter((b) => b.householdRef === ref);
    const first = rows[0];
    return { householdRef: ref, holderName: first.holderName, houseNo: first.houseNo, moo: first.moo, phone: first.phone, months: new Set(rows.map((b) => b.period)).size, oldest: rows.map((b) => b.period).sort()[0], total: rows.reduce((s, b) => s + Number(b.amount), 0) };
  }).sort((a, b) => b.total - a.total || a.householdRef.localeCompare(b.householdRef)).slice(0, 500);
});

// ───────────────────────────── ทะเบียนครัวเรือน
function householdsOf(c: Ctx, qRaw?: string) {
  const p = parseHouse(qRaw ?? '');
  const base = (h: Row) => h.organizationId === ORG_ID && h.active;
  let rows: Row[];
  if (!p.text) rows = c.db.wasteHouseholds.filter(base);
  else if (/^0\d{8,9}$/.test(p.digits)) rows = c.db.wasteHouseholds.filter((h) => base(h) && h.phone === p.digits);
  else if (p.moo && !p.house) rows = c.db.wasteHouseholds.filter((h) => base(h) && h.moo === p.moo);
  else if (p.house) rows = c.db.wasteHouseholds.filter((h) => base(h) && h.houseNo === p.house && (!p.moo || h.moo === p.moo));
  else { const t = p.text.toLowerCase(); rows = c.db.wasteHouseholds.filter((h) => base(h) && (h.holderName.toLowerCase().includes(t) || h.householdRef.toLowerCase().includes(t))); }
  return rows.sort((a, b) => Number(a.moo) - Number(b.moo) || a.houseNo.localeCompare(b.houseNo)).slice(0, 500).map((h) => {
    const owed = c.db.wasteBills.filter((b) => b.householdRef === h.householdRef && b.status !== 'paid');
    return { ...h, owedMonths: owed.length, owedTotal: owed.reduce((s, b) => s + Number(b.amount), 0) };
  });
}
get('/waste/households', (c) => { needPerm(c, 'waste:read:WasteBill'); return householdsOf(c, c.query.q); });

function nextHouseRef(c: Ctx): string {
  const n = c.db.wasteHouseholds.reduce((m, h) => { const x = /^HH-(\d+)$/.exec(h.householdRef); return x ? Math.max(m, Number(x[1])) : m; }, 0);
  return `HH-${String(n + 1).padStart(3, '0')}`;
}
function assertHouseFree(c: Ctx, houseNo: string, moo: string, exceptId?: string) {
  const dup = c.db.wasteHouseholds.find((h) => h.active && h.houseNo === houseNo && h.moo === moo && h.id !== exceptId);
  if (dup) throw badRequest(`บ้านเลขที่ ${houseNo} หมู่ ${moo} มีในทะเบียนแล้ว (${dup.householdRef})`);
}
function householdFields(b: Row, base?: Row) {
  const name = b.holderName !== undefined ? String(b.holderName ?? '').trim() : base?.holderName;
  const houseNo = b.houseNo !== undefined ? String(b.houseNo ?? '').trim() : base?.houseNo;
  const moo = b.moo !== undefined ? String(Number(b.moo)) : base?.moo;
  const phone = b.phone !== undefined ? (String(b.phone ?? '').replace(/[\s-]/g, '') || null) : (base?.phone ?? null);
  const fee = b.monthlyFee !== undefined ? (b.monthlyFee == null || b.monthlyFee === '' ? null : String(Number(b.monthlyFee))) : (base?.monthlyFee ?? null);
  return { name, houseNo, moo, phone, fee };
}
post('/waste/households', (c) => {
  needPerm(c, 'waste:manage:WasteBill');
  const f = householdFields(c.body ?? {});
  if (!f.name || !f.houseNo || !f.moo || f.moo === 'NaN') throw badRequest('กรุณากรอกชื่อ บ้านเลขที่ และหมู่');
  if (!/^\d{1,5}(\/\d{1,4})?$/.test(f.houseNo)) throw badRequest('บ้านเลขที่ใช้ตัวเลข เช่น 18 หรือ 12/3');
  if (f.phone && !/^0\d{8,9}$/.test(f.phone)) throw badRequest('เบอร์โทรไม่ถูกต้อง');
  assertHouseFree(c, f.houseNo, f.moo);
  const row = { id: uid(), organizationId: ORG_ID, householdRef: nextHouseRef(c), holderName: f.name, houseNo: f.houseNo, moo: f.moo, phone: f.phone, monthlyFee: f.fee, active: true, createdAt: nowIso() };
  c.db.wasteHouseholds.push(row);
  return row;
});
post('/waste/households/import', (c) => {
  needPerm(c, 'waste:manage:WasteBill');
  const rows: Row[] = Array.isArray(c.body?.rows) ? c.body.rows : [];
  if (rows.length > 2000) throw badRequest('นำเข้าได้ครั้งละไม่เกิน 2,000 แถว');
  let created = 0, updated = 0;
  const errors: { row: number; message: string }[] = [];
  rows.forEach((r, i) => {
    const f = householdFields(r);
    if (!f.name || !f.houseNo || !f.moo || f.moo === 'NaN') { errors.push({ row: i + 1, message: 'ต้องมีชื่อ บ้านเลขที่ และหมู่' }); return; }
    const ex = c.db.wasteHouseholds.find((h) => h.active && h.houseNo === f.houseNo && h.moo === f.moo);
    if (ex) {
      ex.holderName = f.name;
      if (f.phone) ex.phone = f.phone;
      if (r.monthlyFee != null) ex.monthlyFee = f.fee;
      updated++;
    } else {
      c.db.wasteHouseholds.push({ id: uid(), organizationId: ORG_ID, householdRef: nextHouseRef(c), holderName: f.name, houseNo: f.houseNo, moo: f.moo, phone: f.phone, monthlyFee: f.fee, active: true, createdAt: nowIso() });
      created++;
    }
  });
  return { created, updated, errors };
});
patch('/waste/households/:id', (c) => {
  needPerm(c, 'waste:manage:WasteBill');
  const h = one(c.db.wasteHouseholds, (x) => x.id === c.params.id && x.active && x.organizationId === ORG_ID, 'ไม่พบครัวเรือนนี้');
  const f = householdFields(c.body ?? {}, h);
  if (!f.name) throw badRequest('ชื่อต้องไม่ว่าง');
  if (f.houseNo !== h.houseNo || f.moo !== h.moo) assertHouseFree(c, f.houseNo, f.moo, h.id);
  Object.assign(h, { holderName: f.name, houseNo: f.houseNo, moo: f.moo, phone: f.phone, monthlyFee: f.fee });
  return h;
});
del('/waste/households/:id', (c) => {
  needPerm(c, 'waste:manage:WasteBill');
  const h = one(c.db.wasteHouseholds, (x) => x.id === c.params.id && x.active && x.organizationId === ORG_ID, 'ไม่พบครัวเรือนนี้');
  const open = c.db.wasteBills.filter((b) => b.householdRef === h.householdRef && OPEN.includes(b.status)).length;
  if (open) throw badRequest(`ครัวเรือน ${h.householdRef} ยังมีบิลค้าง ${open} รายการ — เก็บเงินหรือยกเลิกบิลก่อนลบ`);
  h.active = false;
  return { ok: true };
});
