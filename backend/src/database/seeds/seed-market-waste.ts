import { DataSource } from 'typeorm';
import { Organization } from '../entities/organization.entity';
import { MarketStall } from '../entities/market-stall.entity';
import { MarketBill } from '../entities/market-bill.entity';
import { WasteBill } from '../entities/waste-bill.entity';

/**
 * ข้อมูลตัวอย่างค่าแผงตลาด + ค่าเก็บขยะบ้าน (สำหรับ dev/เดโม่) — ชื่อสมมติ ไม่ใช่ข้อมูลจริงของ อบต.
 * ข้ามถ้า org นั้นมีผังแผงอยู่แล้ว (idempotent) · ข้อมูลจริงให้นำเข้าจากไฟล์ของ อบต. แทน
 */
const ROWS: { zone: string; rate: number }[] = [
  { zone: 'A', rate: 1200 }, { zone: 'B', rate: 900 }, { zone: 'C', rate: 1500 }, { zone: 'D', rate: 1200 }, { zone: 'E', rate: 1050 },
];
const WASTE_STALL_FEE = 30;
const TENANT: Record<string, string> = {
  A01: 'นางสาวศิริพร ทองดี', A02: 'นายประเสริฐ ศรีสุข', A03: 'นางอำไพ บุญรอด', A05: 'นายบุญมี คำไหล', A06: 'นางสมใจ ใจดี',
  A08: 'นางสาวกัญญา พิมพ์ดี', B02: 'นายวิทยา แซ่ลี้', B04: 'นางมะลิ แสงทอง', B07: 'นายสมชาย ไทยเจริญ', C03: 'นายวิชัย ผักสด',
  C06: 'นางพัชรี ขำดี', D01: 'นางจันทร์เพ็ญ สุขใจ', E09: 'นางราตรี ผักสด',
  A04: 'นายธนพล วงศ์ษา', B05: 'นางสาวนภัส ใจงาม', C08: 'นายอนันต์ ทองสุข', D07: 'นางสาวปิยนุช รักงาม', E04: 'นางสาวอรทัย ศรีงาม',
};
const OCCUPIED = ['A01', 'A02', 'A03', 'A05', 'A06', 'A08', 'B02', 'B04', 'B07', 'C03', 'C06', 'D01', 'E09'];
const RESERVED = ['A04', 'B05', 'C08', 'D07', 'E04'];
/** งวดปัจจุบัน (พ.ศ.-เดือน) ของข้อมูลตัวอย่าง และสถานะบิลตัวอย่าง (ค่าเริ่มต้น unpaid) */
const PERIOD = '2569-10';
const PAID = new Set(['A01', 'D01', 'B02']);
const PENDING_RENT = new Set(['B04', 'B05']);
const MISMATCH_RENT = new Set(['C03']);
/** ค้างย้อนหลัง: แผงที่มีบิลเดือนก่อนค้างอยู่ */
const ARREARS: [string, string][] = [['A06', '2569-08'], ['A06', '2569-09'], ['B07', '2569-08'], ['B07', '2569-09']];

const HOUSEHOLDS = [
  { ref: 'HH-014', name: 'สมชาย ใจบุญ', houseNo: '18', moo: '2', phone: '0810000014' },
  { ref: 'HH-021', name: 'สมใจ ใจดี', houseNo: '7', moo: '3', phone: '0810000021' },
  { ref: 'HH-030', name: 'มะลิ แสงทอง', houseNo: '18', moo: '5', phone: '0810000030' },
  { ref: 'HH-042', name: 'ประยูร ทองดี', houseNo: '12/3', moo: '2', phone: '0810000042' },
];

export async function seedMarketWaste(ds: DataSource): Promise<void> {
  const org = await ds.getRepository(Organization).findOne({ where: {}, order: { createdAt: 'ASC' } });
  if (!org) { console.log('  ไม่มีองค์กร — ข้ามข้อมูลตัวอย่างแผงตลาด/ขยะ'); return; }
  const stallRepo = ds.getRepository(MarketStall);
  const billRepo = ds.getRepository(MarketBill);
  const wasteRepo = ds.getRepository(WasteBill);
  if (await stallRepo.count({ where: { organizationId: org.id } })) { console.log('  มีผังแผงแล้ว — ข้าม'); return; }

  const stalls: MarketStall[] = [];
  for (const row of ROWS) {
    for (let i = 1; i <= 10; i++) {
      const code = `${row.zone}${String(i).padStart(2, '0')}`;
      const status = OCCUPIED.includes(code) ? 'occupied' : RESERVED.includes(code) ? 'reserved' : 'available';
      stalls.push(stallRepo.create({
        organizationId: org.id, stallCode: code, zone: row.zone, status, active: true,
        tenantName: status === 'available' ? null : TENANT[code] ?? null,
        monthlyRate: String(row.rate),
      }));
    }
  }
  await stallRepo.save(stalls);
  const byCode = new Map(stalls.map((s) => [s.stallCode, s]));

  const bills: MarketBill[] = [];
  for (const code of [...OCCUPIED, ...RESERVED]) {
    const s = byCode.get(code)!;
    const name = TENANT[code];
    const rentStatus = PAID.has(code) ? 'paid' : PENDING_RENT.has(code) ? 'pending' : MISMATCH_RENT.has(code) ? 'mismatch' : 'unpaid';
    bills.push(billRepo.create({ organizationId: org.id, stallId: s.id, stallCode: code, payerName: name, kind: 'rent', period: PERIOD, amount: s.monthlyRate, status: rentStatus, ...(rentStatus === 'paid' ? { paidMethod: 'cash', paidAt: new Date(), receiptNo: `MK-${PERIOD}-SEED${code}` } : {}) }));
    bills.push(billRepo.create({ organizationId: org.id, stallId: s.id, stallCode: code, payerName: name, kind: 'waste', period: PERIOD, amount: String(WASTE_STALL_FEE), status: PAID.has(code) ? 'paid' : 'unpaid', ...(PAID.has(code) ? { paidMethod: 'cash', paidAt: new Date(), receiptNo: `MK-${PERIOD}-SEED${code}W` } : {}) }));
  }
  for (const [code, period] of ARREARS) {
    const s = byCode.get(code)!;
    bills.push(billRepo.create({ organizationId: org.id, stallId: s.id, stallCode: code, payerName: TENANT[code], kind: 'rent', period, amount: s.monthlyRate, status: 'unpaid' }));
  }
  await billRepo.save(bills);

  const wastes: WasteBill[] = [];
  for (const h of HOUSEHOLDS) {
    for (const period of ['2569-09', PERIOD]) {
      wastes.push(wasteRepo.create({ organizationId: org.id, householdRef: h.ref, holderName: h.name, houseNo: h.houseNo, moo: h.moo, phone: h.phone, period, amount: '40', status: 'unpaid' }));
    }
  }
  await wasteRepo.save(wastes);
  console.log(`  ผังแผง ${stalls.length} ล็อก · บิลค่าแผง ${bills.length} ใบ · บิลค่าขยะบ้าน ${wastes.length} ใบ`);
}
