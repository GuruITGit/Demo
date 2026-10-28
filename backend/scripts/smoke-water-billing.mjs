#!/usr/bin/env node
/**
 * ทดสอบระบบเก็บค่าน้ำ v2 (field app): เรต → จดมิเตอร์ → คิดเงิน → รับชำระ → prev reading
 * ใช้ปีทดสอบ 2699 กับผู้ใช้น้ำจริงรายแรก แล้วลบบิลทดสอบทิ้งตอนจบ (ไม่แตะข้อมูลจริง)
 */
import path from 'node:path';
import { createRequire } from 'node:module';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.join(process.cwd(), '.env') });
const require = createRequire(import.meta.url);

const API = process.env.API || 'http://localhost:4000/v1';
const USER = process.env.ADMIN_USER || process.env.INITIAL_ADMIN_USERNAME || 'admin';
const PASS = process.env.ADMIN_PASS || process.env.INITIAL_ADMIN_PASSWORD;
const YEAR = 2699;

let token = '', pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}${extra ? ` — ${extra}` : ''}`); } };
async function req(p, opts = {}, retry = 3) {
  const res = await fetch(`${API}${p}`, { ...opts, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  if (res.status === 429 && retry > 0) { await new Promise(r => setTimeout(r, 1500)); return req(p, opts, retry - 1); }
  const body = await res.json().catch(() => null);
  return { status: res.status, body, data: body?.data, msg: body?.error?.message || body?.message };
}
const reading = (cid, month, curr) => req('/water/billing/reading', { method: 'POST', body: JSON.stringify({ customerId: cid, periodYear: YEAR, periodMonth: month, currReading: curr }) });

(async () => {
  console.log(`SMOKE: ระบบเก็บค่าน้ำ v2 @ ${API}\n`);
  const login = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: USER, password: PASS }) });
  token = (await login.json().catch(() => null))?.data?.accessToken;
  if (!token) { console.error('✗ ล็อกอินไม่ผ่าน'); process.exit(1); }

  const cust = (await req('/water/customers?limit=1')).data?.[0];
  if (!cust) { console.error('✗ ไม่มีผู้ใช้น้ำในระบบ'); process.exit(1); }
  console.log(`ผู้ใช้น้ำทดสอบ: ${cust.customerCode} ${cust.fullName} (หมู่ ${cust.villageNo})\n`);

  // 1. เรต
  console.log('เรตค่าน้ำ');
  let r = await req('/water/billing/rate');
  ok('มีเรต (default 4/5)', Number(r.data?.unitPrice) === 4 && Number(r.data?.serviceFee) === 5, JSON.stringify(r.data));

  // 2. จดมิเตอร์งวดแรก → คิดเงิน
  console.log('\nจดมิเตอร์ + คิดเงิน');
  r = await reading(cust.id, 11, 100);
  ok('จดงวด 11 = หน่วย 100', r.status === 201 && r.data?.units === 100, JSON.stringify(r.body)?.slice(0, 120));
  ok('คิดเงินถูก (100×4 + 5 = 405)', Number(r.data?.totalAmount) === 405, `total=${r.data?.totalAmount}`);
  ok('สถานะ = ค้างชำระ', r.data?.status === 'unpaid');
  ok('prev = 0 (งวดแรก)', r.data?.prevReading === 0);
  const bill1 = r.data.id;

  // 3. งวดถัดไป → prev = curr งวดก่อน
  console.log('\nงวดถัดไป (prev มาจาก curr งวดก่อน)');
  r = await reading(cust.id, 12, 130);
  ok('prev = 100 (จากงวด 11)', r.data?.prevReading === 100, `prev=${r.data?.prevReading}`);
  ok('หน่วย = 30 (130−100)', r.data?.units === 30, `units=${r.data?.units}`);
  ok('รวม = 125 (30×4 + 5)', Number(r.data?.totalAmount) === 125);
  const bill2 = r.data.id;

  // 4. แก้จดซ้ำ (ยังไม่จ่าย แก้ได้)
  r = await reading(cust.id, 12, 140);
  ok('จดซ้ำงวดเดิม (ยังไม่จ่าย) แก้ได้ → หน่วย 40', r.data?.units === 40, `units=${r.data?.units}`);

  // 5. routes / members
  console.log('\nเล่ม/รายชื่อ');
  r = await req(`/water/billing/routes?year=${YEAR}&month=12`);
  const v = r.data?.find(x => x.villageNo === cust.villageNo);
  ok('routes นับจดแล้ว >= 1', v && v.read >= 1, JSON.stringify(v));
  r = await req(`/water/billing/members?year=${YEAR}&month=12&villageNo=${cust.villageNo}`);
  const me = r.data?.find(x => x.customerId === cust.id);
  ok('members เห็นบิลของงวด', me?.billId === bill2 && me?.status === 'unpaid', JSON.stringify(me)?.slice(0, 120));

  // 6. รับชำระ
  console.log('\nรับชำระ');
  r = await req(`/water/billing/${bill2}/pay`, { method: 'POST', body: JSON.stringify({ payMethod: 'cash', receiptNo: 'T-001' }) });
  ok('รับชำระสำเร็จ', r.data?.status === 'paid' && r.data?.receiptNo === 'T-001', JSON.stringify(r.body)?.slice(0, 120));
  r = await req(`/water/billing/${bill2}/pay`, { method: 'POST', body: JSON.stringify({}) });
  ok('จ่ายซ้ำ → 409', r.status === 409, r.msg);
  r = await reading(cust.id, 12, 200);
  ok('แก้เลขมิเตอร์บิลที่จ่ายแล้ว → 409', r.status === 409, r.msg);

  // 7. ยกเลิกรับชำระ
  r = await req(`/water/billing/${bill2}/cancel-pay`, { method: 'POST' });
  ok('ยกเลิกรับชำระ → กลับเป็นค้าง', r.data?.status === 'unpaid' && !r.data?.receiptNo);

  // 8. สิทธิ์
  const noAuth = await fetch(`${API}/water/billing/rate`);
  ok('ไม่ล็อกอิน → 401', noAuth.status === 401);

  // ── ล้างบิลทดสอบ (ปี 2699) ผ่าน DB ตรง (ไม่มี endpoint ลบบิล — ตั้งใจ)
  console.log('\nล้างข้อมูลทดสอบ');
  const { Client } = require('pg');
  const db = new Client({ host: process.env.DB_HOST || 'localhost', port: +(process.env.DB_PORT || 5432), user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE });
  await db.connect();
  const { rowCount } = await db.query(`DELETE FROM water_bills_v2 WHERE period_year = $1`, [YEAR]);
  await db.end();
  ok('ลบบิลทดสอบแล้ว', rowCount >= 2, `ลบ ${rowCount} แถว`);

  console.log(`\n${fail === 0 ? '✓ ผ่านทั้งหมด' : '✗ ไม่ผ่าน'} — ผ่าน ${pass} · ไม่ผ่าน ${fail}`);
  process.exit(fail === 0 ? 0 : 1);
})();
