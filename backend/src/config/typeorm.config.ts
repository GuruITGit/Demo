import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config();

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  username: process.env.DB_USERNAME || 'smartgov',
  password: process.env.DB_PASSWORD || 'smartgov_password',
  database: process.env.DB_DATABASE || 'smartgov_db',
  entities: [join(__dirname, '..', 'database', 'entities', '*.entity.{ts,js}')],
  migrations: [join(__dirname, '..', 'database', 'migrations', '*.{ts,js}')],
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
  // Supabase/managed Postgres บังคับ SSL — เปิดด้วย DB_SSL=true (ใช้ตอนรัน migration บน prod ด้วย)
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});
