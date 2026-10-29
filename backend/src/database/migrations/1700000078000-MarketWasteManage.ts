import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * จัดการค่าแผง/ค่าขยะแบบครบ: ทะเบียนครัวเรือน (เดิมเป็นแค่ข้อมูลในบิล) · แผงลอย (จุดเก็บรายวัน/รายเดือน) + รายการเก็บเงิน
 * ทุกตารางมี organization_id · IF NOT EXISTS · backfill ครัวเรือนจากบิลเดิมแบบ idempotent
 */
export class MarketWasteManage1700000078000 implements MigrationInterface {
  name = 'MarketWasteManage1700000078000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "waste_households" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "household_ref" VARCHAR(20) NOT NULL,
        "holder_name" VARCHAR(200) NOT NULL,
        "house_no" VARCHAR(20) NOT NULL,
        "moo" VARCHAR(5) NOT NULL,
        "phone" VARCHAR(20),
        "monthly_fee" NUMERIC(10,2),
        "active" BOOLEAN NOT NULL DEFAULT TRUE,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_waste_households_ref" ON "waste_households" ("organization_id", "household_ref")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_waste_households_house" ON "waste_households" ("organization_id", "house_no", "moo")`);
    await queryRunner.query(`
      INSERT INTO "waste_households" ("organization_id", "household_ref", "holder_name", "house_no", "moo", "phone")
      SELECT DISTINCT ON (organization_id, household_ref) organization_id, household_ref, holder_name, house_no, moo, phone
        FROM "waste_bills" ORDER BY organization_id, household_ref, period DESC
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "market_outside_locations" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "name" VARCHAR(100) NOT NULL,
        "rent_rate" NUMERIC(10,2) NOT NULL DEFAULT 0,
        "rent_period" VARCHAR(8) NOT NULL DEFAULT 'daily',
        "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
        "active" BOOLEAN NOT NULL DEFAULT TRUE,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_market_outside_loc_org" ON "market_outside_locations" ("organization_id")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "market_outside_collections" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "location_id" UUID NOT NULL REFERENCES "market_outside_locations"("id") ON DELETE CASCADE,
        "vendor_name" VARCHAR(200) NOT NULL,
        "collected_on" DATE NOT NULL,
        "amount" NUMERIC(10,2) NOT NULL,
        "receipt_no" VARCHAR(30),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_market_outside_col_loc" ON "market_outside_collections" ("organization_id", "location_id", "collected_on")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "market_outside_collections"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "market_outside_locations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "waste_households"`);
  }
}
