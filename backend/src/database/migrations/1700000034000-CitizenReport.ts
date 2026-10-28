import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * เรื่องแจ้ง/ร้องเรียนจากประชาชน (พอร์ทัล /citizen) — กล่องรับเรื่องแยกจากสารบรรณ
 * ประชาชนแจ้งผ่านหน้าเว็บ (ไม่ล็อกอิน) → เจ้าหน้าที่คัดกรอง/เปลี่ยนสถานะ (สิทธิ์สารบรรณ)
 */
export class CitizenReport1700000034000 implements MigrationInterface {
  name = 'CitizenReport1700000034000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "citizen_reports" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "ref_no" character varying(20),
        "category" character varying(60) NOT NULL,
        "title" character varying(200),
        "detail" text NOT NULL,
        "reporter_name" character varying(150),
        "reporter_phone" character varying(30),
        "location" text,
        "photo_url" text,
        "status" character varying(16) NOT NULL DEFAULT 'new',
        "staff_note" text,
        "handled_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_citizen_reports" PRIMARY KEY ("id"),
        CONSTRAINT "FK_citizen_reports_org" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_citizen_reports_status" ON "citizen_reports" ("organization_id","status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_citizen_reports_created" ON "citizen_reports" ("organization_id","created_at")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_citizen_reports_ref" ON "citizen_reports" ("organization_id","ref_no")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "citizen_reports"`);
  }
}
