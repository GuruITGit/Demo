import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ① ตาราง water_slip_verify — ทะเบียนสลิปที่ตรวจกับธนาคารผ่านแล้ว
 *    UNIQUE(org, trans_ref) = สลิปใบเดียวใช้ตัดชำระได้ครั้งเดียว (กันใช้ซ้ำทั้งฝั่งเจ้าหน้าที่และประชาชน)
 * ② water_rate.slip_verify_providers (jsonb) — ตั้งผู้ให้บริการตรวจสลิปได้หลายเจ้า (เจ้าแรกโทเคนหมด → ใช้เจ้าถัดไป)
 *    ย้ายค่าเดิมจาก slip_verify_provider/token มาให้อัตโนมัติ
 */
export class WaterSlipVerifyMulti1700000060000 implements MigrationInterface {
  name = 'WaterSlipVerifyMulti1700000060000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "water_slip_verify" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "organization_id" uuid NOT NULL,
      "trans_ref" varchar(80) NOT NULL,
      "amount" numeric(12,2) NOT NULL,
      "provider" varchar(20),
      "receiver_name" text,
      "receiver_id" text,
      "verified_at" timestamptz NOT NULL DEFAULT now(),
      "verified_by" uuid,
      "bill_ids" uuid[],
      "consumed_at" timestamptz
    )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_water_slip_verify_ref"
      ON "water_slip_verify" ("organization_id", "trans_ref")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_water_slip_verify_org"
      ON "water_slip_verify" ("organization_id", "verified_at")`);

    await q.query(`ALTER TABLE "water_rate" ADD COLUMN IF NOT EXISTS "slip_verify_providers" jsonb`);
    // ย้ายค่าเดิม (เจ้าเดียว) เข้า list ให้ org ที่ตั้งไว้แล้ว
    await q.query(`UPDATE "water_rate"
       SET "slip_verify_providers" = jsonb_build_array(
             jsonb_build_object('provider', "slip_verify_provider", 'token', "slip_verify_token"))
     WHERE "slip_verify_provider" IS NOT NULL AND "slip_verify_token" IS NOT NULL
       AND "slip_verify_providers" IS NULL`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "water_rate" DROP COLUMN IF EXISTS "slip_verify_providers"`);
    await q.query(`DROP INDEX IF EXISTS "IDX_water_slip_verify_org"`);
    await q.query(`DROP INDEX IF EXISTS "UQ_water_slip_verify_ref"`);
    await q.query(`DROP TABLE IF EXISTS "water_slip_verify"`);
  }
}
