import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * สรุปการเก็บค่าน้ำ — ตัวเลขต่องวด(เดือน/ปี)×หมู่ สำหรับ dashboard
 * (ป้อนเอง ไม่ผูกบิลรายตัว — อบต. มีระบบเก็บเงินของ vendor อยู่แล้ว)
 */
export class CreateWaterCollection1700000029000 implements MigrationInterface {
  name = 'CreateWaterCollection1700000029000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "water_collection_summary" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "period_year" integer NOT NULL,
        "period_month" integer NOT NULL,
        "village_no" integer NOT NULL,
        "customers" integer NOT NULL DEFAULT 0,
        "billed_amount" numeric(14,2) NOT NULL DEFAULT 0,
        "collected_amount" numeric(14,2) NOT NULL DEFAULT 0,
        "units" integer,
        "note" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_water_collection_summary" PRIMARY KEY ("id"),
        CONSTRAINT "FK_water_collection_org" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE
      )
    `);
    // หนึ่งแถวต่อ งวด×หมู่ (กันซ้ำ + ใช้ upsert)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_water_collection_period_village"
        ON "water_collection_summary" ("organization_id", "period_year", "period_month", "village_no")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "water_collection_summary"`);
  }
}
