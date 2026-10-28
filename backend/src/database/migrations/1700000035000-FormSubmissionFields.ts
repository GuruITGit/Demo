import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ขยาย citizen_reports ให้รองรับ "เอนจินฟอร์ม" (e-service หลายฟอร์ม อิง khokchan)
 * — เก็บคำตอบทุกฟิลด์เป็น jsonb + ไฟล์แนบหลายช่อง + พิกัด GPS (คงคอลัมน์เดิมของระบบร้องเรียนไว้ใช้ต่อ)
 */
export class FormSubmissionFields1700000035000 implements MigrationInterface {
  name = 'FormSubmissionFields1700000035000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "citizen_reports" ADD COLUMN IF NOT EXISTS "form_key" character varying(60)`);
    await queryRunner.query(`ALTER TABLE "citizen_reports" ADD COLUMN IF NOT EXISTS "form_title" character varying(200)`);
    await queryRunner.query(`ALTER TABLE "citizen_reports" ADD COLUMN IF NOT EXISTS "answers" jsonb`);
    await queryRunner.query(`ALTER TABLE "citizen_reports" ADD COLUMN IF NOT EXISTS "files" jsonb`);
    await queryRunner.query(`ALTER TABLE "citizen_reports" ADD COLUMN IF NOT EXISTS "geo" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "citizen_reports" DROP COLUMN IF EXISTS "form_key"`);
    await queryRunner.query(`ALTER TABLE "citizen_reports" DROP COLUMN IF EXISTS "form_title"`);
    await queryRunner.query(`ALTER TABLE "citizen_reports" DROP COLUMN IF EXISTS "answers"`);
    await queryRunner.query(`ALTER TABLE "citizen_reports" DROP COLUMN IF EXISTS "files"`);
    await queryRunner.query(`ALTER TABLE "citizen_reports" DROP COLUMN IF EXISTS "geo"`);
  }
}
