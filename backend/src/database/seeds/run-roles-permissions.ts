import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { DataSource } from 'typeorm';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

import { seedRolesAndPermissions } from './seed-roles-permissions';

/**
 * sync เฉพาะ "สิทธิ์ + บทบาท" ขึ้นฐานข้อมูล — ใช้กับ prod ได้
 *
 * ทำไมต้องมีแยกจาก `seed:run`:
 *   seed:run จะ seed ข้อมูลสมมติ (สารบรรณ/โครงการ/ผู้ใช้ตัวอย่าง) ไปด้วย ซึ่งห้ามขึ้น prod เด็ดขาด
 *   ตัวนี้เรียกแค่ seedRolesAndPermissions ซึ่ง **เพิ่มอย่างเดียว ไม่ลบ/ไม่ทับ**
 *   (permission/role/role_permission ที่มีอยู่แล้วจะถูกข้าม — สิทธิ์ที่ปรับเองไว้ในหน้าตั้งค่าไม่หาย)
 *
 * ใช้เมื่อไหร่: ทุกครั้งที่เพิ่มโมดูลใหม่ที่มีสิทธิ์ใหม่ (เช่น โมดูลใหม่ที่เพิ่งเพิ่ม) แล้ว deploy ขึ้น prod
 *   — migration สร้างแค่ตาราง ไม่ได้ใส่สิทธิ์ให้ ต้องรันตัวนี้ตามด้วย ไม่งั้นเปิดหน้าโมดูลใหม่จะติด 403
 *
 * รัน:  npm run seed:perms            (dev, ts-node)
 *       node dist/database/seeds/run-roles-permissions.js   (prod ใน container)
 */
async function main(): Promise<void> {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'smartgov_dev',
    entities: [path.join(__dirname, '../entities/**/*.entity{.ts,.js}')],
    synchronize: false,
  });

  try {
    await dataSource.initialize();
    console.log(`เชื่อมต่อฐานข้อมูล ${process.env.DB_DATABASE} แล้ว\n`);
    await seedRolesAndPermissions(dataSource);
    console.log('\n✓ sync สิทธิ์เรียบร้อย — ผู้ใช้ต้อง login ใหม่ (สิทธิ์ฝังอยู่ใน token)');
  } catch (err) {
    console.error('sync สิทธิ์ไม่สำเร็จ:', err);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

main();
