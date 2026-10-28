/**
 * แปลงข้อมูลจาก API ระบบประปาเดิม (Prapa On Mobile · /api/v1/cms) → แถวของ water_customers / water_bills_v2
 *
 * ความหมายฟิลด์ยืนยันจากหน้าแก้ไขผู้ใช้น้ำของระบบเดิม (14 ต.ค. 2569):
 *   สมาชิก  M01 รหัส · M02 หมู่ · M03 เส้นทางจัดเก็บ · M04 ชื่อ · M05 บ้านเลขที่ · M06 ที่อยู่ · M07 โทร · M08 บัตรประชาชน
 *          M09 เลขมิเตอร์ล่าสุด · M10 ขนาดมิเตอร์ · M11 ค่าธรรมเนียม · M12 ประเภทผู้ใช้น้ำ (= สูตร/ราคาต่อหน่วย)
 *          M14 วันขอใช้น้ำ (MM/DD/YY) · M15 ค่าขยะ · M16 ค่าบำบัด · M17 วิธีชำระ · M22 ประเภทส่วนลด · M25 ส่วนลด
 *          M26 VAT · M27 เลขประจำมิเตอร์ · M23 สถานะการใช้น้ำ (01 ใช้น้ำ/02 ยกเลิก-มีหนี้/03 ยกเลิก) · M24 วันยกเลิก/งดจ่ายน้ำ
 *          meter_size = หลักหน้ามาตร · remark = หมายเหตุ · location = พิกัด
 *   บิล    B01 รอบ ("69-011" = ปีงบ 69 รอบ 11) · B03 รหัสผู้ใช้น้ำ · B17/B18 วัน/เลขจดก่อน · B19/B20 วัน/เลขจดหลัง · B21 หน่วย
 *          B22 เลขบิล · B23 คนจด · B09 คนรับเงิน · B10 '1' = ชำระแล้ว · B24 วันรับชำระ
 *          BA11 ค่าน้ำ · BA12 ค่าบริการ · BA13 ค่าบำบัด · BA14 ภาษี · BA15 ค่าขยะ
 *
 * ⚠️ import-prapa-legacy.ts (นำเข้าครั้งแรก) แม็ปบางฟิลด์ไว้ผิด: เส้นทาง←M23 · สถานะ←M32 · วันตัดน้ำ←cutOffDate — ตัวนี้แก้แล้ว
 */

export const num = (v: any) => { const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; };
export const intOr = (v: any, d: any = null) => { const n = parseInt(String(v ?? '').replace(/[^0-9\-]/g, ''), 10); return isNaN(n) ? d : n; };
/** ค่าว่างของระบบเดิมมาได้หลายแบบ ('-', 'NaN', '') → null */
const clean = (v: any, max: number) => {
  const s = String(v ?? '').trim();
  return !s || /^(nan|-|null|undefined)$/i.test(s) ? null : s.slice(0, max);
};

/** วันที่ในบิลเป็น DD/MM/YYYY HH:MM:SS เวลา UTC (ตรงกับ edited[].at ที่เป็น ISO) */
export function parseDMY(s: any): Date | null {
  const m = String(s || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}):(\d{2}))?/);
  if (!m) return null;
  return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)));
}
/** วันที่ของสมาชิก (M14/M24) เป็น MM/DD/YY หรือ ISO */
export function parseMDY(s: any): Date | null {
  const str = String(s || '');
  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) { const d = new Date(str); return isNaN(+d) ? null : d; }
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return null;
  let mm = +m[1]; let dd = +m[2]; let yy = +m[3];
  if (yy < 100) yy += 2000;
  if (mm > 12 && dd <= 12) [mm, dd] = [dd, mm];
  return new Date(Date.UTC(yy, mm - 1, dd));
}
const parseAny = (s: any) => parseDMY(s) || (/^\d{4}-\d{2}-\d{2}T/.test(String(s || '')) ? new Date(s) : null);
export const iso = (d: Date | null) => (d && !isNaN(+d) ? d.toISOString() : null);
export const dateOnly = (d: Date | null) => (d && !isNaN(+d) ? d.toISOString().slice(0, 10) : null);

/** รอบบิล "69-011" → เดือน/ปีปฏิทิน พ.ศ. (ปีงบเริ่ม ต.ค.: รอบ 1 = ต.ค. ของปีก่อน … รอบ 12 = ก.ย.) */
export function roundToPeriod(round: string): { year: number; month: number } | null {
  const m = String(round || '').match(/^(\d+)-(\d+)$/);
  if (!m) return null;
  const fy = 2500 + Number(m[1]);
  const month = ((Number(m[2]) + 8) % 12) + 1;
  return { year: month >= 10 ? fy - 1 : fy, month };
}

/** คอลัมน์ water_customers ที่ยึดตามระบบเดิม (ไม่รวม access_token / walk_order ที่เป็นของระบบเรา) */
export const CUSTOMER_COLS = [
  'customer_code', 'full_name', 'village_no', 'national_id', 'phone', 'address', 'soi', 'road',
  'meter_last_reading', 'meter_size_code', 'meter_digits', 'meter_serial', 'unit_price', 'fee_rate', 'rate_type',
  'collection_route', 'apply_date', 'garbage_fee', 'wastewater_fee', 'pay_method', 'discount_type', 'discount_amount',
  'want_vat', 'usage_status', 'gps', 'issues', 'cutoff_date', 'note', 'legacy',
] as const;

export function memberToRow(m: any): Record<(typeof CUSTOMER_COLS)[number], any> {
  const up = num(m.M12);
  return {
    customer_code: String(m.M01).trim(),
    full_name: String(m.M04 || '').trim().slice(0, 200),
    village_no: intOr(m.M02, null),
    national_id: clean(m.M08, 20),
    phone: clean(m.M07, 20),
    address: clean(m.M05, 255),
    soi: clean(m.soi, 100),
    road: clean(m.road, 100),
    meter_last_reading: intOr(m.M09, null),
    meter_size_code: clean(m.M10, 10),
    meter_digits: intOr(m.meter_size, null),
    meter_serial: clean(m.M27, 60),
    // ราคาต่อหน่วยรายคน — เก็บเฉพาะที่ต่างจากเรตกลาง 4฿ (3฿ = ยังไม่ขึ้นราคา) · null = ใช้เรตกลาง
    unit_price: up >= 3 && up <= 20 && up !== 4 ? up : null,
    fee_rate: num(m.M11) || null,
    rate_type: clean(m.M12, 20),
    collection_route: clean(m.M03, 20),
    apply_date: dateOnly(parseMDY(m.M14)),
    garbage_fee: num(m.M15) || null,
    wastewater_fee: num(m.M16) || null,
    pay_method: m.M17 === '01' ? 'เงินสด' : clean(m.M17, 20),
    discount_type: clean(m.M22, 20),
    discount_amount: num(m.M25) || null,
    want_vat: /true/i.test(String(m.M26)),
    usage_status: /^0[123]$/.test(String(m.M23)) ? String(m.M23) : null,
    gps: m.location && /,/.test(m.location) ? String(m.location) : null,
    issues: JSON.stringify(m.issues || []),
    cutoff_date: dateOnly(parseMDY(m.M24)),
    note: clean(m.remark, 2000),
    legacy: JSON.stringify(m),
  };
}

/** คอลัมน์ water_bills_v2 ที่ยึดตามระบบเดิม (ไม่รวม slip/ลายเซ็น/รูปมาตร/receipt_no ที่ระบบเราออกเอง) */
export const BILL_COLS = [
  'customer_id', 'customer_code', 'full_name', 'village_no', 'period_year', 'period_month', 'period_round', 'bill_no',
  'reader_name', 'prev_reading', 'curr_reading', 'units', 'prev_read_at', 'curr_read_at', 'read_at',
  'unit_price', 'water_amount', 'service_fee', 'wastewater_fee', 'tax', 'garbage_fee', 'total_amount',
  'status', 'paid_amount', 'paid_at', 'pay_method', 'gps', 'legacy',
] as const;

export const billTotal = (b: any) => num(b.BA11) + num(b.BA12) + num(b.BA13) + num(b.BA14) + num(b.BA15);
export const billPaid = (b: any) => String(b.B10) === '1';

export function billToRow(b: any, cust: { id: string; name: string; village: number | null }) {
  const p = roundToPeriod(b.B01)!;
  const total = billTotal(b);
  const paid = billPaid(b);
  const units = intOr(b.B21, 0);
  const curr = parseDMY(b.B19) || parseDMY(b.B05) || parseDMY(b.B07);
  return {
    customer_id: cust.id,
    customer_code: String(b.B03),
    full_name: cust.name,
    village_no: cust.village,
    period_year: p.year,
    period_month: p.month,
    period_round: String(b.B01).slice(0, 10),
    bill_no: clean(b.B22, 40),
    reader_name: clean(b.B23, 200),
    prev_reading: intOr(b.B18, 0),
    curr_reading: intOr(b.B20, 0),
    units,
    prev_read_at: iso(parseDMY(b.B17)),
    curr_read_at: iso(parseDMY(b.B19)),
    read_at: iso(curr),
    unit_price: units > 0 ? Math.round((num(b.BA11) / units) * 100) / 100 : 0,
    water_amount: num(b.BA11),
    service_fee: num(b.BA12),
    wastewater_fee: num(b.BA13),
    tax: num(b.BA14),
    garbage_fee: num(b.BA15),
    total_amount: total,
    status: paid ? 'paid' : 'unpaid',
    paid_amount: paid ? total : null,
    paid_at: paid ? iso(parseAny(b.B24) || parseAny(b.B08)) : null,
    pay_method: paid ? 'cash' : null,
    gps: b.location && /,/.test(b.location) ? String(b.location) : null,
    legacy: JSON.stringify(b),
  };
}
