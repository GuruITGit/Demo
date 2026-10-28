import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rework สารบรรณ v4 — เพิ่มคอลัมน์ workflow ใหม่ (additive, nullable) ลง correspondence_tickets
 * ยังไม่แตะสถานะเดิม — engine ใหม่จะขับด้วย current_step + คอลัมน์เหล่านี้
 * กันพัง prod: ADD COLUMN IF NOT EXISTS (idempotent)
 */
export class SarabanV4Schema1700000039000 implements MigrationInterface {
  name = 'SarabanV4Schema1700000039000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const cols: [string, string][] = [
      ['current_step', 'character varying(30)'],
      ['related_dept_id', 'uuid'],
      ['assigned_head_user_id', 'uuid'],
      ['owner_clerk_user_id', 'uuid'],
      ['related_head_user_id', 'uuid'],
      ['related_clerk_user_id', 'uuid'],
      ['pending_clerk_user_id', 'uuid'],
      ['pending_mayor_user_id', 'uuid'],
      ['dept_reg_number', 'character varying(100)'],
      ['dept_reg_at', 'TIMESTAMPTZ'],
      ['step_signatures', 'jsonb'],
    ];
    for (const [name, type] of cols) {
      await queryRunner.query(`ALTER TABLE "correspondence_tickets" ADD COLUMN IF NOT EXISTS "${name}" ${type}`);
    }
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ct_current_step" ON "correspondence_tickets" ("organization_id","current_step")`);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_ct_related_dept') THEN
          ALTER TABLE "correspondence_tickets"
            ADD CONSTRAINT "FK_ct_related_dept" FOREIGN KEY ("related_dept_id") REFERENCES "departments"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "correspondence_tickets" DROP CONSTRAINT IF EXISTS "FK_ct_related_dept"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ct_current_step"`);
    for (const c of ['current_step', 'related_dept_id', 'assigned_head_user_id', 'owner_clerk_user_id', 'related_head_user_id', 'related_clerk_user_id', 'pending_clerk_user_id', 'pending_mayor_user_id', 'dept_reg_number', 'dept_reg_at', 'step_signatures']) {
      await queryRunner.query(`ALTER TABLE "correspondence_tickets" DROP COLUMN IF EXISTS "${c}"`);
    }
  }
}
