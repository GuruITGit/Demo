import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ระบบเก็บค่าน้ำ v2 (field app จดมิเตอร์→บิล→รับชำระ) — ทำเองแทน vendor
 * ใช้ชื่อ water_bills_v2 กันชนกับตาราง water_bills เก่าของขอบเขตที่ถอดไปแล้ว
 */
export class CreateWaterBillingV21700000030000 implements MigrationInterface {
  name = 'CreateWaterBillingV21700000030000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "water_rate" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "unit_price" numeric(10,2) NOT NULL DEFAULT 4,
        "service_fee" numeric(10,2) NOT NULL DEFAULT 5,
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_water_rate" PRIMARY KEY ("id"),
        CONSTRAINT "FK_water_rate_org" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_water_rate_org" ON "water_rate" ("organization_id")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "water_bills_v2" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "customer_id" uuid NOT NULL,
        "customer_code" character varying(20) NOT NULL,
        "full_name" character varying(200) NOT NULL,
        "village_no" integer,
        "period_year" integer NOT NULL,
        "period_month" integer NOT NULL,
        "prev_reading" integer NOT NULL DEFAULT 0,
        "curr_reading" integer NOT NULL DEFAULT 0,
        "units" integer NOT NULL DEFAULT 0,
        "read_at" TIMESTAMPTZ,
        "read_by" uuid,
        "issue_type" character varying(20) NOT NULL DEFAULT 'normal',
        "note" text,
        "unit_price" numeric(10,2) NOT NULL DEFAULT 0,
        "water_amount" numeric(12,2) NOT NULL DEFAULT 0,
        "service_fee" numeric(10,2) NOT NULL DEFAULT 0,
        "total_amount" numeric(12,2) NOT NULL DEFAULT 0,
        "status" character varying(12) NOT NULL DEFAULT 'unpaid',
        "paid_at" TIMESTAMPTZ,
        "paid_amount" numeric(12,2),
        "received_by" uuid,
        "receipt_no" character varying(40),
        "pay_method" character varying(12),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_water_bills_v2" PRIMARY KEY ("id"),
        CONSTRAINT "FK_water_bills_v2_org" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_water_bills_v2_customer" FOREIGN KEY ("customer_id")
          REFERENCES "water_customers"("id") ON DELETE CASCADE
      )
    `);
    // 1 บิล ต่อ ผู้ใช้น้ำ × งวด
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_water_bills_v2_customer_period"
        ON "water_bills_v2" ("organization_id", "customer_id", "period_year", "period_month")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_water_bills_v2_period_village"
        ON "water_bills_v2" ("organization_id", "period_year", "period_month", "village_no")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_water_bills_v2_status"
        ON "water_bills_v2" ("organization_id", "status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "water_bills_v2"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "water_rate"`);
  }
}
