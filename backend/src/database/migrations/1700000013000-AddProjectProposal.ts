import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * เพิ่มฟิลด์ proposal (jsonb) เก็บเนื้อหาแบบฟอร์มโครงการราชการ 10 หัวข้อ
 *   - projects.proposal       = เนื้อหาปัจจุบัน
 *   - project_plans.proposal  = snapshot ต่อเวอร์ชัน (ใช้ทำ diff/ไฮไลต์ส่วนที่เปลี่ยน)
 */
export class AddProjectProposal1700000013000 implements MigrationInterface {
  name = 'AddProjectProposal1700000013000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "proposal" JSONB`);
    await queryRunner.query(`ALTER TABLE "project_plans" ADD COLUMN IF NOT EXISTS "proposal" JSONB`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "project_plans" DROP COLUMN IF EXISTS "proposal"`);
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN IF EXISTS "proposal"`);
  }
}
