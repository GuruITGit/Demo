import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ค่าแผงตลาด + ค่าเก็บขยะบ้าน (ย้ายจากเดโม่ localStorage มาเป็นข้อมูลจริงในฐานข้อมูล)
 * ทุกตารางมี organization_id (multi-tenant) · ใช้ IF NOT EXISTS เพราะเป็นตารางใหม่ทั้งหมด
 */
export class MarketWasteSchema1700000076000 implements MigrationInterface {
  name = 'MarketWasteSchema1700000076000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "market_stalls" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "stall_code" VARCHAR(10) NOT NULL,
        "zone" VARCHAR(10) NOT NULL,
        "status" VARCHAR(12) NOT NULL DEFAULT 'available',
        "tenant_name" VARCHAR(200),
        "monthly_rate" NUMERIC(10,2) NOT NULL DEFAULT 0,
        "active" BOOLEAN NOT NULL DEFAULT TRUE,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_market_stalls_org_code" ON "market_stalls" ("organization_id", "stall_code")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "market_bills" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "stall_id" UUID REFERENCES "market_stalls"("id") ON DELETE SET NULL,
        "stall_code" VARCHAR(10) NOT NULL,
        "payer_name" VARCHAR(200) NOT NULL,
        "kind" VARCHAR(10) NOT NULL,
        "period" VARCHAR(7) NOT NULL,
        "amount" NUMERIC(10,2) NOT NULL,
        "due_date" DATE,
        "status" VARCHAR(12) NOT NULL DEFAULT 'unpaid',
        "paid_method" VARCHAR(12),
        "paid_at" TIMESTAMPTZ,
        "receipt_no" VARCHAR(30),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_market_bills_unique" ON "market_bills" ("organization_id", "stall_code", "kind", "period")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "waste_bills" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "household_ref" VARCHAR(20) NOT NULL,
        "holder_name" VARCHAR(200) NOT NULL,
        "house_no" VARCHAR(20) NOT NULL,
        "moo" VARCHAR(5) NOT NULL,
        "phone" VARCHAR(20),
        "period" VARCHAR(7) NOT NULL,
        "amount" NUMERIC(10,2) NOT NULL,
        "due_date" DATE,
        "status" VARCHAR(12) NOT NULL DEFAULT 'unpaid',
        "paid_method" VARCHAR(12),
        "paid_at" TIMESTAMPTZ,
        "receipt_no" VARCHAR(30),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_waste_bills_unique" ON "waste_bills" ("organization_id", "household_ref", "period")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "waste_bills"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "market_bills"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "market_stalls"`);
  }
}
