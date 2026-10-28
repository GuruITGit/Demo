import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * เพิ่ม water_rate.ktb_biller_id — Biller ID (Comp Code) สำหรับ QR Bill Payment กรุงไทย
 * เว้นว่างได้ (nullable) → org ที่ยังไม่ตั้งใช้ QR พร้อมเพย์เดิมต่อไป ไม่กระทบของเดิม
 */
export class WaterRateKtbBiller1700000058000 implements MigrationInterface {
  name = 'WaterRateKtbBiller1700000058000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "water_rate" ADD COLUMN IF NOT EXISTS "ktb_biller_id" varchar(20)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "water_rate" DROP COLUMN IF EXISTS "ktb_biller_id"`);
  }
}
