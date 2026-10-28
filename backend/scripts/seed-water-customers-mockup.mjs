#!/usr/bin/env node
/**
 * สร้างข้อมูลผู้ใช้น้ำจำลอง (mockup) รหัสเลขล้วน 5 หลัก "00001" เป็นต้นไป — แทนที่ข้อมูล demo เก่า
 * (ชุดก่อนเป็นรูปแบบคำนำหน้า+เลข CYT/CYU/CY ซึ่งไม่ตรงกับรูปแบบรหัสจริงของ อบต. ลำนางรอง)
 *
 * ใช้: ให้ backend(4000)+DB รันอยู่ แล้ว `node scripts/seed-water-customers-mockup.mjs`
 * ต้องลบข้อมูล water_customers เดิมของ org ออกก่อน (ทำผ่าน psql แล้วตอนที่คุยกันในเซสชันนี้)
 */
const BASE = process.env.API_BASE || 'http://localhost:4000/v1';
const ORG_CODE = process.env.ORG_CODE || 'ABT-DEMO';
const COUNT = Number(process.env.COUNT || 30);

const api = async (method, path, token, body) => {
  const r = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null; try { data = await r.json(); } catch {}
  return { status: r.status, data };
};
const unwrap = (d) => d?.data ?? d;

const FIRST = ['สมชาย', 'สมหญิง', 'ประยุทธ', 'มาลี', 'สมศักดิ์', 'วันดี', 'ประเสริฐ', 'นงลักษณ์', 'สุชาติ', 'กาญจนา', 'บุญมี', 'ทองสุข', 'ไพโรจน์', 'รัตนา', 'ชัยวัฒน์'];
const LAST = ['ใจดี', 'คำเกิด', 'แก้วมณี', 'สุขสันต์', 'ศรีสุข', 'บุญเลิศ', 'พรมมา', 'ทองดี', 'จันทร์เพ็ญ', 'สายทอง'];
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

(async () => {
  console.log(`สร้างผู้ใช้น้ำจำลอง (รหัสเลขล้วน 5 หลัก) ${COUNT} ราย\n`);
  const login = await api('POST', '/water/auth/login', null, {
    orgCode: ORG_CODE,
    username: process.env.WATER_ADMIN_USERNAME,
    password: process.env.WATER_ADMIN_PASSWORD,
  });
  const token = unwrap(login.data)?.accessToken;
  if (!token) { console.error('ล็อกอินระบบประปาไม่ได้ — ตั้ง WATER_ADMIN_USERNAME/WATER_ADMIN_PASSWORD ก่อนรัน'); process.exit(2); }

  let n = 0;
  for (let i = 1; i <= COUNT; i++) {
    const code = String(i).padStart(5, '0');
    const r = await api('POST', '/water/customers', token, {
      customerCode: code,
      fullName: `${rand(FIRST)} ${rand(LAST)}`,
      villageNo: ((i - 1) % 10) + 1,
      phone: `08${String(10000000 + i).slice(0, 8)}`,
      address: `${i} หมู่ ${((i - 1) % 10) + 1}`,
    });
    if (r.status === 201) { n++; console.log(`  ✓ ${code}`); }
    else console.log(`  ✗ ${code} ไม่สำเร็จ:`, r.data);
  }
  console.log(`\nสร้างเสร็จ ${n}/${COUNT} ราย — เข้าไปดูที่ http://localhost:3000/prapa/customers ได้เลย`);
})().catch((e) => { console.error('ERROR:', e); process.exit(2); });
