import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ขั้นตอนอนุมัติ 3 ผู้เซ็น (ผอ.กอง → ปลัด → นายก) สำหรับเรื่องแจ้ง/ร้องเรียนที่ต้องส่งไปกองจริง
 * คนละกลไกกับสารบรรณ (correspondence_tickets) ทั้งหมด — แค่เพิ่มคอลัมน์ใน citizen_reports เอง
 * "ขั้นปัจจุบัน" คำนวณจาก signed_at ว่าง/ไม่ว่าง ไม่เก็บ stage แยก กัน inconsistent state
 */
export class CitizenReportApproval1700000065000 implements MigrationInterface {
  name = 'CitizenReportApproval1700000065000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "citizen_reports" ADD COLUMN IF NOT EXISTS "target_dept_id" uuid`);
    await queryRunner.query(`ALTER TABLE "citizen_reports" ADD COLUMN IF NOT EXISTS "dept_head_signed_by" uuid`);
    await queryRunner.query(`ALTER TABLE "citizen_reports" ADD COLUMN IF NOT EXISTS "dept_head_signed_at" TIMESTAMPTZ`);
    await queryRunner.query(`ALTER TABLE "citizen_reports" ADD COLUMN IF NOT EXISTS "clerk_signed_by" uuid`);
    await queryRunner.query(`ALTER TABLE "citizen_reports" ADD COLUMN IF NOT EXISTS "clerk_signed_at" TIMESTAMPTZ`);
    await queryRunner.query(`ALTER TABLE "citizen_reports" ADD COLUMN IF NOT EXISTS "mayor_signed_by" uuid`);
    await queryRunner.query(`ALTER TABLE "citizen_reports" ADD COLUMN IF NOT EXISTS "mayor_signed_at" TIMESTAMPTZ`);
    await queryRunner.query(`
      ALTER TABLE "citizen_reports"
      ADD CONSTRAINT "FK_citizen_reports_target_dept" FOREIGN KEY ("target_dept_id")
        REFERENCES "departments"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_citizen_reports_target_dept" ON "citizen_reports" ("organization_id","target_dept_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "citizen_reports" DROP CONSTRAINT IF EXISTS "FK_citizen_reports_target_dept"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_citizen_reports_target_dept"`);
    await queryRunner.query(`ALTER TABLE "citizen_reports" DROP COLUMN IF EXISTS "target_dept_id"`);
    await queryRunner.query(`ALTER TABLE "citizen_reports" DROP COLUMN IF EXISTS "dept_head_signed_by"`);
    await queryRunner.query(`ALTER TABLE "citizen_reports" DROP COLUMN IF EXISTS "dept_head_signed_at"`);
    await queryRunner.query(`ALTER TABLE "citizen_reports" DROP COLUMN IF EXISTS "clerk_signed_by"`);
    await queryRunner.query(`ALTER TABLE "citizen_reports" DROP COLUMN IF EXISTS "clerk_signed_at"`);
    await queryRunner.query(`ALTER TABLE "citizen_reports" DROP COLUMN IF EXISTS "mayor_signed_by"`);
    await queryRunner.query(`ALTER TABLE "citizen_reports" DROP COLUMN IF EXISTS "mayor_signed_at"`);
  }
}
