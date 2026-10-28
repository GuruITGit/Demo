import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rework 2.1 — เก็บภาพลายเซ็นที่ "วาดสดตอนลงนาม" ลงในบันทึก workflow
 * (เลิกใช้ลายเซ็นพรีเซ็ต เพื่อกันการก็อบภาพลายเซ็นเก่า)
 */
export class AddWorkflowSignatureImage1700000005000 implements MigrationInterface {
  name = 'AddWorkflowSignatureImage1700000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "document_workflow_logs" ADD COLUMN IF NOT EXISTS "signature_image" TEXT`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "document_workflow_logs" DROP COLUMN IF EXISTS "signature_image"`);
  }
}
