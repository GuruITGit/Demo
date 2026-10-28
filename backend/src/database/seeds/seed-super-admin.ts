import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { hashPassword } from '../../common/utils/hash.util';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

/**
 * สร้าง "ผู้ดูแลระบบสูงสุด (SUPER_ADMIN)" ตัวแรก = เจ้าของระบบ (ผู้ขาย) — เห็น/จัดการทุก อบต. + เปิด อบต.ใหม่ที่ /onboard
 * รหัสจาก env SUPERADMIN_PASSWORD (ไม่เก็บใน repo) · username จาก SUPERADMIN_USERNAME (default 'superadmin')
 * ผูกกับ org (SUPERADMIN_ORG_CODE ถ้าระบุ ไม่งั้นใช้ org แรก) — SUPER_ADMIN bypass scope เห็นทุก org อยู่แล้ว
 * idempotent: มี user แล้ว → แค่เพิ่ม role SUPER_ADMIN (ไม่ทับรหัส) · รัน prod: node dist/database/seeds/seed-super-admin.js
 */
async function main() {
  const username = process.env.SUPERADMIN_USERNAME || 'superadmin';
  const password = process.env.SUPERADMIN_PASSWORD;
  const orgCode = process.env.SUPERADMIN_ORG_CODE;
  if (!password) { console.error('❌ ต้องตั้ง env SUPERADMIN_PASSWORD ก่อน'); process.exit(1); }
  if (password.length < 8) { console.error('❌ รหัสผ่านอย่างน้อย 8 ตัวอักษร'); process.exit(1); }

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
  try {
    // 1) role SUPER_ADMIN (global — seed แล้วผ่าน seed:perms)
    const [role] = await ds.query(`SELECT id FROM roles WHERE name = 'SUPER_ADMIN' LIMIT 1`);
    if (!role) { console.error('❌ ไม่พบ role SUPER_ADMIN — รัน seed:perms ก่อน (npm run seed:perms:prod)'); process.exit(1); }

    // 2) org ที่จะผูก
    const [org] = orgCode
      ? await ds.query(`SELECT id, code, name_th FROM organizations WHERE UPPER(code) = UPPER($1) LIMIT 1`, [orgCode])
      : await ds.query(`SELECT id, code, name_th FROM organizations ORDER BY created_at LIMIT 1`);
    if (!org) { console.error('❌ ไม่พบหน่วยงาน' + (orgCode ? ` รหัส ${orgCode}` : '')); process.exit(1); }

    // 3) user (ต่อ org — unique ต่อ org)
    let [user] = await ds.query(
      `SELECT id FROM users WHERE organization_id = $1 AND username = $2`, [org.id, username]);
    if (user) {
      console.log(`ℹ️  user ${username} มีใน ${org.code} แล้ว — ไม่ทับรหัส แค่ผูก role SUPER_ADMIN`);
    } else {
      const hash = await hashPassword(password);
      const email = `${username}@${String(org.code).toLowerCase()}.local`;
      [user] = await ds.query(
        `INSERT INTO users (organization_id, username, email, password_hash, full_name_th, is_active)
         VALUES ($1, $2, $3, $4, $5, true) RETURNING id`,
        [org.id, username, email, hash, 'ผู้ดูแลระบบสูงสุด']);
      console.log(`✓ สร้าง user ${username} ใน ${org.code} (${org.name_th})`);
    }

    // 4) ผูก role SUPER_ADMIN (กันซ้ำ)
    const [rel] = await ds.query(
      `SELECT 1 FROM user_roles WHERE user_id = $1 AND role_id = $2`, [user.id, role.id]);
    if (rel) { console.log('ℹ️  ผูก role SUPER_ADMIN อยู่แล้ว'); }
    else {
      await ds.query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`, [user.id, role.id]);
      console.log('✓ ผูก role SUPER_ADMIN แล้ว');
    }
    console.log(`\nเสร็จ: ล็อกอินด้วย username "${username}" (ผูกกับ org ${org.code}) → เห็นทุก อบต. + เปิด อบต.ใหม่ที่ /onboard ได้`);
  } finally {
    await ds.destroy();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
