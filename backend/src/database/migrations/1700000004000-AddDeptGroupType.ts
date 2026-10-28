import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rework 2.1 — เพิ่มฝ่าย/กลุ่ม + ประเภทหน่วยงานให้ departments
 * รองรับโครงสร้าง อบต. 3 ชั้น: ฝ่าย/กลุ่ม → กอง → งาน
 */
export class AddDeptGroupType1700000004000 implements MigrationInterface {
  name = 'AddDeptGroupType1700000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "group_label" VARCHAR(100)`);
    await queryRunner.query(`ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "dept_type" VARCHAR(20) DEFAULT 'ADMIN' NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "departments" DROP COLUMN IF EXISTS "group_label"`);
    await queryRunner.query(`ALTER TABLE "departments" DROP COLUMN IF EXISTS "dept_type"`);
  }
}
