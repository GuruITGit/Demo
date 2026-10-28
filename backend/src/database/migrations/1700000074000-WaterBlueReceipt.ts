import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ใบเสร็จสีฟ้า (กระดาษต่อเนื่อง) — รูปตรา/ลายเซ็นผู้รับเงินที่วางบนใบเสร็จ + ค่าเลื่อนชดเชยเครื่องพิมพ์ (มม.)
 */
export class WaterBlueReceipt1700000074000 implements MigrationInterface {
  name = 'WaterBlueReceipt1700000074000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "water_rate" ADD COLUMN IF NOT EXISTS "receipt_seal_url" text`);
    await queryRunner.query(`ALTER TABLE "water_rate" ADD COLUMN IF NOT EXISTS "receipt_signature_url" text`);
    await queryRunner.query(`ALTER TABLE "water_rate" ADD COLUMN IF NOT EXISTS "receipt_offset_x" numeric(5,1) NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "water_rate" ADD COLUMN IF NOT EXISTS "receipt_offset_y" numeric(5,1) NOT NULL DEFAULT 0`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "water_rate" DROP COLUMN IF EXISTS "receipt_offset_y"`);
    await queryRunner.query(`ALTER TABLE "water_rate" DROP COLUMN IF EXISTS "receipt_offset_x"`);
    await queryRunner.query(`ALTER TABLE "water_rate" DROP COLUMN IF EXISTS "receipt_signature_url"`);
    await queryRunner.query(`ALTER TABLE "water_rate" DROP COLUMN IF EXISTS "receipt_seal_url"`);
  }
}
