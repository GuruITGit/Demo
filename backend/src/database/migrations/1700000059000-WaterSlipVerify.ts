import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ตรวจสลิป PromptPay อัตโนมัติ (กันโกง) —
 * - water_bills_v2: เก็บผลตรวจสลิป (เลขอ้างอิงธุรกรรม/ยอดจากสลิป/เวลาตรวจ) + index กันสลิปซ้ำ
 * - water_rate: ตั้งค่าผู้ให้บริการตรวจสลิป + token (secret)
 * ทุกคอลัมน์ nullable → org ที่ยังไม่ตั้งใช้ flow เดิมได้ ไม่กระทบของเดิม
 */
export class WaterSlipVerify1700000059000 implements MigrationInterface {
  name = 'WaterSlipVerify1700000059000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "water_bills_v2" ADD COLUMN IF NOT EXISTS "slip_trans_ref" varchar(80)`);
    await q.query(`ALTER TABLE "water_bills_v2" ADD COLUMN IF NOT EXISTS "slip_amount" numeric(12,2)`);
    await q.query(`ALTER TABLE "water_bills_v2" ADD COLUMN IF NOT EXISTS "slip_verified_at" timestamptz`);
    // กันสลิปใบเดิม (เลขอ้างอิงเดียวกัน) ถูกใช้ตัดชำระซ้ำในหน่วยงานเดียวกัน
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_water_bill_slip_ref"
      ON "water_bills_v2" ("organization_id", "slip_trans_ref")
      WHERE "slip_trans_ref" IS NOT NULL`);
    await q.query(`ALTER TABLE "water_rate" ADD COLUMN IF NOT EXISTS "slip_verify_provider" varchar(20)`);
    await q.query(`ALTER TABLE "water_rate" ADD COLUMN IF NOT EXISTS "slip_verify_token" varchar(200)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "UQ_water_bill_slip_ref"`);
    await q.query(`ALTER TABLE "water_bills_v2" DROP COLUMN IF EXISTS "slip_trans_ref"`);
    await q.query(`ALTER TABLE "water_bills_v2" DROP COLUMN IF EXISTS "slip_amount"`);
    await q.query(`ALTER TABLE "water_bills_v2" DROP COLUMN IF EXISTS "slip_verified_at"`);
    await q.query(`ALTER TABLE "water_rate" DROP COLUMN IF EXISTS "slip_verify_provider"`);
    await q.query(`ALTER TABLE "water_rate" DROP COLUMN IF EXISTS "slip_verify_token"`);
  }
}
