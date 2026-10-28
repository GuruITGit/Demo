import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * สลิปโอนเงินฝั่งประชาชน — อบต. อยากรับ QR แต่ vendor ไม่เปิดให้
 * ระบบเราจึงเติมช่องนี้: ประชาชนจ่าย QR แล้วแนบสลิป → เจ้าหน้าที่ตรวจ → ยืนยันเป็นชำระแล้ว
 */
export class WaterBillSlip1700000033000 implements MigrationInterface {
  name = 'WaterBillSlip1700000033000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "water_bills_v2" ADD COLUMN IF NOT EXISTS "slip_url" text`);
    await queryRunner.query(`ALTER TABLE "water_bills_v2" ADD COLUMN IF NOT EXISTS "slip_status" varchar(12) NOT NULL DEFAULT 'none'`);
    await queryRunner.query(`ALTER TABLE "water_bills_v2" ADD COLUMN IF NOT EXISTS "slip_uploaded_at" timestamptz`);
    await queryRunner.query(`ALTER TABLE "water_bills_v2" ADD COLUMN IF NOT EXISTS "slip_note" text`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_water_bills_slip_pending" ON "water_bills_v2" ("organization_id","slip_status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_water_bills_slip_pending"`);
    await queryRunner.query(`ALTER TABLE "water_bills_v2" DROP COLUMN IF EXISTS "slip_url"`);
    await queryRunner.query(`ALTER TABLE "water_bills_v2" DROP COLUMN IF EXISTS "slip_status"`);
    await queryRunner.query(`ALTER TABLE "water_bills_v2" DROP COLUMN IF EXISTS "slip_uploaded_at"`);
    await queryRunner.query(`ALTER TABLE "water_bills_v2" DROP COLUMN IF EXISTS "slip_note"`);
  }
}
