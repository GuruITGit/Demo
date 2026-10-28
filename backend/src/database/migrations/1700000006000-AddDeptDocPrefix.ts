import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * เพิ่ม departments.doc_prefix — อักษร/รหัสนำหน้าเลขทะเบียนที่ตั้งเองได้ต่อกอง
 * (อิง brm "เพิ่มเอกสารที่" เช่น ปท0017.1) — ว่าง = ใช้ค่า default ตาม code เดิม
 * ใช้ IF NOT EXISTS → ปลอดภัยกับ production
 */
export class AddDeptDocPrefix1700000006000 implements MigrationInterface {
  name = 'AddDeptDocPrefix1700000006000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "doc_prefix" VARCHAR(30)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "departments" DROP COLUMN IF EXISTS "doc_prefix"`);
  }
}
