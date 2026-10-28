import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ลบคอลัมน์ discount_amount ที่เป็น dead code (ไม่เคยใช้จริง — บิลลำนางรองไม่มีส่วนลด
 * และสูตรคิดเงินไม่นำมาบวก) · idempotent · ส่วนลดรายประเภทอยู่ที่ master table แยกอยู่แล้ว
 */
export class WaterDropDiscount1700000049000 implements MigrationInterface {
  name = 'WaterDropDiscount1700000049000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE water_bills_v2 DROP COLUMN IF EXISTS discount_amount`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE water_bills_v2 ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) NOT NULL DEFAULT 0`);
  }
}
