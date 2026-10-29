/** ค่าแผงตลาด + ค่าเก็บขยะบ้าน (ข้อมูลสมมติ ตรงกับ seed-market-waste ของ backend) */
import { get, post, patch, registerSeed, uid, nowIso, byId, badRequest, type Ctx, type Row } from '../core';
import { ORG_ID } from '../seed-base';
import { needPerm } from './base';

const period = (offset = 0) => {
  const d = new Date(); d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear() + 543}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const ROWS = [{ zone: 'A', rate: 1200 }, { zone: 'B', rate: 900 }, { zone: 'C', rate: 1500 }, { zone: 'D', rate: 1200 }, { zone: 'E', rate: 1050 }];
const WASTE_STALL_FEE = 30;
const TENANT: Record<string, string> = {
  A01: 'นางสาวศิริพร ทองดี', A02: 'นายประเสริฐ ศรีสุข', A03: 'นางอำไพ บุญรอด', A05: 'นายบุญมี คำไหล', A06: 'นางสมใจ ใจดี',
  A08: 'นางสาวกัญญา พิมพ์ดี', B02: 'นายวิทยา แซ่ลี้', B04: 'นางมะลิ แสงทอง', B07: 'นายสมชาย ไทยเจริญ', C03: 'นายวิชัย ผักสด',
  C06: 'นางพัชรี ขำดี', D01: 'นางจันทร์เพ็ญ สุขใจ', E09: 'นางราตรี ผักสด',
  A04: 'นายธนพล วงศ์ษา', B05: 'นางสาวนภัส ใจงาม', C08: 'นายอนันต์ ทองสุข', D07: 'นางสาวปิยนุช รักงาม', E04: 'นางสาวอรทัย ศรีงาม',
};
const OCCUPIED = ['A01', 'A02', 'A03', 'A05', 'A06', 'A08', 'B02', 'B04', 'B07', 'C03', 'C06', 'D01', 'E09'];
const RESERVED = ['A04', 'B05', 'C08', 'D07', 'E04'];
const PAID = new Set(['A01', 'D01', 'B02']);
const PENDING_RENT = new Set(['B04', 'B05']);
const MISMATCH_RENT = new Set(['C03']);
const ARREARS: [string, number][] = [['A06', -2], ['A06', -1], ['B07', -2], ['B07', -1]];
const HOUSEHOLDS = [
  { ref: 'HH-014', name: 'สมชาย ใจบุญ', houseNo: '18', moo: '2', phone: '0810000014' },
  { ref: 'HH-021', name: 'สมใจ ใจดี', houseNo: '7', moo: '3', phone: '0810000021' },
  { ref: 'HH-030', name: 'มะลิ แสงทอง', houseNo: '18', moo: '5', phone: '0810000030' },
  { ref: 'HH-042', name: 'ประยูร ทองดี', houseNo: '12/3', moo: '2', phone: '0810000042' },
];

registerSeed((db) => {
  const P = period();
  db.marketStalls = ROWS.flatMap((row) => Array.from({ length: 10 }, (_, i) => {
    const code = `${row.zone}${String(i + 1).padStart(2, '0')}`;
    const status = OCCUPIED.includes(code) ? 'occupied' : RESERVED.includes(code) ? 'reserved' : 'available';
    return { id: `stall-${code}`, organizationId: ORG_ID, stallCode: code, zone: row.zone, status, active: true, tenantName: status === 'available' ? null : TENANT[code] ?? null, monthlyRate: String(row.rate) };
  }));
  const rate = (code: string) => db.marketStalls.find((s) => s.stallCode === code)!.monthlyRate;
  const bill = (code: string, kind: string, per: string, amount: string, status: string) => ({
    id: uid(), organizationId: ORG_ID, stallId: `stall-${code}`, stallCode: code, payerName: TENANT[code], kind, period: per, amount, status,
    paidMethod: status === 'paid' ? 'cash' : null, paidAt: status === 'paid' ? nowIso() : null, receiptNo: status === 'paid' ? `MK-${per}-SEED${code}${kind === 'waste' ? 'W' : ''}` : null,
  });
  db.marketBills = [
    ...[...OCCUPIED, ...RESERVED].flatMap((code) => [
      bill(code, 'rent', P, rate(code), PAID.has(code) ? 'paid' : PENDING_RENT.has(code) ? 'pending' : MISMATCH_RENT.has(code) ? 'mismatch' : 'unpaid'),
      bill(code, 'waste', P, String(WASTE_STALL_FEE), PAID.has(code) ? 'paid' : 'unpaid'),
    ]),
    ...ARREARS.map(([code, off]) => bill(code, 'rent', period(off), rate(code), 'unpaid')),
  ];
  db.wasteBills = HOUSEHOLDS.flatMap((h) => [period(-1), P].map((per) => ({
    id: uid(), organizationId: ORG_ID, householdRef: h.ref, holderName: h.name, houseNo: h.houseNo, moo: h.moo, phone: h.phone, period: per, amount: '40', status: 'unpaid',
    paidMethod: null, paidAt: null, receiptNo: null,
  })));
});

const receiptNo = (prefix: string, per: string) => `${prefix}-${per}-${Date.now().toString(36).toUpperCase()}`;
const METHODS = ['cash', 'qr', 'transfer'];

// ───── ค่าแผงตลาด ─────
get('/market/stalls', (c) => { needPerm(c, 'market:read:MarketStall'); return c.db.marketStalls.filter((s) => s.active).sort((a, b) => a.stallCode.localeCompare(b.stallCode)); });
patch('/market/stalls/:id', (c) => {
  needPerm(c, 'market:manage:MarketStall');
  const s = byId(c.db.marketStalls, c.params.id);
  const b = c.body ?? {};
  if (b.status !== undefined) s.status = b.status;
  if (b.tenantName !== undefined) s.tenantName = b.tenantName || null;
  if (b.monthlyRate !== undefined) s.monthlyRate = String(b.monthlyRate);
  if (s.status === 'available') s.tenantName = null;
  return s;
});
get('/market/bills', (c) => {
  needPerm(c, 'market:read:MarketBill');
  const { status, period: per, stallCode } = c.query;
  return c.db.marketBills
    .filter((b) => (!status || b.status === status) && (!per || b.period === per) && (!stallCode || b.stallCode === stallCode))
    .sort((a, b) => b.period.localeCompare(a.period) || a.stallCode.localeCompare(b.stallCode) || a.kind.localeCompare(b.kind)).slice(0, 500);
});
post('/market/bills/:id/pay', (c) => payBill(c, c.db.marketBills, 'MK', 'ไม่พบบิลค่าแผงนี้', 'market:manage:MarketBill'));

// ───── ค่าเก็บขยะบ้าน ─────
const normalize = (s: string) => s.replace(/[๐-๙]/g, (d) => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(d))).replace(/\s+/g, ' ').trim();
function wasteMatches(b: Row, raw: string): boolean {
  const text = normalize(raw);
  if (!text) return true;
  const digits = text.replace(/[\s-]/g, '');
  if (/^0\d{8,9}$/.test(digits)) return b.phone === digits;
  const moo = text.match(/(?:หมู่(?:ที่)?|ม\.)\s*(\d+)/);
  const rest = (moo ? text.replace(moo[0], ' ') : text).trim();
  const house = rest.match(/^(?:บ้านเลขที่|เลขที่)?\s*(\d+(?:\/\d+)?)$/);
  if (house || moo) return !!house && b.houseNo === house[1] && (!moo || b.moo === String(Number(moo[1])));
  const t = text.toLowerCase();
  return b.holderName.toLowerCase().includes(t) || b.householdRef.toLowerCase().includes(t);
}
get('/waste/bills', (c) => {
  needPerm(c, 'waste:read:WasteBill');
  const { q, status, period: per } = c.query;
  return c.db.wasteBills
    .filter((b) => (!status || b.status === status) && (!per || b.period === per) && wasteMatches(b, q ?? ''))
    .sort((a, b) => b.period.localeCompare(a.period) || a.houseNo.localeCompare(b.houseNo)).slice(0, 200);
});
get('/waste/summary', (c) => {
  needPerm(c, 'waste:read:WasteBill');
  const unpaid = c.db.wasteBills.filter((b) => b.status === 'unpaid');
  return { unpaidCount: unpaid.length, unpaidTotal: unpaid.reduce((s, b) => s + Number(b.amount), 0) };
});
post('/waste/bills/:id/pay', (c) => payBill(c, c.db.wasteBills, 'WS', 'ไม่พบบิลค่าขยะนี้', 'waste:manage:WasteBill'));

function payBill(c: Ctx, list: Row[], prefix: string, notFoundMsg: string, perm: string) {
  needPerm(c, perm);
  const bill = list.find((b) => b.id === c.params.id);
  if (!bill) throw badRequest(notFoundMsg);
  if (bill.status === 'paid') throw badRequest('บิลนี้ชำระแล้ว');
  const method = METHODS.includes(c.body?.method) ? c.body.method : 'cash';
  Object.assign(bill, { status: 'paid', paidMethod: method, paidAt: nowIso(), receiptNo: receiptNo(prefix, bill.period) });
  return bill;
}
