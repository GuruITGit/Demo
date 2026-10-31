import { MigrationInterface, QueryRunner } from 'typeorm';

/** แผงลอย: ประเภทการเช่า (ประจำ/ชั่วคราว) — ชั่วคราวต้องจ่ายทันทีเมื่ออนุมัติ */
export class OutsideTenancyType1700000082000 implements MigrationInterface {
  name = 'OutsideTenancyType1700000082000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "market_outside_applications" ADD COLUMN IF NOT EXISTS "tenancy_type" VARCHAR(12) NOT NULL DEFAULT 'regular'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "market_outside_applications" DROP COLUMN IF EXISTS "tenancy_type"`);
  }
}
