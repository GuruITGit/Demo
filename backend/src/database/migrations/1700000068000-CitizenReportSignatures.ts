import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ลายเซ็นของผู้เซ็นทั้ง 3 คน (ผอ.กอง/ปลัด/นายก) — อัปโหลดรูปตอนกดอนุมัติแต่ละขั้น
 * เก็บเป็น data URL base64 ตรง ๆ (ไม่ใช้ storage แยกไฟล์ — เหมือนรูปแนบในสารบรรณ) ไม่บังคับ
 */
export class CitizenReportSignatures1700000068000 implements MigrationInterface {
  name = 'CitizenReportSignatures1700000068000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "citizen_reports" ADD COLUMN IF NOT EXISTS "dept_head_signature" TEXT`);
    await queryRunner.query(`ALTER TABLE "citizen_reports" ADD COLUMN IF NOT EXISTS "clerk_signature" TEXT`);
    await queryRunner.query(`ALTER TABLE "citizen_reports" ADD COLUMN IF NOT EXISTS "mayor_signature" TEXT`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "citizen_reports" DROP COLUMN IF EXISTS "dept_head_signature"`);
    await queryRunner.query(`ALTER TABLE "citizen_reports" DROP COLUMN IF EXISTS "clerk_signature"`);
    await queryRunner.query(`ALTER TABLE "citizen_reports" DROP COLUMN IF EXISTS "mayor_signature"`);
  }
}
