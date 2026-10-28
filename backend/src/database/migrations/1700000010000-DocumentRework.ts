import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rework คลังเอกสาร:
 * - เพิ่ม owner_org (ผู้สร้าง/หน่วยงานเจ้าของเอกสาร — กรอกเอง)
 * - ระดับการเข้าถึงใหม่: public(สาธารณะ) / department(แค่กอง) / private(แค่เฉพาะบุคคล)
 *   map ค่าเดิม internal→department, confidential→private (ถ้ามีข้อมูลเก่า)
 */
export class DocumentRework1700000010000 implements MigrationInterface {
  name = 'DocumentRework1700000010000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "owner_org" VARCHAR(255)`);
    await queryRunner.query(`UPDATE "documents" SET "access_level" = 'department' WHERE "access_level" IN ('internal')`);
    await queryRunner.query(`UPDATE "documents" SET "access_level" = 'private' WHERE "access_level" IN ('confidential')`);
    await queryRunner.query(`ALTER TABLE "documents" ALTER COLUMN "access_level" SET DEFAULT 'department'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "documents" ALTER COLUMN "access_level" SET DEFAULT 'internal'`);
    await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN IF EXISTS "owner_org"`);
  }
}
