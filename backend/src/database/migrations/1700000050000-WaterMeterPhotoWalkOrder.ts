import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * #4 รูปมาตร (หลักฐานการจด) — water_bills_v2.meter_photo_url
 * #6 ลำดับเดินจดมิเตอร์ (อบต.กรอกเอง) — water_customers.walk_order
 * idempotent
 */
export class WaterMeterPhotoWalkOrder1700000050000 implements MigrationInterface {
  name = 'WaterMeterPhotoWalkOrder1700000050000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE water_bills_v2 ADD COLUMN IF NOT EXISTS meter_photo_url text`);
    await q.query(`ALTER TABLE water_customers ADD COLUMN IF NOT EXISTS walk_order int`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_water_cust_walkorder" ON water_customers (organization_id, village_no, walk_order)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "IDX_water_cust_walkorder"`);
    await q.query(`ALTER TABLE water_customers DROP COLUMN IF EXISTS walk_order`);
    await q.query(`ALTER TABLE water_bills_v2 DROP COLUMN IF EXISTS meter_photo_url`);
  }
}
