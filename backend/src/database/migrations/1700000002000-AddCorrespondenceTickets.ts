import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rework 2.0 — ระบบสารบรรณแบบ Ticket Workflow
 *
 * correspondence_tickets               = สารบรรณ (ticket) ตัวหลัก
 * correspondence_ticket_departments    = การมอบหมายกอง (รองรับหลายกอง + เพิ่มกองภายหลัง)
 *
 * เลขสารบรรณภายใน (ticket_number) unique ต่อองค์กร — ลำดับแยกตามกองผ่าน
 * document_number_sequences (doc_type = 'TICKET:<deptId>') จึงไม่ชนข้ามกอง
 * ไฟล์แนบ reuse ตาราง file_uploads (ref_type='ticket'), ไทม์ไลน์ reuse document_workflow_logs
 *
 * ใช้ IF NOT EXISTS ทุกจุด → ปลอดภัยกับ production
 */
export class AddCorrespondenceTickets1700000002000 implements MigrationInterface {
  name = 'AddCorrespondenceTickets1700000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "correspondence_tickets" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "organization_id" UUID NOT NULL REFERENCES organizations(id),
        "ticket_number" VARCHAR(50) NOT NULL,
        "external_doc_number" VARCHAR(100),
        "received_date" DATE,
        "doc_date" DATE,
        "subject" VARCHAR(500) NOT NULL,
        "body" TEXT,
        "urgency_level" VARCHAR(20) DEFAULT 'ปกติ' NOT NULL,
        "owner_dept_id" UUID REFERENCES departments(id) ON DELETE SET NULL,
        "responsible_user_id" UUID REFERENCES users(id) ON DELETE SET NULL,
        "status" VARCHAR(50) DEFAULT 'รอดำเนินการ' NOT NULL,
        "note" TEXT,
        "clerk_signed_by" UUID REFERENCES users(id) ON DELETE SET NULL,
        "clerk_signed_at" TIMESTAMPTZ,
        "mayor_signed_by" UUID REFERENCES users(id) ON DELETE SET NULL,
        "mayor_signed_at" TIMESTAMPTZ,
        "completed_at" TIMESTAMPTZ,
        "created_by" UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
        "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        "updated_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        "deleted_at" TIMESTAMPTZ
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_ticket_org_number ON correspondence_tickets(organization_id, ticket_number)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_ticket_org_status ON correspondence_tickets(organization_id, status)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_ticket_owner_dept ON correspondence_tickets(owner_dept_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "correspondence_ticket_departments" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "ticket_id" UUID NOT NULL REFERENCES correspondence_tickets(id) ON DELETE CASCADE,
        "department_id" UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
        "assigned_user_id" UUID REFERENCES users(id) ON DELETE SET NULL,
        "status" VARCHAR(50) DEFAULT 'รอดำเนินการ' NOT NULL,
        "note" TEXT,
        "signed_by" UUID REFERENCES users(id) ON DELETE SET NULL,
        "signed_at" TIMESTAMPTZ,
        "is_active" BOOLEAN DEFAULT TRUE NOT NULL,
        "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        "updated_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_ticket_dept_ticket ON correspondence_ticket_departments(ticket_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_ticket_dept_dept ON correspondence_ticket_departments(department_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "correspondence_ticket_departments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "correspondence_tickets"`);
  }
}
