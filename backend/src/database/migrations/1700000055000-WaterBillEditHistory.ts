import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ประวัติการแก้เลขมิเตอร์รายบิล (water_bills_v2.edit_history) — [{by,at,prev,curr}]
 * สตง.ตรวจได้ว่าใครแก้เลขจดเมื่อไหร่ (ระบบเก่า vendor เก็บใน edited[]) · idempotent
 */
export class WaterBillEditHistory1700000055000 implements MigrationInterface {
  name = 'WaterBillEditHistory1700000055000';
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE water_bills_v2 ADD COLUMN IF NOT EXISTS edit_history jsonb`);
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE water_bills_v2 DROP COLUMN IF EXISTS edit_history`);
  }
}
