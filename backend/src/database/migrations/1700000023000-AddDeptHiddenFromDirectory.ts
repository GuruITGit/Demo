import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * เพิ่ม hidden_from_directory — ซ่อนกองจาก "หน้าบุคลากร"
 *
 * ของเดิมมีแค่ `hidden_from_forms` (ซ่อนจากตัวเลือกในแบบฟอร์ม เช่น มอบหมายสารบรรณ)
 * แต่หน้าบุคลากร (users.service.findOrgTree) แสดงทุกกองเสมอ
 * → กองที่ไม่ใช่หน่วยงานจริง (เช่น กอง "admin" ที่สร้างไว้พักบัญชีระบบตอน migrate ผู้ใช้)
 *   โผล่ในหน้าบุคลากรกลุ่ม "อื่นๆ" ให้ชาวบ้าน/เจ้าหน้าที่เห็น
 *
 * แยก flag ใหม่แทนการใช้ hidden_from_forms ร่วม เพราะคนละความหมาย —
 * หน่วยงานจริงบางกองอาจไม่ต้องการให้เลือกในฟอร์ม แต่ต้องแสดงในบุคลากร (เช่น หน่วยตรวจสอบภายใน)
 */
export class AddDeptHiddenFromDirectory1700000023000 implements MigrationInterface {
  name = 'AddDeptHiddenFromDirectory1700000023000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "hidden_from_directory" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "departments" DROP COLUMN IF EXISTS "hidden_from_directory"`);
  }
}
