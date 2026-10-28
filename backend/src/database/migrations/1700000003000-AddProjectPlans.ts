import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rework 2.0 — ประวัติแผนโครงการ (versioned plan)
 * โครงการแก้ย้อนหลังไม่ได้ ทุกการเปลี่ยนแปลงเก็บเป็นรายการต่อท้าย
 */
export class AddProjectPlans1700000003000 implements MigrationInterface {
  name = 'AddProjectPlans1700000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "project_plans" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "organization_id" UUID NOT NULL REFERENCES organizations(id),
        "project_id" UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        "plan_no" SMALLINT DEFAULT 1 NOT NULL,
        "revision_no" SMALLINT DEFAULT 0 NOT NULL,
        "change_type" VARCHAR(20) DEFAULT 'แผนใหม่' NOT NULL,
        "title" VARCHAR(300),
        "description" TEXT,
        "budget_amount" NUMERIC(18,2) DEFAULT 0 NOT NULL,
        "actual_amount" NUMERIC(18,2) DEFAULT 0 NOT NULL,
        "progress_pct" SMALLINT DEFAULT 0 NOT NULL,
        "status" VARCHAR(50),
        "start_date" DATE,
        "end_date" DATE,
        "created_by" UUID REFERENCES users(id) ON DELETE SET NULL,
        "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_project_plan_project ON project_plans(project_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "project_plans"`);
  }
}
