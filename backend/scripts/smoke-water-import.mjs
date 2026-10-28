#!/usr/bin/env node
/**
 * ทดสอบการนำเข้าทะเบียนผู้ใช้น้ำจากไฟล์ (POST /water/customers/import)
 *
 * ใช้: node scripts/smoke-water-import.mjs        (ต้องให้ backend รันอยู่ที่ port 4000)
 * ตัวแปร: API (default http://localhost:4000/v1), ADMIN_USER, ADMIN_PASS
 *
 * ทดสอบด้วยรหัสขึ้นต้น ZZTEST เท่านั้น แล้วลบทิ้งตอนจบ — ไม่แตะข้อมูลจริง
 */
import { Buffer } from 'node:buffer';
import path from 'node:path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env') });   // เอารหัส admin จาก .env ไม่ต้องพิมพ์ตอนรัน

const API = process.env.API || 'http://localhost:4000/v1';
const USER = process.env.ADMIN_USER || process.env.INITIAL_ADMIN_USERNAME || 'admin';
const PASS = process.env.ADMIN_PASS || process.env.INITIAL_ADMIN_PASSWORD;
const PREFIX = 'ZZTEST';

let token = '';
let pass = 0, fail = 0;

const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
};

/** ยิง API พร้อม retry เมื่อโดน rate limit (429) */
async function req(path, opts = {}, retry = 3) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  });
  if (res.status === 429 && retry > 0) {
    await new Promise((r) => setTimeout(r, 1500));
    return req(path, opts, retry - 1);
  }
  const body = await res.json().catch(() => null);
  return { status: res.status, body, data: body?.data, message: body?.error?.message || body?.message };
}

/** อัปโหลดไฟล์ — สร้าง multipart เองเพื่อคุม encoding ของไบต์ได้ (ทดสอบ TIS-620) */
async function upload(bytes, filename, { preview = false } = {}) {
  const fd = new FormData();
  fd.append('file', new Blob([bytes]), filename);
  return req(`/water/customers/import${preview ? '?preview=1' : ''}`, { method: 'POST', body: fd });
}

/** แปลงข้อความไทยเป็นไบต์ TIS-620 (จำลองไฟล์ที่ Excel ไทยเซฟออกมา) */
const toTis620 = (s) => Buffer.from([...s].map((c) => {
  const u = c.charCodeAt(0);
  return u >= 0x0e01 && u <= 0x0e5b ? u - 0x0e00 + 0xa0 : u & 0xff;
}));

(async () => {
  console.log(`ทดสอบนำเข้าทะเบียนผู้ใช้น้ำ @ ${API}\n`);

  // ── ล็อกอิน
  const login = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USER, password: PASS }),
  });
  const lb = await login.json().catch(() => null);
  token = lb?.data?.accessToken || lb?.accessToken;
  if (!token) { console.error('✗ ล็อกอินไม่ผ่าน — ตั้ง ADMIN_PASS ให้ถูก'); process.exit(1); }

  const before = (await req('/water/customers?limit=1')).body?.meta?.total ?? 0;
  console.log(`ทะเบียนก่อนทดสอบ: ${before.toLocaleString()} ราย\n`);

  // ── 1. ตรวจไฟล์ก่อนนำเข้า (preview ต้องไม่เขียน DB)
  console.log('อ่านไฟล์ CSV');
  const csv = `รหัส,ชื่อ,หมู่\n${PREFIX}01,นางทองสา คำเกิด,1\n${PREFIX}02,นายสมชาย ใจดี,10\n`;
  let r = await upload(Buffer.from(csv, 'utf8'), 'a.csv', { preview: true });
  ok('preview อ่าน 2 แถว', r.status === 201 && r.data?.total === 2, JSON.stringify(r.body)?.slice(0, 120));
  ok('preview บอกว่าจะเพิ่มใหม่ 2', r.data?.created === 2);
  ok('preview ไม่เขียนฐานข้อมูล',
    ((await req('/water/customers?limit=1')).body?.meta?.total ?? 0) === before);
  ok('อ่านชื่อไทยถูก', r.data?.sample?.[0]?.fullName === 'นางทองสา คำเกิด', r.data?.sample?.[0]?.fullName);
  ok('อ่านหมู่เป็นตัวเลข', r.data?.sample?.[1]?.villageNo === 10);

  // ── 2. เข้ารหัสแบบ Excel ไทย (TIS-620) ต้องอ่านออกเหมือนกัน
  console.log('\nไฟล์จาก Excel ไทย (TIS-620)');
  r = await upload(toTis620(csv), 'tis.csv', { preview: true });
  ok('อ่านไฟล์ TIS-620 ออก', r.data?.sample?.[0]?.fullName === 'นางทองสา คำเกิด', r.data?.sample?.[0]?.fullName);

  // ── 3. รูปแบบอื่นๆ
  console.log('\nรูปแบบไฟล์');
  r = await upload(Buffer.from(JSON.stringify([{ code: `${PREFIX}03`, name: 'นางสีดา ทองมาก', moo: 5 }]), 'utf8'), 'a.json', { preview: true });
  ok('รับไฟล์ JSON', r.data?.total === 1 && r.data?.sample?.[0]?.villageNo === 5);

  r = await upload(Buffer.from(`code,name,village\n${PREFIX}04,Test User,7\n`, 'utf8'), 'en.csv', { preview: true });
  ok('หัวตารางภาษาอังกฤษก็ได้', r.data?.total === 1 && r.data?.sample?.[0]?.villageNo === 7);

  r = await upload(Buffer.from('﻿' + csv, 'utf8'), 'bom.csv', { preview: true });
  ok('ไฟล์มี BOM อ่านได้', r.data?.sample?.[0]?.customerCode === `${PREFIX}01`, r.data?.sample?.[0]?.customerCode);

  r = await upload(Buffer.from(`รหัส,ชื่อ\n${PREFIX}05,"คำเกิด, ทองสา"\n`, 'utf8'), 'q.csv', { preview: true });
  ok('ค่าที่มีลูกน้ำใน "..." ไม่ถูกตัด', r.data?.sample?.[0]?.fullName === 'คำเกิด, ทองสา', r.data?.sample?.[0]?.fullName);

  // ── 4. ไฟล์มีปัญหา
  console.log('\nไฟล์ที่ผิดรูปแบบ');
  r = await upload(Buffer.from('a,b,c\n1,2,3\n', 'utf8'), 'bad.csv', { preview: true });
  ok('หัวตารางไม่มีรหัส/ชื่อ → 400', r.status === 400 && /คอลัมน์/.test(r.message || ''), r.message);

  r = await upload(Buffer.from('{"a":1}', 'utf8'), 'bad.json', { preview: true });
  ok('JSON ไม่ใช่ array → 400', r.status === 400, r.message);

  r = await upload(Buffer.from('MZ\x90\x00', 'binary'), 'evil.exe', { preview: true });
  ok('ไฟล์ .exe ถูกปฏิเสธ', r.status === 400 && /csv|json/i.test(r.message || ''), r.message);

  const messy = `รหัส,ชื่อ,หมู่\n${PREFIX}10,คนที่หนึ่ง,1\n,ไม่มีรหัส,2\n${PREFIX}11,,3\n${PREFIX}10,ซ้ำกับข้างบน,4\n${PREFIX}12,หมู่ไม่ใช่เลข,ริมทาง\n`;
  r = await upload(Buffer.from(messy, 'utf8'), 'messy.csv', { preview: true });
  ok('ข้ามแถวเสีย เก็บแถวดี', r.data?.total === 2, `total=${r.data?.total}`);
  ok('นับแถวที่ข้าม = 3', r.data?.skipped === 3, JSON.stringify(r.data?.issues));
  ok('บอกเลขบรรทัดตรงกับใน Excel', r.data?.issues?.[0]?.line === 3, JSON.stringify(r.data?.issues?.[0]));
  ok('จับรหัสซ้ำในไฟล์เดียวกันได้', r.data?.issues?.some((i) => /ซ้ำ/.test(i.reason) && i.kind === 'skip'));
  // หมู่อ่านไม่ออกต้องไม่ทิ้งทั้งแถว — นับเป็นเตือน แล้วยังนำเข้าโดยไม่ระบุหมู่
  ok('หมู่ไม่ใช่ตัวเลข = เตือน ไม่ใช่ข้าม',
    r.data?.warned === 1 && r.data?.issues?.some((i) => i.kind === 'warn' && /หมู่/.test(i.reason)),
    `warned=${r.data?.warned}`);
  ok('แถวที่หมู่อ่านไม่ออกยังถูกนำเข้า', r.data?.sample?.some((s) => s.customerCode === `${PREFIX}12` && s.villageNo === null));

  // ── 5. นำเข้าจริง
  console.log('\nนำเข้าจริง');
  r = await upload(Buffer.from(csv, 'utf8'), 'a.csv');
  ok('นำเข้าสำเร็จ', r.status === 201 && r.data?.created === 2, JSON.stringify(r.body)?.slice(0, 120));
  ok('จำนวนในทะเบียนเพิ่มขึ้น 2',
    ((await req('/water/customers?limit=1')).body?.meta?.total ?? 0) === before + 2);

  const found = await req(`/water/customers?search=${encodeURIComponent(PREFIX)}&limit=20`);
  const rec = found.data?.find((c) => c.customerCode === `${PREFIX}01`);
  ok('ข้อมูลที่บันทึกถูกต้อง', rec?.fullName === 'นางทองสา คำเกิด' && rec?.villageNo === 1, JSON.stringify(rec));

  // ── 6. รันซ้ำได้ (idempotent)
  console.log('\nนำเข้าไฟล์เดิมซ้ำ');
  r = await upload(Buffer.from(csv, 'utf8'), 'a.csv');
  ok('ไม่สร้างซ้ำ', r.data?.created === 0 && r.data?.unchanged === 2, JSON.stringify(r.data));

  const changed = `รหัส,ชื่อ,หมู่\n${PREFIX}01,นางทองสา คำเกิด (แก้ชื่อ),2\n${PREFIX}02,นายสมชาย ใจดี,10\n`;
  r = await upload(Buffer.from(changed, 'utf8'), 'a.csv');
  ok('แถวที่แก้ → อัปเดต, แถวเดิม → ไม่แตะ', r.data?.updated === 1 && r.data?.unchanged === 1, JSON.stringify(r.data));
  const after = await req(`/water/customers?search=${encodeURIComponent(PREFIX)}01&limit=5`);
  ok('ชื่อ/หมู่ถูกอัปเดตจริง',
    after.data?.[0]?.fullName === 'นางทองสา คำเกิด (แก้ชื่อ)' && after.data?.[0]?.villageNo === 2,
    JSON.stringify(after.data?.[0]));

  // ── 7. สิทธิ์
  console.log('\nสิทธิ์');
  const noToken = await fetch(`${API}/water/customers/import`, { method: 'POST' });
  ok('ไม่ล็อกอิน → 401', noToken.status === 401, String(noToken.status));

  // ── ล้างข้อมูลทดสอบ
  const cleanup = await req(`/water/customers?search=${encodeURIComponent(PREFIX)}&limit=50`);
  for (const c of cleanup.data || []) await req(`/water/customers/${c.id}`, { method: 'DELETE' });
  const total = (await req('/water/customers?limit=1')).body?.meta?.total ?? 0;
  ok('ล้างข้อมูลทดสอบครบ', total === before, `${total} ≠ ${before}`);

  console.log(`\n${fail === 0 ? '✓ ผ่านทั้งหมด' : '✗ ไม่ผ่าน'} — ผ่าน ${pass} · ไม่ผ่าน ${fail}`);
  process.exit(fail === 0 ? 0 : 1);
})();
