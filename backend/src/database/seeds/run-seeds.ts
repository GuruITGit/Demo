import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { DataSource } from 'typeorm';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

import { seedRolesAndPermissions } from './seed-roles-permissions';
import { seedMasterData } from './seed-master-data';
import { seedInitialOrg } from './seed-initial-org';
import { seedDemoData } from './seed-demo-data';
import { resetAllData } from './reset-data';

// --reset (หรือ SEED_RESET=true) = ลบข้อมูลเก่าทั้งหมดก่อน seed ใหม่
const DO_RESET = process.argv.includes('--reset') || process.env.SEED_RESET === 'true';

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
    console.log('Database connected');

    console.log('\n=== Running Seeds ===\n');

    if (DO_RESET) {
      console.log('0. ⚠️  RESET — ลบข้อมูลเก่าทั้งหมด...');
      await resetAllData(dataSource);
    }

    console.log('1. Seeding roles and permissions...');
    await seedRolesAndPermissions(dataSource);

    console.log('\n2. Seeding master data...');
    await seedMasterData(dataSource);

    console.log('\n3. Seeding initial organization and users...');
    await seedInitialOrg(dataSource);

    console.log('\n4. Seeding demo data (สารบรรณ + โครงการ)...');
    await seedDemoData(dataSource);

    console.log('\n=== Seeds completed successfully ===');
    console.log('\nบัญชี seed (local): admin = env INITIAL_ADMIN_PASSWORD, ผู้ใช้สมมติ = env SEED_DEMO_PASSWORD');
    console.log('  ดูรายชื่อ/บทบาททั้งหมดใน seed-initial-org.ts');
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

main();
