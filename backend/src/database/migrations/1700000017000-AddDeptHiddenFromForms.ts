import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * เพิ่ม departments.hidden_from_forms — ซ่อนกองนี้จากตัวเลือกในแบบฟอร์มต่างๆ
 * (เช่น มอบหมายสารบรรณ) แต่ยังแสดงในโมดูลบุคลากร/จัดการผู้ใช้/จัดการกอง
 * default ซ่อน "หน่วยตรวจสอบภายใน" ให้ก่อน (Admin/กองอื่นสลับได้เองในจัดการกอง)
 */
export class AddDeptHiddenFromForms1700000017000 implements MigrationInterface {
  name = 'AddDeptHiddenFromForms1700000017000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "hidden_from_forms" BOOLEAN NOT NULL DEFAULT false`);
    await queryRunner.query(`UPDATE "departments" SET "hidden_from_forms" = true WHERE "name_th" ILIKE '%ตรวจสอบภายใน%'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "departments" DROP COLUMN IF EXISTS "hidden_from_forms"`);
  }
}
