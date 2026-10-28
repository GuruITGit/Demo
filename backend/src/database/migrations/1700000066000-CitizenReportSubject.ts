import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ช่อง "เรื่อง" (subject) ของคำร้องทั่วไป — admin แก้ไขได้ก่อนพิมพ์ PDF (เหมือนสารบรรณที่แก้ subject/body ได้)
 * ว่าง = fallback เป็นรายละเอียด 80 ตัวอักษรแรก (ของเดิมก่อนมีช่องนี้)
 */
export class CitizenReportSubject1700000066000 implements MigrationInterface {
  name = 'CitizenReportSubject1700000066000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "citizen_reports" ADD COLUMN IF NOT EXISTS "subject" character varying(500)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "citizen_reports" DROP COLUMN IF EXISTS "subject"`);
  }
}
