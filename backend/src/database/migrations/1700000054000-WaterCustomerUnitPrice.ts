import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ราคาต่อหน่วยเฉพาะราย (water_customers.unit_price) — ทับเรตกลางของ อบต. รายคน
 * ระบบเก่าเก็บใน M12 · null = ใช้เรตกลาง · idempotent
 */
export class WaterCustomerUnitPrice1700000054000 implements MigrationInterface {
  name = 'WaterCustomerUnitPrice1700000054000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE water_customers ADD COLUMN IF NOT EXISTS unit_price numeric(10,2)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE water_customers DROP COLUMN IF EXISTS unit_price`);
  }
}
