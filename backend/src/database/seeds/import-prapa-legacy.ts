import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { DataSource } from 'typeorm';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

/**
 * ⚠️ เลิกใช้แล้ว — ห้ามรันบน prod: สคริปต์นี้ DELETE ข้อมูลน้ำทั้งองค์กรก่อนนำเข้า และแม็ปเส้นทาง/สถานะ/วันตัดน้ำผิด
 *    ใช้ sync-prapa-legacy.ts (npm run sync:prapa) แทน — อัปเดตทับจาก API ระบบเดิม ไม่ลบ รันซ้ำได้
 *
 * นำเข้าข้อมูลจริงจากระบบเก่า (Prapa On Mobile) → schema ประปาใหม่
 *   ไฟล์ต้นทาง (gitignored, PII): d:/claude/SmartGov/Citizen system/prapa-export/
 *   - members-ALL (2,739) → water_customers  · bills-ALL (32,725) → water_bills_v2  · master → water_rate (tiered)
 * เก็บ record ดิบไว้ใน legacy(jsonb) กัน mapping ผิด · idempotent (ล้าง water ของ org ก่อน insert ใหม่)
 * รัน: ts-node src/database/seeds/import-prapa-legacy.ts   (มี --prod ไว้รันบน dist ทีหลัง)
 */
// ที่เก็บไฟล์ export (PII, gitignored) — ตั้ง PRAPA_EXPORT_DIR ได้ตอนรันบน server (prod)
const EXPORT_DIR = process.env.PRAPA_EXPORT_DIR || path.resolve(__dirname, '../../../../Citizen system/prapa-export');
const pick = (prefix: string) => {
  const f = fs.readdirSync(EXPORT_DIR).find((x) => x.startsWith(prefix));
  if (!f) throw new Error('ไม่พบไฟล์ ' + prefix + ' ใน ' + EXPORT_DIR);
  return JSON.parse(fs.readFileSync(path.join(EXPORT_DIR, f), 'utf8'));
};

// ── date parsers ──
const num = (v: any) => { const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; };
const intOr = (v: any, d: any = null) => { const n = parseInt(String(v ?? '').replace(/[^0-9\-]/g, ''), 10); return isNaN(n) ? d : n; };
/** บิลใช้ DD/MM/YYYY HH:MM:SS */
function parseDMY(s: any): Date | null {
  const m = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}):(\d{2}))?/);
  if (!m) return null;
  return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
}
/** วันขอใช้น้ำ M14 ใช้ MM/DD/YY */
function parseMDY(s: any): Date | null {
  const m = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return null;
  let [, mm, dd, yy] = m as any; mm = +mm; dd = +dd; yy = +yy;
  if (yy < 100) yy += 2000;
  if (mm > 12 && dd <= 12) { const t = mm; mm = dd; dd = t; } // เผื่อสลับ
  return new Date(yy, mm - 1, dd);
}
const iso = (d: Date | null) => (d ? d.toISOString() : null);
const dateOnly = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

async function main() {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'smartgov_dev',
    entities: [path.join(__dirname, '../entities/**/*.entity{.ts,.js}')],
    synchronize: false,
  });
  await ds.initialize();
  console.log('DB connected:', process.env.DB_DATABASE);

  // resolve org (ลำนางรอง) — env WATER_ORG_ID > ชื่อมีลำนางรอง > org แรก
  let org = process.env.WATER_ORG_ID
    ? (await ds.query(`SELECT id, name_th FROM organizations WHERE id=$1`, [process.env.WATER_ORG_ID]))[0]
    : (await ds.query(`SELECT id, name_th FROM organizations WHERE name_th ILIKE '%ลำนางรอง%' LIMIT 1`))[0]
      || (await ds.query(`SELECT id, name_th FROM organizations ORDER BY created_at LIMIT 1`))[0];
  if (!org) throw new Error('ไม่พบ organization ในฐานข้อมูล');
  const ORG = org.id;
  console.log('Target org:', org.name_th, ORG);

  const members = pick('prapa-export-members-ALL').members as any[];
  const billsMap = pick('prapa-export-bills-ALL'); // {bills:[...]} authoritative flat
  const bills = (billsMap.bills as any[]);
  const master = pick('prapa-export-master').master;
  console.log(`อ่าน: ${members.length} ราย · ${bills.length} บิล`);

  // ── 1) เรต ──
  // ระบบเก่ามี config "ก้าวหน้า" (5/6/7) แต่บิลจริง อบต.ลำนางรอง คิด "แบน 4 บาท/หน่วย" ทั้งตำบล
  // (ยืนยันจากข้อมูล: 25,658/26,000 บิล = 4฿/หน่วย) → ตั้ง flat 4 สำหรับบิลใหม่ + เก็บ tiers เดิมไว้อ้างอิง
  const rr = (master.rate_rates || [])[0];
  const tiers = ((rr?.data) || []).map((d: any) => ({ from: intOr(d.rates, 0), to: intOr(d.ratet, 0), price: num(d.rate) }));
  await ds.query(
    `INSERT INTO water_rate (organization_id, unit_price, service_fee, rate_mode, tiers, min_units, min_charge)
     VALUES ($1,4,5,'flat',$2::jsonb,0,0)
     ON CONFLICT (organization_id) DO UPDATE SET rate_mode='flat', unit_price=4, service_fee=5, tiers=EXCLUDED.tiers, updated_at=now()`,
    [ORG, JSON.stringify(tiers)],
  );
  console.log(`เรต: flat 4 บาท/หน่วย + ค่าบริการ 5 (เก็บ config ก้าวหน้า ${tiers.length} ขั้นไว้อ้างอิงใน tiers)`);

  // ── 2) ล้าง water ของ org แล้ว insert ใหม่ (idempotent) ──
  await ds.query(`DELETE FROM water_bills_v2 WHERE organization_id=$1`, [ORG]);
  await ds.query(`DELETE FROM water_customers WHERE organization_id=$1`, [ORG]);

  // customers
  const cCols = ['organization_id','customer_code','full_name','village_no','national_id','phone','address','soi','road',
    'meter_last_reading','meter_size_code','meter_digits','meter_serial','unit_price','fee_rate','rate_type','collection_route',
    'apply_date','garbage_fee','wastewater_fee','pay_method','discount_amount','want_vat','usage_status','gps','issues','cutoff_date','legacy'];
  const codeToId: Record<string, string> = {};
  const codeToVillage: Record<string, number | null> = {}; // หมู่ของบิลยึดจากสมาชิก (M02) — B16 ในบิลไม่ใช่หมู่
  const codeToName: Record<string, string> = {};           // ชื่อเจ้าของบิลยึดจากสมาชิก (M04) — B23/B09 ในบิลเป็นชื่อคนจด
  let ci = 0;
  for (let i = 0; i < members.length; i += 500) {
    const chunk = members.slice(i, i + 500);
    const vals: any[] = []; const ph: string[] = [];
    for (const m of chunk) {
      codeToVillage[String(m.M01)] = intOr(m.M02, null);
      codeToName[String(m.M01)] = String(m.M04 || '').slice(0, 200);
      const gps = (m.location && /,/.test(m.location)) ? String(m.location) : null;
      const phone = (m.M07 && m.M07 !== '-') ? String(m.M07).slice(0, 20) : null;
      const row = [ORG, String(m.M01), String(m.M04 || '').slice(0, 200), intOr(m.M02, null),
        (m.M08 && m.M08 !== '-') ? String(m.M08).slice(0, 20) : null, phone,
        (m.M05 && !/^(nan|-)$/i.test(String(m.M05).trim())) ? String(m.M05).trim().slice(0, 255) : null,
        (m.soi && m.soi !== '-') ? String(m.soi).slice(0, 100) : null, (m.road && m.road !== '-') ? String(m.road).slice(0, 100) : null,
        intOr(m.M09, null), m.M10 || null,
        null /* meter_digits: ระบบเก่าไม่มีข้อมูลจำนวนหลักมาตรจริง (M12 ที่เคยแม็ปมาคือราคาต่อหน่วย ไม่ใช่หลัก) */,
        null /* meter_serial: M29 เป็นรหัสประกอบ (รอบ-รหัสลูกค้า:เดือน) ไม่ใช่ serial เครื่อง → เก็บดิบใน legacy */,
        // unit_price: ราคาต่อหน่วยรายคนจาก M12 — เก็บเฉพาะที่ต่างจากเรตกลาง 4฿ (3฿=ยังไม่ขึ้นราคา, 5฿) และเป็นเรตสมเหตุผล; ค่าเพี้ยน(เช่น 1)/4 → null=ใช้เรตกลาง
        (() => { const up = num(m.M12); return (up >= 3 && up <= 20 && up !== 4) ? up : null; })(),
        num(m.M11) || null, null /* rate_type: ระบบเก่าไม่มี field ชัด (M13=กลุ่ม ว่าง) */, m.M23 || null, dateOnly(parseMDY(m.M14)), num(m.M15) || null, num(m.M16) || null,
        (m.M17 === '01' ? 'เงินสด' : m.M17) || null, num(m.M25) || null, /True/i.test(String(m.M26)), (m.M32 && /^0[123]$/.test(m.M32)) ? m.M32 : null, gps,
        JSON.stringify(m.issues || []), dateOnly(parseDMY(m.cutOffDate)), JSON.stringify(m)];
      const base = vals.length;
      ph.push('(' + row.map((_, k) => `$${base + k + 1}`).join(',') + ')');
      vals.push(...row);
    }
    const rows = await ds.query(
      `INSERT INTO water_customers (${cCols.join(',')}) VALUES ${ph.join(',')} RETURNING id, customer_code`, vals);
    for (const r of rows) codeToId[r.customer_code] = r.id;
    ci += chunk.length;
  }
  console.log(`นำเข้าผู้ใช้น้ำ: ${ci} ราย`);

  // ── 3) bills ──
  const bCols = ['organization_id','customer_id','customer_code','full_name','village_no','period_year','period_month',
    'period_round','bill_no','reader_name','prev_reading','curr_reading','units','prev_read_at','curr_read_at','read_at',
    'unit_price','water_amount','service_fee','wastewater_fee','tax','garbage_fee','total_amount','status','paid_amount','paid_at',
    'receipt_no','pay_method','gps','legacy'];
  let bi = 0, skipped = 0;
  for (let i = 0; i < bills.length; i += 500) {
    const chunk = bills.slice(i, i + 500);
    const vals: any[] = []; const ph: string[] = [];
    for (const b of chunk) {
      const cid = codeToId[String(b.B03)];
      if (!cid) { skipped++; continue; }
      const curr = parseDMY(b.B19) || parseDMY(b.B05) || parseDMY(b.B07);
      // period = เดือน/ปีปฏิทิน (พ.ศ.) จากรอบบิล B01 ("69-010" = ปีงบ69 รอบ10)
      // ปีงบเริ่ม ต.ค. → รอบ1=ต.ค.(ปีก่อน) ... รอบ4=ม.ค. ... รอบ12=ก.ย. · deterministic + unique ต่อ (customer,ปี,เดือน)
      const rm = String(b.B01 || '').match(/(\d+)-(\d+)/);
      let py = 0, pm = 0;
      if (rm) {
        const fy = 2500 + Number(rm[1]);        // ปีงบ พ.ศ.
        pm = ((Number(rm[2]) + 8) % 12) + 1;    // เดือนปฏิทิน (รอบ1=ต.ค.=10)
        py = pm >= 10 ? fy - 1 : fy;            // ต.ค.-ธ.ค. = ปีปฏิทินก่อนปีงบ
      } else if (curr) { py = curr.getFullYear() + 543; pm = curr.getMonth() + 1; }
      const water = num(b.BA11), service = num(b.BA12), waste = num(b.BA13), tax = num(b.BA14), garbage = num(b.BA15);
      const total = water + service + waste + tax + garbage;
      const paid = !!(b.payment_number || (b.status && /paid|จ่าย|ชำระ|success/i.test(String(b.status))));
      const row = [ORG, cid, String(b.B03), codeToName[String(b.B03)] || String(b.B23 || '').slice(0, 200), codeToVillage[String(b.B03)] ?? null,
        py, pm, String(b.B01 || '').slice(0, 10), String(b.B22 || '').slice(0, 40), String(b.B09 || '').slice(0, 200),
        intOr(b.B18, 0), intOr(b.B20, 0), intOr(b.B21, 0), iso(parseDMY(b.B17)), iso(parseDMY(b.B19)), iso(curr),
        0, water, service, waste, tax, garbage, total, paid ? 'paid' : 'unpaid', paid ? total : null,
        // วันชำระจริง = updatedAt (เวลาที่กดจ่ายในแอพ) — ระบบเก่าไม่มี field วันจ่ายแยก, B24=วันครบกำหนด
        paid && b.updatedAt ? iso(new Date(b.updatedAt)) : null,
        b.payment_number ? String(b.payment_number).slice(0, 40) : null, b.payment_type_id || null,
        (b.location && /,/.test(b.location)) ? String(b.location) : null, JSON.stringify(b)];
      const base = vals.length;
      ph.push('(' + row.map((_, k) => `$${base + k + 1}`).join(',') + ')');
      vals.push(...row);
    }
    if (ph.length) { await ds.query(`INSERT INTO water_bills_v2 (${bCols.join(',')}) VALUES ${ph.join(',')}`, vals); bi += ph.length; }
  }
  console.log(`นำเข้าบิล: ${bi} บิล (ข้าม ${skipped} ที่ไม่มีเจ้าของ)`);

  // ── 4) พิกัด GPS ผู้ใช้น้ำ = จากบิลล่าสุดที่มี location (สมาชิกไม่มี location แต่บิลมี ~32,718 ใบ) ──
  const gpsRes = await ds.query(
    `UPDATE water_customers c SET gps = s.loc
       FROM (SELECT DISTINCT ON (customer_id) customer_id, gps AS loc FROM water_bills_v2
              WHERE organization_id = $1 AND gps ~ ','
              ORDER BY customer_id, period_year DESC, period_month DESC) s
      WHERE c.id = s.customer_id AND c.organization_id = $1 AND (c.gps IS NULL OR c.gps = '')`,
    [ORG],
  );
  console.log(`ปักพิกัด GPS ผู้ใช้น้ำจากบิล: ${gpsRes[1] ?? ''} ราย`);

  // ── สรุป/ตรวจ ──
  const [cCount] = await ds.query(`SELECT count(*)::int n FROM water_customers WHERE organization_id=$1`, [ORG]);
  const [bCount] = await ds.query(`SELECT count(*)::int n, sum(total_amount)::numeric tot, sum(CASE WHEN status='paid' THEN 1 ELSE 0 END)::int paid FROM water_bills_v2 WHERE organization_id=$1`, [ORG]);
  console.log(`\n✅ เสร็จ: ผู้ใช้น้ำ ${cCount.n} ราย · บิล ${bCount.n} (ชำระแล้ว ${bCount.paid}) · ยอดรวม ${Number(bCount.tot).toLocaleString()} บาท`);
  await ds.destroy();
}
main().catch((e) => { console.error(e); process.exit(1); });
