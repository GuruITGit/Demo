#!/usr/bin/env node
/**
 * ทดสอบ dashboard สรุปการเก็บค่าน้ำ (บันทึกงวด → ดึง → dashboard → แก้ทับ → ลบ)
 * ใช้: node scripts/smoke-water-collection.mjs   (ต้องให้ backend รันที่ port 4000)
 * ใช้ปีทดสอบ 2699 (ไกลๆ) แล้วลบทิ้งตอนจบ — ไม่แตะข้อมูลจริง
 */
import path from 'node:path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.join(process.cwd(), '.env') });

const API = process.env.API || 'http://localhost:4000/v1';
const USER = process.env.ADMIN_USER || process.env.INITIAL_ADMIN_USERNAME || 'admin';
const PASS = process.env.ADMIN_PASS || process.env.INITIAL_ADMIN_PASSWORD;
const YEAR = 2699, MONTH = 12;

let token = '', pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}${extra ? ` — ${extra}` : ''}`); } };

async function req(p, opts = {}, retry = 3) {
  const res = await fetch(`${API}${p}`, { ...opts, headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) } });
  if (res.status === 429 && retry > 0) { await new Promise(r => setTimeout(r, 1500)); return req(p, opts, retry - 1); }
  const body = await res.json().catch(() => null);
  return { status: res.status, body, data: body?.data, msg: body?.error?.message || body?.message };
}
const save = (rows) => req('/water/collection', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ periodYear: YEAR, periodMonth: MONTH, rows }) });

(async () => {
  console.log(`SMOKE: สรุปการเก็บค่าน้ำ @ ${API}\n`);
  const login = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: USER, password: PASS }) });
  token = (await login.json().catch(() => null))?.data?.accessToken;
  if (!token) { console.error('✗ ล็อกอินไม่ผ่าน'); process.exit(1); }

  // 1. บันทึกงวด
  console.log('บันทึก + ดึง');
  let r = await save([
    { villageNo: 1, customers: 100, billedAmount: 5000, collectedAmount: 4500 },
    { villageNo: 2, customers: 50, billedAmount: 2500, collectedAmount: 2500 },
    { villageNo: 3, customers: 0, billedAmount: 0, collectedAmount: 0 }, // แถวศูนย์ ต้องไม่ถูกเก็บ
  ]);
  ok('บันทึกสำเร็จ', r.status === 201 && r.data?.saved === 2, JSON.stringify(r.body)?.slice(0, 120));

  r = await req(`/water/collection?year=${YEAR}&month=${MONTH}`);
  ok('ดึงได้ 2 หมู่ (แถวศูนย์ไม่ถูกเก็บ)', r.data?.length === 2, `len=${r.data?.length}`);
  ok('ค่าถูกต้อง', r.data?.[0]?.billedAmount === 5000 && r.data?.[0]?.collectedAmount === 4500);

  // 2. dashboard
  console.log('\ndashboard');
  r = await req(`/water/collection/dashboard?year=${YEAR}&month=${MONTH}`);
  ok('มีข้อมูล', r.data?.hasData === true);
  ok('รวมยอดถูก (บิล 7500 เก็บ 7000 ค้าง 500)',
    r.data?.totals?.billed === 7500 && r.data?.totals?.collected === 7000 && r.data?.totals?.outstanding === 500,
    JSON.stringify(r.data?.totals));
  ok('อัตราเก็บ = 93.3%', r.data?.totals?.rate === 93.3, `rate=${r.data?.totals?.rate}`);
  ok('แยกหมู่ 2 แถว', r.data?.byVillage?.length === 2);
  ok('outstanding รายหมู่ถูก', r.data?.byVillage?.find(v => v.villageNo === 1)?.outstanding === 500);

  r = await req('/water/collection/periods');
  ok('งวดโผล่ใน periods', r.data?.some(p => p.periodYear === YEAR && p.periodMonth === MONTH));

  // 3. แก้ทับ (บันทึกใหม่แทนที่ทั้งงวด)
  console.log('\nแก้ทับทั้งงวด');
  r = await save([{ villageNo: 1, customers: 120, billedAmount: 6000, collectedAmount: 6000 }]);
  ok('บันทึกทับ = 1 หมู่', r.data?.saved === 1);
  r = await req(`/water/collection?year=${YEAR}&month=${MONTH}`);
  ok('เหลือ 1 หมู่ (หมู่ 2 เดิมหายไป)', r.data?.length === 1 && r.data?.[0]?.villageNo === 1, `len=${r.data?.length}`);
  ok('ค่าใหม่ถูก', r.data?.[0]?.collectedAmount === 6000);

  // 4. validation
  console.log('\nตรวจสอบความถูกต้อง');
  r = await save([{ villageNo: 1, customers: 10, billedAmount: 100, collectedAmount: 200 }]);
  ok('เก็บได้ > บิล → 400', r.status === 400 && /มากกว่า/.test(r.msg || ''), r.msg);

  const noAuth = await fetch(`${API}/water/collection?year=${YEAR}&month=${MONTH}`);
  ok('ไม่ล็อกอิน → 401', noAuth.status === 401);

  // 5. ลบ (บันทึกงวดเป็นศูนย์ทั้งหมด = ลบงวด)
  console.log('\nล้างข้อมูลทดสอบ');
  await save([{ villageNo: 1, customers: 0, billedAmount: 0, collectedAmount: 0 }]);
  r = await req(`/water/collection?year=${YEAR}&month=${MONTH}`);
  ok('ลบงวดทดสอบแล้ว', r.data?.length === 0, `len=${r.data?.length}`);
  r = await req('/water/collection/periods');
  ok('งวดทดสอบหายจาก periods', !r.data?.some(p => p.periodYear === YEAR && p.periodMonth === MONTH));

  console.log(`\n${fail === 0 ? '✓ ผ่านทั้งหมด' : '✗ ไม่ผ่าน'} — ผ่าน ${pass} · ไม่ผ่าน ${fail}`);
  process.exit(fail === 0 ? 0 : 1);
})();
