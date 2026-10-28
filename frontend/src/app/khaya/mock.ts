/**
 * ข้อมูลจำลอง (mock) สำหรับ demo ระบบจัดเก็บค่าธรรมเนียมขยะมูลฝอย /khaya
 * — ไม่มี backend/DB ทุกอย่างสร้างในไฟล์นี้แบบ deterministic (seed คงที่)
 *   เพื่อให้ค่าตรงกันทั้ง SSR/CSR (กัน hydration mismatch) และรีเฟรชแล้วไม่เพี้ยน
 * ค่าธรรมเนียมอิงของจริง อบต.: เก็บรายเดือนตามประเภทผู้ใช้บริการ (บ้าน/ร้านค้า/ตลาด/โรงงาน)
 */

// ── ประเภทผู้ใช้บริการ + อัตราค่าธรรมเนียม (บาท/เดือน) ──────────────────────
export type KType =
  | 'บ้านพักอาศัย'
  | 'ร้านค้าย่อย'
  | 'ร้านอาหาร'
  | 'ตลาด/แผงลอย'
  | 'โรงงาน/สถานประกอบการ';

export const KTYPES: KType[] = [
  'บ้านพักอาศัย', 'ร้านค้าย่อย', 'ร้านอาหาร', 'ตลาด/แผงลอย', 'โรงงาน/สถานประกอบการ',
];

export const RATE: Record<KType, number> = {
  'บ้านพักอาศัย': 20,
  'ร้านค้าย่อย': 40,
  'ร้านอาหาร': 60,
  'ตลาด/แผงลอย': 100,
  'โรงงาน/สถานประกอบการ': 150,
};

/** โทนสี badge ต่อประเภท (Tailwind) */
export const TYPE_TONE: Record<KType, string> = {
  'บ้านพักอาศัย': 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  'ร้านค้าย่อย': 'bg-amber-50 text-amber-700 ring-amber-200',
  'ร้านอาหาร': 'bg-orange-50 text-orange-700 ring-orange-200',
  'ตลาด/แผงลอย': 'bg-violet-50 text-violet-700 ring-violet-200',
  'โรงงาน/สถานประกอบการ': 'bg-rose-50 text-rose-700 ring-rose-200',
};

// ── งวดปัจจุบันของ demo ────────────────────────────────────────────────────
export const CURRENT = { year: 2569, month: 8 }; // สิงหาคม 2569
export const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];
export const thMonth = (m: number) => THAI_MONTHS[m - 1] || '';
export const fmtMoney = (n: number) =>
  n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── ตารางเก็บขยะรายหมู่ (garbage-specific) ─────────────────────────────────
export type Route = { moo: number; name: string; days: string; truck: string; staff: string };
export const ROUTES: Route[] = [
  { moo: 1, name: 'บ้านลำนางรอง',   days: 'จันทร์ · พฤหัสบดี', truck: 'บษ-1023', staff: 'นายสมพงษ์ ทองมา' },
  { moo: 2, name: 'บ้านหนองโบสถ์',  days: 'อังคาร · ศุกร์',    truck: 'บษ-1023', staff: 'นายสมพงษ์ ทองมา' },
  { moo: 3, name: 'บ้านโคกเมือง',   days: 'พุธ · เสาร์',       truck: 'บษ-1188', staff: 'นายบุญส่ง ศรีสุข' },
  { moo: 4, name: 'บ้านหนองม่วง',   days: 'จันทร์ · พฤหัสบดี', truck: 'บษ-1188', staff: 'นายบุญส่ง ศรีสุข' },
  { moo: 5, name: 'บ้านโนนสมบูรณ์', days: 'อังคาร · ศุกร์',    truck: 'บษ-1188', staff: 'นายบุญส่ง ศรีสุข' },
  { moo: 6, name: 'บ้านสี่เหลี่ยม',  days: 'พุธ · เสาร์',       truck: 'บษ-1023', staff: 'นายสมพงษ์ ทองมา' },
];
export const mooName = (m: number) => ROUTES.find((r) => r.moo === m)?.name || `หมู่ ${m}`;

// ── seed PRNG (mulberry32) ให้ข้อมูลคงที่ ─────────────────────────────────
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MALE_FIRST = [
  'สมชาย', 'วิเชียร', 'สุนทร', 'ถวิล', 'สมบัติ', 'ประเสริฐ', 'นิคม', 'เฉลิม',
  'อำนวย', 'บุญมี', 'ทองใบ', 'สมพร', 'บุญเรือน', 'จำเนียร', 'สมหมาย', 'ประยูร',
];
const FEMALE_FIRST = [
  'สมหญิง', 'ประไพ', 'ลำดวน', 'พเยาว์', 'บังอร', 'กาญจนา', 'วันเพ็ญ', 'สุพรรณ',
  'ระเบียบ', 'สายทอง', 'บัวลา', 'มะลิ', 'ทองพูน', 'ประทุม', 'สมคิด', 'บุญมา',
];
const LAST = [
  'ใจดี', 'ศรีสุข', 'ทองมา', 'พันธุ์ดี', 'สุขสันต์', 'มั่นคง', 'วงศ์ษา', 'แก้วมณี',
  'บุญมาก', 'เพชรรัตน์', 'อินทร์งาม', 'สมบูรณ์', 'คำแก้ว', 'ยอดรัก', 'ดวงจันทร์', 'รุ่งเรือง',
];
// ประเภทแบบถ่วงน้ำหนัก (บ้านเยอะสุด โรงงานน้อยสุด)
const TYPE_BAG: KType[] = [
  ...Array(12).fill('บ้านพักอาศัย'),
  ...Array(4).fill('ร้านค้าย่อย'),
  ...Array(2).fill('ร้านอาหาร'),
  ...Array(1).fill('ตลาด/แผงลอย'),
  ...Array(1).fill('โรงงาน/สถานประกอบการ'),
] as KType[];

export type Household = {
  id: string;
  code: string;       // เลขทะเบียนผู้ใช้บริการ
  name: string;
  type: KType;
  moo: number;
  address: string;    // บ้านเลขที่
  phone: string;      // '' = ยังไม่มี
  active: boolean;
  rate: number;       // ค่าธรรมเนียม/เดือน (จาก RATE)
  since: number;      // ปี พ.ศ. ที่เริ่มใช้บริการ
};

export type Bill = {
  id: string;
  householdId: string;
  code: string;
  year: number;
  month: number;
  amount: number;
  paid: boolean;
  paidAt: string;      // 'DD/MM' หรือ ''
  receiptNo: string;   // '' ถ้ายังไม่จ่าย
  method: 'เงินสด' | 'โอน' | '';
};

// ── สร้างชุดข้อมูล ─────────────────────────────────────────────────────────
function build() {
  const rng = mulberry32(20690824);
  const households: Household[] = [];
  const bills: Bill[] = [];
  let seq = 1;
  let receiptSeq = 6800;

  // 5 งวดย้อนหลังถึงงวดปัจจุบัน (เม.ย.–ส.ค. 2569)
  const PERIODS = [4, 5, 6, 7, 8].map((m) => ({ year: 2569, month: m }));

  for (const r of ROUTES) {
    const n = 6 + Math.floor(rng() * 4); // 6–9 หลังต่อหมู่
    for (let i = 0; i < n; i++) {
      const code = String(seq).padStart(4, '0');
      const id = `H${code}`;
      const type = TYPE_BAG[Math.floor(rng() * TYPE_BAG.length)];
      const male = rng() < 0.5;
      const first = male ? MALE_FIRST[Math.floor(rng() * MALE_FIRST.length)] : FEMALE_FIRST[Math.floor(rng() * FEMALE_FIRST.length)];
      const name = `${male ? 'นาย' : 'นาง'}${first} ${LAST[Math.floor(rng() * LAST.length)]}`;
      const hasPhone = rng() < 0.45;
      const phone = hasPhone ? '08' + String(10000000 + Math.floor(rng() * 89999999)) : '';
      const rate = RATE[type];
      const reliability = 0.55 + rng() * 0.45; // แนวโน้มจ่ายตรง
      households.push({
        id, code, name, type, moo: r.moo,
        address: `${Math.floor(rng() * 240) + 1}`,
        phone, active: rng() > 0.04, rate,
        since: 2560 + Math.floor(rng() * 9),
      });

      // ออกบิลทุกงวด
      for (const p of PERIODS) {
        const isCurrent = p.month === CURRENT.month;
        // งวดปัจจุบันเพิ่งออก → จ่ายไปแล้วบางส่วน; งวดเก่า → จ่ายตามความน่าเชื่อถือ
        const payChance = isCurrent ? 0.35 : reliability;
        const paid = rng() < payChance;
        const rno = paid ? String(receiptSeq++) : '';
        bills.push({
          id: `B${code}-${p.year}${String(p.month).padStart(2, '0')}`,
          householdId: id, code,
          year: p.year, month: p.month, amount: rate, paid,
          paidAt: paid ? `${String(Math.floor(rng() * 27) + 1).padStart(2, '0')}/${String(p.month).padStart(2, '0')}` : '',
          receiptNo: rno,
          method: paid ? (rng() < 0.7 ? 'เงินสด' : 'โอน') : '',
        });
      }
      seq++;
    }
  }
  return { households, bills };
}

const DATA = build(); // v2: แยก pool ชื่อชาย/หญิงให้ตรงคำนำหน้า
export const households = DATA.households;
export const bills = DATA.bills;

// ── helper คิวรี ───────────────────────────────────────────────────────────
export const findHousehold = (id: string) => households.find((h) => h.id === id);
export const householdByCode = (code: string) => households.find((h) => h.code === code);
export const billsOf = (householdId: string) =>
  bills.filter((b) => b.householdId === householdId).sort((a, b) => a.year - b.year || a.month - b.month);
export const periodBills = (year: number, month: number) =>
  bills.filter((b) => b.year === year && b.month === month);
export const unpaidBills = (householdId: string) =>
  billsOf(householdId).filter((b) => !b.paid);

/** ยอดค้างสะสม (ทุกงวด) ต่อครัวเรือน */
export const arrearsOf = (householdId: string) =>
  unpaidBills(householdId).reduce((s, b) => s + b.amount, 0);

/** สรุปงวด */
export function periodSummary(year: number, month: number) {
  const pb = periodBills(year, month);
  const billed = pb.length;
  const paid = pb.filter((b) => b.paid);
  const collected = paid.reduce((s, b) => s + b.amount, 0);
  const target = pb.reduce((s, b) => s + b.amount, 0);
  const unpaid = billed - paid.length;
  const outstanding = target - collected;
  return { billed, paidCount: paid.length, collected, target, unpaid, outstanding, rate: target ? collected / target : 0 };
}

/** สรุปแยกหมู่สำหรับงวด */
export function summaryByMoo(year: number, month: number) {
  return ROUTES.map((r) => {
    const pb = periodBills(year, month).filter((b) => findHousehold(b.householdId)?.moo === r.moo);
    const paid = pb.filter((b) => b.paid);
    return {
      moo: r.moo, name: r.name,
      count: pb.length,
      paidCount: paid.length,
      collected: paid.reduce((s, b) => s + b.amount, 0),
      target: pb.reduce((s, b) => s + b.amount, 0),
    };
  });
}

/** สรุปแยกประเภทสำหรับงวด */
export function summaryByType(year: number, month: number) {
  return KTYPES.map((t) => {
    const pb = periodBills(year, month).filter((b) => findHousehold(b.householdId)?.type === t);
    const paid = pb.filter((b) => b.paid);
    return {
      type: t, rate: RATE[t],
      count: pb.length,
      paidCount: paid.length,
      collected: paid.reduce((s, b) => s + b.amount, 0),
      target: pb.reduce((s, b) => s + b.amount, 0),
    };
  });
}

/** รายชื่อครัวเรือนที่มียอดค้าง (เรียงมาก→น้อย) */
export function debtors() {
  return households
    .map((h) => ({ h, arrears: arrearsOf(h.id), months: unpaidBills(h.id).length }))
    .filter((x) => x.arrears > 0)
    .sort((a, b) => b.arrears - a.arrears);
}
