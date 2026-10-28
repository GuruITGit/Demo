#!/usr/bin/env node
/**
 * นำเข้าทะเบียนผู้ใช้น้ำ (รหัส/ชื่อ/หมู่) สำหรับใช้เลือกตอนกรอกหนังสือแจ้งค้างชำระ
 *
 * ที่มา: `Citizen system/ระบบเก็บค่าน้ำจริงของ 14 หมู่บ้าน.../_import/customers.json`
 *        (ดึงมาจาก PDF บัญชีรายตัวลูกหนี้ของระบบเดิม — ดู Citizen system/tools/)
 *
 * ใช้:  node scripts/import-water-customers.mjs         # นำเข้า/อัปเดต
 *       node scripts/import-water-customers.mjs --dry   # ลองดูว่าจะทำอะไร ไม่เขียน DB
 * ตัวแปร: DATA_FILE (path ของ customers.json), DB_* (จาก backend/.env)
 *
 * idempotent: รันซ้ำได้ — รหัสที่มีอยู่แล้วจะอัปเดตชื่อ/หมู่ ไม่สร้างซ้ำ
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import * as dotenv from 'dotenv';

const require = createRequire(import.meta.url);
const { Client } = require('pg');
dotenv.config({ path: path.join(process.cwd(), '.env') });

const DATA_FILE = process.env.DATA_FILE
  || 'D:/claude/SmartGov/Citizen system/ระบบเก็บค่าน้ำจริงของ 14 หมู่บ้าน ของตำบลลำนางลอง/_import/customers.json';
const DRY = process.argv.includes('--dry');

(async () => {
  if (!existsSync(DATA_FILE)) {
    console.error('✗ ไม่พบไฟล์', DATA_FILE, '\n  ตั้ง DATA_FILE ให้ชี้ customers.json');
    process.exit(1);
  }
  const rows = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
  console.log(`อ่านได้ ${rows.length} ราย จาก ${path.basename(DATA_FILE)}`);

  const db = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });
  await db.connect();

  const { rows: orgs } = await db.query(`SELECT id, name_th FROM organizations ORDER BY created_at LIMIT 1`);
  if (!orgs.length) { console.error('✗ ไม่พบองค์กรในระบบ — รัน seed ก่อน'); process.exit(1); }
  const orgId = orgs[0].id;
  console.log('องค์กร:', orgs[0].name_th);

  if (DRY) {
    const sample = rows.slice(0, 3).map((r) => `${r.code} ${r.name} (หมู่ ${r.moo})`);
    console.log('ตัวอย่าง 3 แถวแรก:\n  ' + sample.join('\n  '));
    console.log('\n[--dry] ไม่เขียนฐานข้อมูล');
    await db.end();
    return;
  }

  let created = 0, updated = 0, skipped = 0;
  await db.query('BEGIN');
  for (const r of rows) {
    const code = String(r.code || '').trim();
    const name = String(r.name || '').trim();
    if (!code || !name) { skipped++; continue; }
    const moo = Number.isFinite(Number(r.moo)) ? Number(r.moo) : null;

    const { rows: found } = await db.query(
      `SELECT id FROM water_customers WHERE organization_id = $1 AND customer_code = $2 AND deleted_at IS NULL`,
      [orgId, code],
    );
    if (found.length) {
      await db.query(
        `UPDATE water_customers SET full_name = $1, village_no = $2, updated_at = now() WHERE id = $3`,
        [name, moo, found[0].id],
      );
      updated++;
    } else {
      await db.query(
        `INSERT INTO water_customers (organization_id, customer_code, full_name, village_no)
         VALUES ($1, $2, $3, $4)`,
        [orgId, code, name, moo],
      );
      created++;
    }
  }
  await db.query('COMMIT');

  const { rows: [stat] } = await db.query(
    `SELECT COUNT(*)::int AS total, COUNT(DISTINCT village_no)::int AS villages
       FROM water_customers WHERE organization_id = $1 AND deleted_at IS NULL`, [orgId],
  );
  console.log(`\nเพิ่มใหม่ ${created} · อัปเดต ${updated} · ข้าม ${skipped}`);
  console.log(`ในระบบตอนนี้: ${stat.total} ราย · ${stat.villages} หมู่`);
  await db.end();
})();
