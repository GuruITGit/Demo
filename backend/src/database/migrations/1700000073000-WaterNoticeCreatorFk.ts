import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * แก้ "ออกหนังสือแจ้งค้างชำระรายคนไม่ได้" — water_notices.created_by เดิมชี้ไปตาราง users (ระบบสารบรรณ)
 * แต่เจ้าหน้าที่ประปาล็อกอินด้วย water_users (WaterAuthGuard) → insert ชน FK_water_notices_creator ทุกครั้ง
 * ย้าย FK ไปชี้ water_users · ค่าเดิมที่ไม่ใช่ water_users (ถ้ามี) ตั้งเป็น NULL ก่อน กันสร้าง FK ไม่ผ่าน
 */
export class WaterNoticeCreatorFk1700000073000 implements MigrationInterface {
  name = 'WaterNoticeCreatorFk1700000073000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "water_notices" DROP CONSTRAINT IF EXISTS "FK_water_notices_creator"`);
    await queryRunner.query(`
      UPDATE "water_notices" n SET "created_by" = NULL
      WHERE n."created_by" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "water_users" u WHERE u."id" = n."created_by")
    `);
    await queryRunner.query(`
      ALTER TABLE "water_notices" ADD CONSTRAINT "FK_water_notices_creator"
        FOREIGN KEY ("created_by") REFERENCES "water_users"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "water_notices" DROP CONSTRAINT IF EXISTS "FK_water_notices_creator"`);
    await queryRunner.query(`
      UPDATE "water_notices" n SET "created_by" = NULL
      WHERE n."created_by" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = n."created_by")
    `);
    await queryRunner.query(`
      ALTER TABLE "water_notices" ADD CONSTRAINT "FK_water_notices_creator"
        FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL
    `);
  }
}
