import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * (1) จองแผงประจำ: วันเริ่มเช่า + จำนวนวัน (รายวัน)
 * (2) สมัครแผงลอย: ใบสมัครจากประชาชน → เจ้าหน้าที่อนุมัติแล้วออกบิลค่าเช่า (รหัส OUT-xxxx ใช้ค้นและชำระ)
 */
export class StallRentalAndOutsideApply1700000081000 implements MigrationInterface {
  name = 'StallRentalAndOutsideApply1700000081000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "market_stalls" ADD COLUMN IF NOT EXISTS "reserve_start_date" DATE`);
    await queryRunner.query(`ALTER TABLE "market_stalls" ADD COLUMN IF NOT EXISTS "reserve_days" INT`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "market_outside_applications" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "location_id" UUID NOT NULL REFERENCES "market_outside_locations"("id") ON DELETE CASCADE,
        "app_code" VARCHAR(12) NOT NULL,
        "applicant_name" VARCHAR(200) NOT NULL,
        "phone" VARCHAR(20) NOT NULL,
        "id_card_url" TEXT,
        "start_date" DATE,
        "days" INT NOT NULL DEFAULT 1,
        "status" VARCHAR(12) NOT NULL DEFAULT 'pending',
        "review_note" VARCHAR(300),
        "bill_id" UUID,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_outside_app_code" ON "market_outside_applications" ("organization_id", "app_code")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "market_outside_applications"`);
    await queryRunner.query(`ALTER TABLE "market_stalls" DROP COLUMN IF EXISTS "reserve_days"`);
    await queryRunner.query(`ALTER TABLE "market_stalls" DROP COLUMN IF EXISTS "reserve_start_date"`);
  }
}
