import { MigrationInterface, QueryRunner } from 'typeorm';

/** เพิ่มหมู่ที่ให้เรื่องแจ้ง/ร้องเรียน (ประชาชนเลือกเองตอนแจ้ง) — คู่กับพิกัด GPS (คอลัมน์ geo เดิมมีอยู่แล้ว) */
export class CitizenReportGeoVillage1700000064000 implements MigrationInterface {
  name = 'CitizenReportGeoVillage1700000064000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "citizen_reports" ADD COLUMN IF NOT EXISTS "village_no" integer`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "citizen_reports" DROP COLUMN IF EXISTS "village_no"`);
  }
}
