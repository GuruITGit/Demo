import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * โมดูลน้ำประปา (ขอบเขตจริงตามที่ อบต. ต้องการ):
 *   1. ทะเบียนผู้ใช้น้ำแบบย่อ — ใช้เลือกชื่อ/รหัสตอนกรอกหนังสือเท่านั้น
 *   2. หนังสือแจ้งเตือนค้างชำระค่าน้ำประปา — เก็บทุกฉบับที่ออก เพื่อพิมพ์ซ้ำและดูย้อนหลัง
 * งานจดมิเตอร์/ออกบิล/รับชำระ อบต. ใช้ระบบเดิมของเขา ไม่ทำในนี้
 */
export class CreateWaterNotices1700000026000 implements MigrationInterface {
  name = 'CreateWaterNotices1700000026000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ฐานข้อมูลที่เคยรันขอบเขตเดิม (จดมิเตอร์/ออกบิล) จะมีตารางชื่อเดียวกันแต่คนละสคีมาค้างอยู่
    // `CREATE TABLE IF NOT EXISTS` จึงข้ามไปเงียบๆ แล้วมาล้มตอน CREATE INDEX เพราะไม่มีคอลัมน์
    // → ตรวจก่อน ถ้าเจอของเก่าให้ข้ามทั้งตัว ปล่อยให้ 1700000028000 สร้างใหม่ให้ทั้งชุด
    const [legacy] = await queryRunner.query(`
      SELECT
        (to_regclass('public.water_notices') IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'water_notices' AND column_name = 'doc_year'))
        OR
        (to_regclass('public.water_customers') IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'water_customers' AND column_name = 'full_name'))
        AS is_legacy
    `);
    if (legacy?.is_legacy) {
      console.log('[water] ข้าม — พบตารางสคีมาเก่าจากขอบเขตเดิม (1700000028000 จะสร้างใหม่ให้)');
      return;
    }

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "water_customers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "customer_code" character varying(20) NOT NULL,
        "full_name" character varying(200) NOT NULL,
        "village_no" integer,
        "note" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_water_customers" PRIMARY KEY ("id"),
        CONSTRAINT "FK_water_customers_org" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_water_customers_code"
        ON "water_customers" ("organization_id", "customer_code") WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_water_customers_village"
        ON "water_customers" ("organization_id", "village_no")
    `);
    // ค้นด้วยชื่อบางส่วน (เจ้าหน้าที่พิมพ์ชื่อแล้วให้ขึ้นรายการแนะนำ)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_water_customers_name"
        ON "water_customers" ("full_name")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "water_notices" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "doc_number" integer NOT NULL,
        "doc_year" integer NOT NULL,
        "notice_date" date NOT NULL,
        "customer_id" uuid,
        "customer_code" character varying(20) NOT NULL,
        "full_name" character varying(200) NOT NULL,
        "village_no" integer,
        "period_month" integer NOT NULL,
        "period_year" integer NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "amount_text" character varying(300) NOT NULL,
        "created_by" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_water_notices" PRIMARY KEY ("id"),
        CONSTRAINT "FK_water_notices_org" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_water_notices_customer" FOREIGN KEY ("customer_id")
          REFERENCES "water_customers"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_water_notices_creator" FOREIGN KEY ("created_by")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    // เลขที่หนังสือห้ามซ้ำในปีเดียวกัน
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_water_notices_docnum"
        ON "water_notices" ("organization_id", "doc_year", "doc_number") WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_water_notices_date"
        ON "water_notices" ("organization_id", "notice_date")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "water_notices"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "water_customers"`);
  }
}
