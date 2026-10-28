import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { hashPassword } from '../../common/utils/hash.util';
import { WATER_CAPS } from '../entities/water-user.entity';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

/**
 * สร้าง "แอดมินระบบประปา" คนแรกของทุกองค์กร (แยกจากบัญชีสารบรรณ)
 * รหัสจาก env WATER_ADMIN_PASSWORD (ไม่เก็บใน repo) · username จาก WATER_ADMIN_USERNAME (default 'admin')
 * idempotent — ถ้ามีแล้วข้าม (ไม่ทับรหัส) · รัน: ts-node src/database/seeds/seed-water-admin.ts  (prod: node dist/...)
 */
async function main() {
  const username = process.env.WATER_ADMIN_USERNAME || 'admin';
  const password = process.env.WATER_ADMIN_PASSWORD;
  if (!password) { console.error('❌ ต้องตั้ง env WATER_ADMIN_PASSWORD ก่อน'); process.exit(1); }

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
  const hash = await hashPassword(password);
  const caps = JSON.stringify([...WATER_CAPS]);

  const orgs = await ds.query(`SELECT id, code, name_th FROM organizations`);
  let created = 0, skipped = 0;
  for (const org of orgs) {
    const [exist] = await ds.query(
      `SELECT id FROM water_users WHERE organization_id = $1 AND username = $2`, [org.id, username]);
    if (exist) { skipped++; continue; }
    await ds.query(
      `INSERT INTO water_users (organization_id, username, password_hash, full_name, role, caps, active)
       VALUES ($1, $2, $3, $4, 'admin', $5::jsonb, true)`,
      [org.id, username, hash, 'ผู้ดูแลระบบประปา', caps]);
    created++;
    console.log(`✓ สร้างแอดมินประปา org ${org.code} (${org.name_th}) — ${username}`);
  }
  console.log(`\nเสร็จ: สร้าง ${created} · ข้าม(มีแล้ว) ${skipped}`);
  await ds.destroy();
}
main().catch((e) => { console.error(e); process.exit(1); });
