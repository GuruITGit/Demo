import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * เลขที่หนังสือ (ที่ บร 85405/___) เป็นเลขจากทะเบียนส่งของ อบต. เอง
 * เจ้าหน้าที่กรอกเองตอนออกหนังสือ ถ้ายังไม่รู้เลขก็เว้นว่างไว้แล้วเขียนด้วยมือทีหลังได้
 * → doc_number ต้องเป็น NULL ได้ และห้ามซ้ำเฉพาะเมื่อมีการกรอกจริง
 */
export class WaterNoticeDocNumberOptional1700000027000 implements MigrationInterface {
  name = 'WaterNoticeDocNumberOptional1700000027000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ฐานข้อมูลที่ยังค้างตาราง water_notices สคีมาเก่า (จากขอบเขตจดมิเตอร์ที่ถอดไปแล้ว)
    // จะไม่มีคอลัมน์ doc_number — ปล่อยให้ 1700000028000 สร้างตารางใหม่ให้ แล้วค่อยว่ากัน
    // ไม่งั้น ALTER ล้ม → migration ทั้งชุดหยุด → backend ไม่สตาร์ท
    const [col] = await queryRunner.query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'water_notices' AND column_name = 'doc_number'`,
    );
    if (!col) {
      console.log('[water] ข้าม — ตาราง water_notices ยังเป็นสคีมาเก่า (1700000028000 จะสร้างใหม่ให้)');
      return;
    }

    await queryRunner.query(`ALTER TABLE "water_notices" ALTER COLUMN "doc_number" DROP NOT NULL`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_water_notices_docnum"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_water_notices_docnum"
        ON "water_notices" ("organization_id", "doc_year", "doc_number")
        WHERE "deleted_at" IS NULL AND "doc_number" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_water_notices_docnum"`);
    await queryRunner.query(`UPDATE "water_notices" SET "doc_number" = 0 WHERE "doc_number" IS NULL`);
    await queryRunner.query(`ALTER TABLE "water_notices" ALTER COLUMN "doc_number" SET NOT NULL`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_water_notices_docnum"
        ON "water_notices" ("organization_id", "doc_year", "doc_number") WHERE "deleted_at" IS NULL
    `);
  }
}
