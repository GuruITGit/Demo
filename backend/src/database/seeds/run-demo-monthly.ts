import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { DataSource } from 'typeorm';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

import { seedDemoMonthly } from './seed-demo-monthly';

/**
 * สร้างข้อมูลสารบรรณตัวอย่างย้อนหลังหลายเดือน สำหรับสาธิต "รายงานสรุปประจำเดือน"
 *   local: npm run seed:demo-monthly
 *   prod (ในเครื่อง server): docker compose -f docker-compose.lean.yml exec backend node dist/database/seeds/run-demo-monthly.js
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
    console.log('Database connected');
    console.log('Seeding demo monthly tickets (ข้อมูลตัวอย่างรายงานสรุปประจำเดือน)...');
    await seedDemoMonthly(dataSource);
    console.log('Done');
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

main();
