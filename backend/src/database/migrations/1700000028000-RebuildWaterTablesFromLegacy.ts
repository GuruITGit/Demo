import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ซ่อมตารางน้ำประปาที่ค้างจากขอบเขตเดิม (งานจดมิเตอร์/ออกบิล ที่ถอดออกไปแล้ว)
 *
 * ที่มาของปัญหา: migration 1700000024000 เคย deploy ขึ้น prod ไปแล้ว (สร้าง 7 ตาราง)
 * ต่อมาถอดโมดูลออกและลบ migration นั้นทิ้งจาก repo — แต่ตารางบนฐานข้อมูลยังอยู่
 * migration 1700000026000 จึงเจอตารางชื่อซ้ำแล้ว `CREATE TABLE IF NOT EXISTS` ข้ามไปเงียบๆ
 * ทำให้ 1700000027000 (`ALTER ... doc_number`) ล้ม เพราะสคีมาเก่าไม่มีคอลัมน์นั้น
 *
 * ตัวนี้จึงตรวจว่าตารางเป็นสคีมาเก่าหรือไม่ แล้วสร้างใหม่ให้ตรงกับ entity ปัจจุบัน
 * — ถ้าตารางเก่ามีข้อมูลจะ "เปลี่ยนชื่อเก็บไว้" ไม่ลบทิ้ง (กู้คืนได้ถ้าจำเป็น)
 */
export class RebuildWaterTablesFromLegacy1700000028000 implements MigrationInterface {
  name = 'RebuildWaterTablesFromLegacy1700000028000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ตารางของขอบเขตเดิมที่ไม่ใช้แล้ว — เรียงให้ลูกมาก่อนแม่ เผื่อ FK
    const legacyOnly = ['water_payments', 'water_bills', 'water_readings', 'water_periods', 'water_rates'];
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    /** ตารางนี้เป็นสคีมาเก่าไหม (ดูจากคอลัมน์ที่มีเฉพาะสคีมาใหม่) */
    const isLegacy = async (table: string, newColumn: string) => {
      const [row] = await queryRunner.query(
        `SELECT to_regclass('public.${table}') IS NOT NULL AS exists,
                EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2) AS has_new`,
        [table, newColumn],
      );
      return row?.exists && !row?.has_new;
    };

    /** ว่างก็ทิ้ง มีข้อมูลก็เก็บไว้ก่อนในชื่อใหม่ — ไม่ลบข้อมูลของใครโดยไม่ตั้งใจ */
    const dropOrArchive = async (table: string) => {
      const [{ count }] = await queryRunner.query(`SELECT COUNT(*)::int AS count FROM "${table}"`);
      if (count > 0) {
        await queryRunner.query(`ALTER TABLE "${table}" RENAME TO "zz_legacy_${table}_${stamp}"`);
        console.log(`  [water] ${table} มี ${count} แถว → เก็บไว้เป็น zz_legacy_${table}_${stamp}`);
      } else {
        await queryRunner.query(`DROP TABLE "${table}" CASCADE`);
        console.log(`  [water] ${table} ว่าง → ลบทิ้ง`);
      }
    };

    const noticesLegacy = await isLegacy('water_notices', 'doc_number');
    const customersLegacy = await isLegacy('water_customers', 'full_name');

    if (!noticesLegacy && !customersLegacy) return;   // ฐานข้อมูลถูกต้องอยู่แล้ว (เช่น local)

    console.log('[water] พบตารางสคีมาเก่าที่ค้างจากขอบเขตเดิม — กำลังสร้างใหม่ให้ตรงกับระบบปัจจุบัน');

    // ตารางที่ไม่ใช้แล้วทั้งชุด (มีก็ต่อเมื่อเคยรัน migration ชุดเก่า)
    for (const t of legacyOnly) {
      const [row] = await queryRunner.query(`SELECT to_regclass('public.${t}') IS NOT NULL AS exists`);
      if (row?.exists) await dropOrArchive(t);
    }
    if (noticesLegacy) await dropOrArchive('water_notices');
    if (customersLegacy) await dropOrArchive('water_customers');

    // สร้างใหม่ตามสคีมาปัจจุบัน (เหมือน 1700000026000 ทุกประการ)
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
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_water_customers_name" ON "water_customers" ("full_name")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "water_notices" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "doc_number" integer,
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
    // เลขที่หนังสือเว้นว่างได้ (เจ้าหน้าที่กรอกเอง) — ห้ามซ้ำเฉพาะฉบับที่ลงเลขแล้ว
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_water_notices_docnum"
        ON "water_notices" ("organization_id", "doc_year", "doc_number")
        WHERE "deleted_at" IS NULL AND "doc_number" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_water_notices_date"
        ON "water_notices" ("organization_id", "notice_date")
    `);
    console.log('[water] สร้างตาราง water_customers / water_notices ใหม่เรียบร้อย');
  }

  public async down(): Promise<void> {
    // ไม่ย้อนกลับ — ตารางสคีมาเก่าเป็นของขอบเขตที่เลิกใช้แล้ว
  }
}
