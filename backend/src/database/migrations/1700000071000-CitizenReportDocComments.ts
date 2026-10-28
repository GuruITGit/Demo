import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * เรื่องแจ้ง/ร้องเรียน: แต่งเอกสารได้ (ตัวแต่งเอกสารแบบสารบรรณ) + ความเห็นของเจ้าหน้าที่ต่อกันเป็นรายการ
 * - citizen_reports.doc_layout = layout v2 ของเอกสารที่แต่ง
 * - citizen_report_comments = ความเห็นภายใน (ประชาชนไม่เห็น)
 */
export class CitizenReportDocComments1700000071000 implements MigrationInterface {
  name = 'CitizenReportDocComments1700000071000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "citizen_reports" ADD COLUMN IF NOT EXISTS "doc_layout" jsonb NULL`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "citizen_report_comments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "report_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "body" text NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE NULL,
        CONSTRAINT "PK_citizen_report_comments" PRIMARY KEY ("id")
      )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_citizen_report_comments_report" ON "citizen_report_comments" ("report_id", "created_at")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "citizen_report_comments"`);
    await queryRunner.query(`ALTER TABLE "citizen_reports" DROP COLUMN IF EXISTS "doc_layout"`);
  }
}
