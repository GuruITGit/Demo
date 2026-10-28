import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ข้อมูลหน่วยงานเฉพาะระบบประปา (ชื่อ/ที่อยู่/โทร/โลโก้) — water_rate.org_*
 * ว่าง = ใช้จากทะเบียนหน่วยงานหลัก (organizations) · idempotent
 */
export class WaterOrgIdentity1700000052000 implements MigrationInterface {
  name = 'WaterOrgIdentity1700000052000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE water_rate ADD COLUMN IF NOT EXISTS org_name varchar(200)`);
    await q.query(`ALTER TABLE water_rate ADD COLUMN IF NOT EXISTS org_address text`);
    await q.query(`ALTER TABLE water_rate ADD COLUMN IF NOT EXISTS org_phone varchar(50)`);
    await q.query(`ALTER TABLE water_rate ADD COLUMN IF NOT EXISTS org_logo_url text`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE water_rate DROP COLUMN IF EXISTS org_logo_url`);
    await q.query(`ALTER TABLE water_rate DROP COLUMN IF EXISTS org_phone`);
    await q.query(`ALTER TABLE water_rate DROP COLUMN IF EXISTS org_address`);
    await q.query(`ALTER TABLE water_rate DROP COLUMN IF EXISTS org_name`);
  }
}
